"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { postMediaEvent, readIdList } from "@/lib/media/media-space";
import { parseRecruitStatus, parseRecruitKind, parseStars, formatHometown } from "@/lib/recruits";
import { recordRosterEvent } from "@/lib/roster-events";
import { isValidClass } from "@/lib/classes";
import type { PlayerClass } from "@/generated/prisma/enums";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

/** Optional integer field: null when blank/invalid. */
function optInt(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? n : null;
}

/** Parse a height into inches from `6'2"`, `6-2`, `6 2`, or a plain inch count. */
function parseHeightInches(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*['\-\s]\s*(\d+)/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Composite rating parsed to 0–1 (accepts "0.9421" or "94.21"). */
function parseRating(raw: string | null): number | null {
  if (!raw) return null;
  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 1) n = n / 100; // tolerate a 0–100 entry
  return Math.min(1, Math.max(0, n));
}

async function readPhoto(fd: FormData): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.type !== "image/png") throw new Error("Photo must be a PNG.");
    if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 5MB.");
    return new Uint8Array(await file.arrayBuffer());
  }
  return undefined;
}

type RecruitData = {
  seasonId: number;
  name: string;
  position: string;
  heightInches: number | null;
  weightLbs: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  highSchool: string | null;
  stars: number;
  rating: number | null;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  status: ReturnType<typeof parseRecruitStatus>;
  kind: ReturnType<typeof parseRecruitKind>;
  previousSchool: string | null;
  eligibilityYears: number | null;
  otherOffers: string | null;
  bio: string | null;
  notes: string | null;
};

function readRecruit(fd: FormData): RecruitData {
  const seasonId = Number(fd.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Pick a recruiting class (season).");
  const name = str(fd, "name");
  if (!name) throw new Error("Give the recruit a name.");
  const position = str(fd, "position");
  if (!position) throw new Error("Give the recruit a position.");

  return {
    seasonId,
    name,
    position: position.slice(0, 8),
    heightInches: parseHeightInches(str(fd, "height")),
    weightLbs: optInt(fd, "weightLbs"),
    hometownCity: str(fd, "hometownCity"),
    hometownState: str(fd, "hometownState"),
    highSchool: str(fd, "highSchool"),
    stars: parseStars(fd.get("stars")),
    rating: parseRating(str(fd, "rating")),
    nationalRank: optInt(fd, "nationalRank"),
    positionRank: optInt(fd, "positionRank"),
    stateRank: optInt(fd, "stateRank"),
    status: parseRecruitStatus(fd.get("status")),
    kind: parseRecruitKind(fd.get("kind")),
    previousSchool: str(fd, "previousSchool"),
    eligibilityYears: optInt(fd, "eligibilityYears"),
    otherOffers: str(fd, "otherOffers"),
    bio: str(fd, "bio"),
    notes: str(fd, "notes"),
  };
}

/** Create a recruit and go to their profile. */
export async function createRecruit(formData: FormData) {
  const data = readRecruit(formData);
  const photo = await readPhoto(formData);
  const recruit = await db.recruit.create({
    data: { ...data, ...(photo ? { photo } : {}) },
    select: { id: true },
  });
  revalidatePath("/recruits");
  redirect(`/recruits/${recruit.id}`);
}

/** Update a recruit's scouting fields (and optionally their photo). */
export async function updateRecruit(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad recruit id.");
  const data = readRecruit(formData);
  const photo = await readPhoto(formData);

  await db.recruit.update({
    where: { id },
    data: {
      ...data,
      ...(formData.get("removePhoto") ? { photo: null } : photo ? { photo } : {}),
    },
  });
  revalidatePath("/recruits");
  revalidatePath(`/recruits/${id}`);
}

/** Delete a recruit (cascades its recruiting media). */
export async function deleteRecruit(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad recruit id.");
  await db.recruit.delete({ where: { id } });
  revalidatePath("/recruits");
  redirect("/recruits");
}

/**
 * Sign a recruit: they become a Player who's played for the school. Creates the
 * Player (from the recruit's identity), adds a SeasonPlayer on the chosen season's
 * roster, and links the recruit to that player. The recruit row stays as history.
 */
export async function signRecruit(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad recruit id.");
  const enrollSeasonId = Number(formData.get("enrollSeasonId"));
  if (!Number.isInteger(enrollSeasonId)) throw new Error("Pick the season to add them to.");

  const classRaw = String(formData.get("class") ?? "FRESHMAN");
  const playerClass: PlayerClass = isValidClass(classRaw) ? classRaw : "FRESHMAN";
  const number = optInt(formData, "number");

  const recruit = await db.recruit.findUnique({ where: { id } });
  if (!recruit) throw new Error("Recruit not found.");
  if (recruit.playerId) throw new Error("This recruit has already signed.");

  await db.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        name: recruit.name,
        heightInches: recruit.heightInches,
        weightLbs: recruit.weightLbs,
        hometown: formatHometown(recruit.hometownCity, recruit.hometownState),
        bio: recruit.bio,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    });

    const roster = await tx.seasonRoster.upsert({
      where: { seasonId: enrollSeasonId },
      create: { seasonId: enrollSeasonId },
      update: {},
      select: { id: true },
    });

    await tx.seasonPlayer.create({
      data: {
        seasonRosterId: roster.id,
        playerId: player.id,
        playerName: player.name,
        position: recruit.position.slice(0, 8),
        class: playerClass,
        number,
        isStarter: false,
      },
    });

    await tx.recruit.update({
      where: { id },
      data: { playerId: player.id, status: "ENROLLED" },
    });

    await recordRosterEvent(tx, {
      playerId: player.id,
      seasonId: enrollSeasonId,
      type: recruit.kind === "TRANSFER" ? "JOINED_TRANSFER" : "JOINED_RECRUIT",
      counterparty: recruit.kind === "TRANSFER" ? recruit.previousSchool : null,
    });
  });

  revalidatePath("/recruits");
  revalidatePath(`/recruits/${id}`);
  revalidatePath("/players");
}

