"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isValidClass } from "@/lib/classes";
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

/** Create a brand-new player and put them on this season's roster. */
export async function addPlayerToRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const position = parsePosition(formData);
  const playerClass = parseClass(formData);
  const number = parseNumber(formData);

  await db.player.create({
    data: {
      name,
      position,
      class: playerClass,
      rosterEntries: { create: { seasonId, number } },
    },
  });

  revalidatePath(`/seasons/${seasonId}/roster`);
}

/**
 * Save one roster row: the player's position and class (current state on the
 * player), plus the per-season jersey number on the roster entry.
 */
export async function updateRosterEntry(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const entryId = Number(formData.get("entryId"));
  const playerId = Number(formData.get("playerId"));
  if (![seasonId, entryId, playerId].every(Number.isInteger)) {
    throw new Error("Bad ids.");
  }

  const position = parsePosition(formData);
  const playerClass = parseClass(formData);
  const number = parseNumber(formData);

  await db.$transaction([
    db.player.update({
      where: { id: playerId },
      data: { position, class: playerClass },
    }),
    db.rosterEntry.update({ where: { id: entryId }, data: { number } }),
  ]);

  revalidatePath(`/seasons/${seasonId}/roster`);
}

/** Remove a player from this season's roster (keeps the player record). */
export async function removeFromRoster(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const entryId = Number(formData.get("entryId"));
  if (![seasonId, entryId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.rosterEntry.delete({ where: { id: entryId } });
  revalidatePath(`/seasons/${seasonId}/roster`);
}
