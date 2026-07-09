"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { runGeneration } from "@/lib/media/generate";
import { postMediaEvent, processMediaEvent, readIdList } from "@/lib/media/media-space";
import { MEDIA_TYPES } from "@/lib/media/constants";
import { angleBySlug } from "@/lib/media/angles";
import { fetchMediaPage, type MediaPage, type MediaQuery } from "@/lib/media/query";
import { fetchSocialFeedPage, type SocialFeedPage, type SocialFeedScope } from "@/lib/media/social-feed";
import type { MediaType } from "@/generated/prisma/enums";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/** Fetch the next page of a media list (cursor-based). Used by "Load more". */
export async function loadMediaPage(
  query: MediaQuery,
  cursor: number | null,
  pageSize: number,
): Promise<MediaPage> {
  return fetchMediaPage(query, pageSize, cursor);
}

/** Fetch the next page of the social feed (cursor-based). Used by "Load more". */
export async function loadSocialFeed(
  scope: SocialFeedScope,
  cursor: number | null,
  pageSize: number,
): Promise<SocialFeedPage> {
  return fetchSocialFeedPage(scope, pageSize, cursor);
}

/** Mark a piece as read (clears its unviewed badge in the inbox). */
export async function markMediaViewed(id: number): Promise<void> {
  if (!Number.isInteger(id)) return;
  await db.media.update({ where: { id }, data: { viewed: true } }).catch(() => {});
  revalidatePath("/media");
}

/** Save edits to an article's headline/body, and optionally its header image. */
export async function updateMedia(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad media id.");

  const headline = String(formData.get("headline") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!headline) throw new Error("A headline is required.");
  if (!body) throw new Error("The article body can't be empty.");

  const caption = String(formData.get("photoCaption") ?? "").trim();
  const data: {
    headline: string;
    body: string;
    photoCaption: string | null;
    photo?: Uint8Array<ArrayBuffer> | null;
  } = { headline, body, photoCaption: caption || null };

  if (formData.get("removePhoto")) {
    data.photo = null;
    data.photoCaption = null;
  } else {
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      if (file.type !== "image/png") throw new Error("Header image must be a PNG.");
      if (file.size > MAX_PHOTO_BYTES) throw new Error("Header image must be under 5MB.");
      data.photo = new Uint8Array(await file.arrayBuffer());
    }
  }

  const media = await db.media.update({
    where: { id },
    data,
    select: { seasonId: true },
  });

  revalidatePath(`/media/${id}`);
  revalidatePath("/media");
  if (media.seasonId != null) revalidatePath(`/seasons/${media.seasonId}/media`);
}

/** Re-run generation for a piece (e.g. after a FAILED attempt). */
export async function regenerateMedia(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad media id.");

  await db.media.update({
    where: { id },
    data: { status: "PENDING", genError: null },
  });
  after(() => runGeneration(id));

  revalidatePath(`/media/${id}`);
  revalidatePath("/media");
}

/** A positive season id from the form, or null when absent/blank (Number(null) is
 *  0, which is a valid integer — hence the explicit presence + >0 check). */
function optSeasonId(formData: FormData): number | null {
  const raw = formData.get("seasonId");
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Delete one piece. Redirects back to the inbox afterward. */
export async function deleteMedia(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad media id.");
  const seasonId = optSeasonId(formData);

  await db.media.delete({ where: { id } });

  revalidatePath("/media");
  if (seasonId != null) {
    revalidatePath(`/seasons/${seasonId}/media`);
    redirect(`/seasons/${seasonId}/media`);
  }
  redirect("/media");
}

/**
 * Delete many pieces at once (the checkbox multi-select on the inbox). Because
 * mistakes happen in bulk, this is the fast escape hatch for cleaning them up.
 */
export async function bulkDeleteMedia(formData: FormData) {
  const ids = formData
    .getAll("id")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));
  if (ids.length === 0) throw new Error("Select at least one item to delete.");

  await db.media.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/media");
  const seasonId = optSeasonId(formData);
  if (seasonId != null) revalidatePath(`/seasons/${seasonId}/media`);
}

/**
 * Delete a mediaSpace event. Its generated media cascade away with it — the clean
 * undo for an erroneously-posted event.
 */
export async function deleteMediaEvent(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad event id.");

  await db.mediaEvent.delete({ where: { id } });

  revalidatePath("/media/space");
  revalidatePath("/media");
}

/**
 * Create a mediaEvent by hand from the New Post form: choose the media type, the
 * subject (a game / season / player), which personas write it, and any context.
 */
export async function createManualEvent(formData: FormData) {
  const meta = angleBySlug(String(formData.get("angle") ?? ""));
  if (!meta) throw new Error("Pick an article type.");
  const scope = meta.scope;

  const mediaTypeRaw = String(formData.get("mediaType") ?? "ARTICLE");
  const mediaType = (MEDIA_TYPES as string[]).includes(mediaTypeRaw)
    ? (mediaTypeRaw as MediaType)
    : "ARTICLE";

  const context = String(formData.get("mediaContext") ?? "").trim() || null;
  const personaIds = readIdList(formData, "mediaPersonaId");

  if (meta.subject === "players") {
    // One article about one or more selected players, optionally focused on games.
    const subjects = readIdList(formData, "subjectPlayerId");
    if (subjects.length === 0) throw new Error("Pick at least one player.");
    await postMediaEvent({
      type: "MANUAL",
      scope,
      angle: meta.slug,
      mediaType,
      playerId: subjects[0],
      playerIds: subjects.slice(1), // additional subjects of the same article
      gameIds: readIdList(formData, "focusGameId"),
      context,
      personaIds,
    });
  } else if (meta.subject === "recruit") {
    // A recruiting profile on one prospect.
    const recruitId = Number(formData.get("subjectId"));
    if (!Number.isInteger(recruitId)) throw new Error("Choose a recruit.");
    await postMediaEvent({
      type: "MANUAL",
      scope,
      angle: meta.slug,
      mediaType,
      recruitId,
      context,
      personaIds,
    });
  } else {
    const subjectId = Number(formData.get("subjectId"));
    if (!Number.isInteger(subjectId)) throw new Error("Choose a subject.");
    await postMediaEvent({
      type: "MANUAL",
      scope,
      angle: meta.slug,
      mediaType,
      gameId: scope === "GAME" ? subjectId : null,
      seasonId: scope === "TEAM" ? subjectId : null,
      context,
      personaIds,
      playerIds: readIdList(formData, "mediaPlayerId"), // separate player features
    });
  }

  revalidatePath("/media");
  revalidatePath("/media/space");
  redirect("/media/space");
}

/** Re-run a failed (or any) event through the mediaSpace listener. */
export async function reprocessMediaEvent(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad event id.");

  // Drop any media the prior attempt made, then reprocess cleanly.
  await db.media.deleteMany({ where: { mediaEventId: id } });
  await db.mediaEvent.update({ where: { id }, data: { status: "PENDING", error: null } });
  after(() => processMediaEvent(id));

  revalidatePath("/media/space");
}