export type OcrRecruitInput = {
  name: string;
  position: string;
  kind: "HIGH_SCHOOL" | "TRANSFER";
  stars: number | null;
  nationalRank: number | null;
  stateRank: number | null;
  positionRank: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  previousSchool: string | null;
  signed: boolean;
};

/**
 * Commit reviewed OCR recruits into a recruiting class (season). Signed prospects
 * come in as SIGNED (so the offseason can enroll them); the rest as TARGET. Skips
 * names already on that class's board.
 */
export async function commitOcrRecruits(seasonId: number, rows: OcrRecruitInput[]) {
  if (!Number.isInteger(seasonId)) throw new Error("Pick a recruiting class first.");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("No recruits to import.");

  const existing = await db.recruit.findMany({ where: { seasonId }, select: { name: true } });
  const seen = new Set(existing.map((r) => r.name.trim().toLowerCase()));

  const data = rows
    .map((r) => ({
      seasonId,
      name: String(r.name ?? "").trim(),
      position: String(r.position ?? "").trim().slice(0, 8) || "ATH",
      kind: r.kind === "TRANSFER" ? ("TRANSFER" as const) : ("HIGH_SCHOOL" as const),
      stars: Number.isInteger(r.stars) ? Math.min(5, Math.max(0, r.stars as number)) : 0,
      nationalRank: Number.isInteger(r.nationalRank) ? r.nationalRank : null,
      stateRank: Number.isInteger(r.stateRank) ? r.stateRank : null,
      positionRank: Number.isInteger(r.positionRank) ? r.positionRank : null,
      heightInches: Number.isInteger(r.heightInches) ? r.heightInches : null,
      weightLbs: Number.isInteger(r.weightLbs) ? r.weightLbs : null,
      hometownCity: r.hometownCity?.trim() || null,
      hometownState: r.hometownState?.trim() || null,
      previousSchool: r.previousSchool?.trim() || null,
      status: r.signed ? ("SIGNED" as const) : ("TARGET" as const),
    }))
    .filter((r) => {
      const key = r.name.toLowerCase();
      if (!r.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (data.length === 0) throw new Error("No new recruits to import (all already on this class's board).");

  await db.recruit.createMany({ data });
  revalidatePath("/recruits");
}

/** Fire off a recruiting profile for this recruit, in the chosen persona voices. */
export async function generateRecruitMedia(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad recruit id.");
  const context = String(formData.get("mediaContext") ?? "").trim() || null;

  await postMediaEvent({
    type: "MANUAL",
    scope: "RECRUIT",
    angle: "recruiting",
    mediaType: "ARTICLE",
    recruitId: id,
    context,
    personaIds: readIdList(formData, "mediaPersonaId"),
  });
  revalidatePath("/media");
  revalidatePath("/media/space");
}
