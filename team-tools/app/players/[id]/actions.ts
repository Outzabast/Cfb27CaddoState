"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseStatus } from "@/lib/player-profile";
import { parseRosterEventType } from "@/lib/roster-events";
import { postMediaEvent, readMediaTrigger } from "@/lib/media/media-space";
import { recomputeAll } from "@/lib/notoriety";
import type { PlayerStatus } from "@/generated/prisma/enums";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/** Update a player's profile info (bio, structured header fields, PNG). */
export async function updatePlayerProfile(formData: FormData) {
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const clean = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const posInt = (k: string): number | null => {
    const v = String(formData.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
  };

  // Height entered as feet + inches, stored as total inches.
  const feet = posInt("heightFeet");
  const inch = posInt("heightInch");
  const heightInches =
    feet != null || inch != null ? (feet ?? 0) * 12 + (inch ?? 0) : null;

  // A graduated/transferred player is POSTACTIVE regardless of what was picked.
  const latest = await db.seasonPlayer.findFirst({
    where: { playerId },
    orderBy: { seasonRoster: { season: { startYear: "desc" } } },
    select: { class: true, seasonRoster: { select: { seasonId: true } } },
  });
  const isPostByClass = latest?.class === "GRADUATED" || latest?.class === "TRANSFERRED";
  const status: PlayerStatus = isPostByClass ? "POSTACTIVE" : parseStatus(formData.get("status"));

  const data: {
    bio: string | null;
    awards: string | null;
    notableEvents: string | null;
    heightInches: number | null;
    weightLbs: number | null;
    hometown: string | null;
    status: PlayerStatus;
    injuryDetails: string | null;
    photo?: Uint8Array<ArrayBuffer> | null;
  } = {
    bio: clean("bio"),
    awards: clean("awards"),
    notableEvents: clean("notableEvents"),
    heightInches,
    weightLbs: posInt("weightLbs"),
    hometown: clean("hometown"),
    status,
    // Injury note only means anything while INJURED.
    injuryDetails: status === "INJURED" ? clean("injuryDetails") : null,
  };

  if (formData.get("removePhoto")) {
    data.photo = null;
  } else {
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      if (file.type !== "image/png") throw new Error("Photo must be a PNG.");
      if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 5MB.");
      data.photo = new Uint8Array(await file.arrayBuffer());
    }
  }

  // Name is the player's identity and is denormalized onto every SeasonPlayer.
  // playerName, so a rename must sync all of them (and stay globally unique, since
  // roster imports dedupe players by name). Do it atomically with the profile save.
  await db.$transaction(async (tx) => {
    const current = await tx.player.findUnique({ where: { id: playerId }, select: { name: true } });
    if (current && current.name !== name) {
      const clash = await tx.player.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: playerId } },
        select: { id: true },
      });
      if (clash) throw new Error(`Another player is already named "${name}".`);
      await tx.seasonPlayer.updateMany({ where: { playerId }, data: { playerName: name } });
    }
    await tx.player.update({ where: { id: playerId }, data: { ...data, name } });
  });

  // A player update can shift baselines/records program-wide — recompute everyone.
  after(() => recomputeAll());

  // Optionally post a player-update event to the mediaSpace (writes in background).
  const trigger = readMediaTrigger(formData);
  if (trigger) {
    await postMediaEvent({
      type: "PLAYER_UPDATE",
      scope: "PLAYER",
      playerId,
      context: trigger.context,
      personaIds: trigger.personaIds,
    });
    revalidatePath("/media");
  }

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/players");

  // "Done" (save & exit) sends `_exit`; leave edit mode. "Save" omits it and stays.
  if (formData.get("_exit")) redirect(`/players/${playerId}`);
}

/** Add a manual notoriety event (description + points) to a player. */
export async function addNotorietyEvent(formData: FormData) {
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Describe the event.");
  const raw = Number(formData.get("points") ?? 0);
  if (!Number.isFinite(raw)) throw new Error("Points must be a number.");
  const points = Math.max(0, Math.trunc(raw));

  await db.notorietyEvent.create({ data: { playerId, description, points } });
  after(() => recomputeAll());
  revalidatePath(`/players/${playerId}`);
}

/** Remove a manual notoriety event. */
export async function deleteNotorietyEvent(formData: FormData) {
  const id = Number(formData.get("id"));
  const playerId = Number(formData.get("playerId"));
  if (![id, playerId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.notorietyEvent.delete({ where: { id } });
  after(() => recomputeAll());
  revalidatePath(`/players/${playerId}`);
}

/** Add a roster-history event (transfer in/out, starter change, note) by hand. */
export async function addRosterEvent(formData: FormData) {
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");
  const type = parseRosterEventType(formData.get("type"));
  const seasonRaw = Number(formData.get("seasonId"));
  const seasonId = Number.isInteger(seasonRaw) && seasonRaw > 0 ? seasonRaw : null;
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  await db.playerRosterEvent.create({
    data: { playerId, type, seasonId, counterparty, note },
  });
  revalidatePath(`/players/${playerId}`);
}

/** Remove a roster-history event. */
export async function deleteRosterEvent(formData: FormData) {
  const id = Number(formData.get("id"));
  const playerId = Number(formData.get("playerId"));
  if (![id, playerId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.playerRosterEvent.delete({ where: { id } });
  revalidatePath(`/players/${playerId}`);
}
