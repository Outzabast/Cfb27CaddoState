"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isValidLocation } from "@/lib/classes";
import type { GameLocation } from "@/generated/prisma/enums";

function parseOpponent(formData: FormData): string {
  const opponent = String(formData.get("opponent") ?? "").trim();
  if (!opponent) throw new Error("Opponent is required.");
  return opponent;
}

function parseLocation(formData: FormData): GameLocation {
  const value = String(formData.get("location") ?? "HOME");
  if (!isValidLocation(value)) throw new Error(`Invalid location: ${value}`);
  return value;
}

function parseOptionalInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`${key} must be a whole number.`);
  return n;
}

function parseDate(formData: FormData): Date | null {
  const raw = String(formData.get("date") ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date.");
  return d;
}

/** Add a game to this season's schedule. */
export async function createGame(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");

  await db.game.create({
    data: {
      seasonId,
      week: parseOptionalInt(formData, "week"),
      date: parseDate(formData),
      opponent: parseOpponent(formData),
      location: parseLocation(formData),
      teamPoints: parseOptionalInt(formData, "teamPoints") ?? 0,
      oppPoints: parseOptionalInt(formData, "oppPoints") ?? 0,
    },
  });

  revalidatePath(`/seasons/${seasonId}/schedule`);
}

/**
 * Update a scheduled game: its matchup details and (as the season goes on) the
 * final score. Leaving both scores blank keeps it 0-0 / unplayed.
 */
export async function updateGame(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const gameId = Number(formData.get("gameId"));
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.game.update({
    where: { id: gameId },
    data: {
      week: parseOptionalInt(formData, "week"),
      date: parseDate(formData),
      opponent: parseOpponent(formData),
      location: parseLocation(formData),
      teamPoints: parseOptionalInt(formData, "teamPoints") ?? 0,
      oppPoints: parseOptionalInt(formData, "oppPoints") ?? 0,
    },
  });

  revalidatePath(`/seasons/${seasonId}/schedule`);
}

export async function deleteGame(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const gameId = Number(formData.get("gameId"));
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.game.delete({ where: { id: gameId } });
  revalidatePath(`/seasons/${seasonId}/schedule`);
}
