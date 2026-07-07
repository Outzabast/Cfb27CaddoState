"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isValidClass } from "@/lib/classes";
import { parseRosterRows } from "@/lib/roster-import";
import { attachPlayerToRoster } from "@/lib/player-roster";
import { recomputeAll } from "@/lib/notoriety";
import type { PlayerClass } from "@/generated/prisma/enums";

const MAX_POSITION_LEN = 8;

function parsePosition(formData: FormData): string {
  const position = String(formData.get("position") ?? "").trim();
  if (!position) throw new Error("Position is required.");
  if (position.length > MAX_POSITION_LEN) {
    throw new Error(`Position must be ${MAX_POSITION_LEN} characters or fewer.`);
  }
  return position;
}

function parseNumber(formData: FormData): number | null {
  const raw = String(formData.get("number") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error("Number must be a whole number.");
  return n;
}

function parseClass(formData: FormData): PlayerClass {
  const value = String(formData.get("class") ?? "");
  if (!isValidClass(value)) throw new Error(`Invalid class: ${value}`);
  return value;
}

/** Add a player to this season's roster, reusing an existing player by name. */
export async function addPlayerToRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const position = parsePosition(formData);
  const playerClass = parseClass(formData);
  const number = parseNumber(formData);

  const rosterId = await getRosterId(seasonId);
  await db.$transaction((tx) =>
    attachPlayerToRoster(tx, rosterId, { name, position, class: playerClass, number }),
  );

  revalidatePath(`/seasons/${seasonId}/roster`);
}

/** Create players from a season's roster upsert + return the roster id. */
async function getRosterId(seasonId: number): Promise<number> {
  const roster = await db.seasonRoster.upsert({
    where: { seasonId },
    create: { seasonId },
    update: {},
  });
  return roster.id;
}

/**
 * Bulk-add players to a roster. Each row reuses an existing player by name (so a
 * player already on this roster is skipped, and one that exists in another season
 * is linked rather than duplicated). De-duplicates names within the batch too.
 */
async function createPlayers(
  seasonId: number,
  rosterId: number,
  rows: { name: string; position: string; class: PlayerClass; number: number | null }[],
) {
  // Collapse duplicate names within this import (first occurrence wins).
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = r.name.toLowerCase();
    return seen.has(key) ? false : seen.add(key);
  });

  if (unique.length > 0) {
    await db.$transaction(async (tx) => {
      for (const r of unique) await attachPlayerToRoster(tx, rosterId, r);
    });
  }
  revalidatePath(`/seasons/${seasonId}/roster`);
}

/**
 * Add several players entered as rows in the Add Player card. Each row supplies
 * name / number / position / class (aligned by index via getAll). Blank rows are
 * ignored; names already on this roster are skipped.
 */
export async function addPlayersToRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");

  const names = formData.getAll("name").map((v) => String(v).trim());
  const numbers = formData.getAll("number").map((v) => String(v).trim());
  const positions = formData.getAll("position").map((v) => String(v).trim());
  const classes = formData.getAll("class").map((v) => String(v));

  const errors: string[] = [];
  const rows: { name: string; position: string; class: PlayerClass; number: number | null }[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i] ?? "";
    if (!name) continue; // ignore blank rows
    const position = positions[i] ?? "";
    const cls = classes[i] ?? "";
    const numRaw = numbers[i] ?? "";
    const row = i + 1;

    if (!position) errors.push(`Row ${row}: position is required`);
    else if (position.length > MAX_POSITION_LEN) {
      errors.push(`Row ${row}: position must be ${MAX_POSITION_LEN} characters or fewer`);
    }
    if (!isValidClass(cls)) errors.push(`Row ${row}: choose a class`);

    let number: number | null = null;
    if (numRaw) {
      const n = Number(numRaw);
      if (!Number.isInteger(n)) errors.push(`Row ${row}: number must be a whole number`);
      else number = n;
    }

    if (name && position && position.length <= MAX_POSITION_LEN && isValidClass(cls)) {
      rows.push({ name, position, class: cls, number });
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  if (rows.length === 0) throw new Error("Enter at least one player.");

  await createPlayers(seasonId, await getRosterId(seasonId), rows);
}

