"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isValidLocation } from "@/lib/classes";
import { recomputeAllSentiment } from "@/lib/sentiment";
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

/** Week is optional but, when set, must be 0-20. */
function parseWeek(formData: FormData): number | null {
  const week = parseOptionalInt(formData, "week");
  if (week !== null && (week < 0 || week > 20)) {
    throw new Error("Week must be between 0 and 20.");
  }
  return week;
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
      week: parseWeek(formData),
      date: parseDate(formData),
      opponent: parseOpponent(formData),
      location: parseLocation(formData),
      isConference: formData.get("isConference") != null,
      teamPoints: parseOptionalInt(formData, "teamPoints") ?? 0,
      oppPoints: parseOptionalInt(formData, "oppPoints") ?? 0,
    },
  });

  after(() => recomputeAllSentiment());
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

  // Score is managed by the scoreboard (quarters) on the box-score page, so this
  // only updates matchup details and never overwrites the score.
  await db.game.update({
    where: { id: gameId },
    data: {
      week: parseWeek(formData),
      date: parseDate(formData),
      opponent: parseOpponent(formData),
      location: parseLocation(formData),
      isConference: formData.get("isConference") != null,
    },
  });

  revalidatePath(`/seasons/${seasonId}/schedule`);
}

export type OcrGameInput = {
  week: number | null;
  date: string | null;
  opponent: string;
  location: string;
  teamPoints: number | null;
  oppPoints: number | null;
};

/**
 * Commit reviewed OCR schedule rows. Skips games that would duplicate one
 * already on the schedule — matched by week (when set) or by opponent name.
 */
export async function commitOcrGames(seasonId: number, rows: OcrGameInput[]) {
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");
  if (!Array.isArray(rows)) throw new Error("No games to import.");

  const existing = await db.game.findMany({
    where: { seasonId },
    select: { week: true, opponent: true },
  });
  const seenWeeks = new Set<number>();
  const seenOpponents = new Set<string>();
  for (const g of existing) {
    if (g.week != null) seenWeeks.add(g.week);
    seenOpponents.add(g.opponent.toLowerCase());
  }

  const errors: string[] = [];
  const toCreate: {
    seasonId: number;
    week: number | null;
    date: Date | null;
    opponent: string;
    location: GameLocation;
    teamPoints: number;
    oppPoints: number;
  }[] = [];

  rows.forEach((r, i) => {
    const row = i + 1;
    const opponent = String(r?.opponent ?? "").trim();
    if (!opponent) return; // drop blank rows

    let week = r?.week ?? null;
    if (week !== null) {
      if (!Number.isInteger(week) || week < 0 || week > 20) {
        errors.push(`Row ${row} (${opponent}): week must be 0–20`);
        week = null;
      }
    }
    const location = String(r?.location ?? "HOME");
    if (!isValidLocation(location)) {
      errors.push(`Row ${row} (${opponent}): invalid location`);
      return;
    }
    let date: Date | null = null;
    if (r?.date) {
      const d = new Date(r.date);
      if (!Number.isNaN(d.getTime())) date = d;
    }

    // Skip duplicates (against existing games and earlier rows in this batch).
    if (week !== null && seenWeeks.has(week)) return;
    if (seenOpponents.has(opponent.toLowerCase())) return;
    if (week !== null) seenWeeks.add(week);
    seenOpponents.add(opponent.toLowerCase());

    toCreate.push({
      seasonId,
      week,
      date,
      opponent,
      location,
      teamPoints: r?.teamPoints ?? 0,
      oppPoints: r?.oppPoints ?? 0,
    });
  });

  if (errors.length) throw new Error(errors.join("\n"));
  if (toCreate.length === 0) throw new Error("No new games to import.");

  await db.$transaction(toCreate.map((data) => db.game.create({ data })));
  after(() => recomputeAllSentiment());
  revalidatePath(`/seasons/${seasonId}/schedule`);
}

export async function deleteGame(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const gameId = Number(formData.get("gameId"));
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.game.delete({ where: { id: gameId } });
  after(() => recomputeAllSentiment());
  revalidatePath(`/seasons/${seasonId}/schedule`);
}