/**
 * Import players from an uploaded CSV file. Each row creates a new player + season
 * entry. Names already on this season's roster are skipped, so re-importing the
 * same file is safe.
 */
export async function bulkAddToRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a CSV file to import.");
  }

  const rows = parseRosterRows(await file.text()); // throws with line-numbered errors
  await createPlayers(seasonId, await getRosterId(seasonId), rows);
}

export type OcrRosterInput = {
  name: string;
  position: string;
  class: string;
  number: number | null;
};

/**
 * Commit reviewed OCR roster rows. Each row was already edited by the user in
 * the staging dialog; this validates and creates them, skipping names already
 * on the roster (same dedupe as CSV import).
 */
export async function commitOcrRoster(seasonId: number, rows: OcrRosterInput[]) {
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");
  if (!Array.isArray(rows)) throw new Error("No players to import.");

  const errors: string[] = [];
  const clean: { name: string; position: string; class: PlayerClass; number: number | null }[] = [];

  rows.forEach((r, i) => {
    const row = i + 1;
    const name = String(r?.name ?? "").trim();
    const position = String(r?.position ?? "").trim();
    const cls = String(r?.class ?? "");
    if (!name) return; // silently drop fully-blank rows
    if (!position) errors.push(`Row ${row} (${name}): position is required`);
    else if (position.length > MAX_POSITION_LEN) {
      errors.push(`Row ${row} (${name}): position must be ${MAX_POSITION_LEN} characters or fewer`);
    }
    if (!isValidClass(cls)) errors.push(`Row ${row} (${name}): choose a class`);

    let number: number | null = null;
    if (r?.number != null && r.number !== undefined) {
      const n = Number(r.number);
      if (!Number.isInteger(n)) errors.push(`Row ${row} (${name}): number must be a whole number`);
      else number = n;
    }

    if (name && position && position.length <= MAX_POSITION_LEN && isValidClass(cls)) {
      clean.push({ name, position, class: cls, number });
    }
  });

  if (errors.length) throw new Error(errors.join("\n"));
  if (clean.length === 0) throw new Error("No valid players to import.");

  await createPlayers(seasonId, await getRosterId(seasonId), clean);
}

/** Save one roster row: the player's position, class, and number FOR THIS SEASON. */
export async function updateSeasonPlayer(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const seasonPlayerId = Number(formData.get("seasonPlayerId"));
  if (![seasonId, seasonPlayerId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.seasonPlayer.update({
    where: { id: seasonPlayerId },
    data: {
      position: parsePosition(formData),
      class: parseClass(formData),
      number: parseNumber(formData),
      isStarter: formData.get("isStarter") != null,
    },
  });

  // Starter/class shifts baselines and records — recompute every player.
  after(() => recomputeAll());
  revalidatePath(`/seasons/${seasonId}/roster`);
}

/**
 * Remove a player from this season's roster. Keeps the player if they're on
 * another season's roster or have any recorded stats; otherwise deletes the now
 * fully-orphaned player so it can't linger and be re-created as a duplicate.
 */
export async function removeFromRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const seasonPlayerId = Number(formData.get("seasonPlayerId"));
  if (![seasonId, seasonPlayerId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.$transaction(async (tx) => {
    const sp = await tx.seasonPlayer.findUnique({
      where: { id: seasonPlayerId },
      select: { playerId: true },
    });
    if (!sp) return;

    await tx.seasonPlayer.delete({ where: { id: seasonPlayerId } });

    const remainingRosters = await tx.seasonPlayer.count({
      where: { playerId: sp.playerId },
    });
    const statLines = await tx.gamePlayerStat.count({
      where: { playerId: sp.playerId },
    });
    if (remainingRosters === 0 && statLines === 0) {
      await tx.player.delete({ where: { id: sp.playerId } });
    }
  });

  revalidatePath(`/seasons/${seasonId}/roster`);
}
