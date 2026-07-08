"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recomputeGame } from "@/lib/notoriety";
import { PLAYER_STAT_GROUPS, parseStats } from "@/lib/stat-fields";

/** Save edits to one game stat line's full stat set (the reconcile editor). */
export async function updateStatLine(formData: FormData) {
  const statId = Number(formData.get("statId"));
  if (!Number.isInteger(statId)) throw new Error("Bad stat line id.");

  const data = parseStats(formData, PLAYER_STAT_GROUPS);
  const line = await db.gamePlayerStat.update({
    where: { id: statId },
    data,
    select: { gameId: true, playerId: true },
  });

  after(() => recomputeGame(line.gameId));
  revalidatePath("/players/reconcile");
  revalidatePath(`/players/${line.playerId}`);
}

/**
 * Move a game stat line from the player it's wrongly attributed to onto the
 * correct one — the fix for OCR mis-assignment (e.g. an LB's line landed on a
 * same-surname RB). Guards the one-line-per-player-per-game rule.
 */
export async function reassignStatLine(formData: FormData) {
  const statId = Number(formData.get("statId"));
  const targetPlayerId = Number(formData.get("targetPlayerId"));
  if (!Number.isInteger(statId)) throw new Error("Bad stat line id.");
  if (!Number.isInteger(targetPlayerId)) throw new Error("Pick a player to move this line to.");

  const line = await db.gamePlayerStat.findUnique({
    where: { id: statId },
    select: { gameId: true, playerId: true },
  });
  if (!line) throw new Error("Stat line not found.");
  if (line.playerId === targetPlayerId) throw new Error("That line is already this player's.");

  const conflict = await db.gamePlayerStat.findUnique({
    where: { gameId_playerId: { gameId: line.gameId, playerId: targetPlayerId } },
    select: { id: true },
  });
  if (conflict) {
    throw new Error(
      "That player already has a stat line in this game. Delete one of them first, then reassign.",
    );
  }

  await db.gamePlayerStat.update({ where: { id: statId }, data: { playerId: targetPlayerId } });

  // Who has stats in the game changed → refresh notoriety.
  after(() => recomputeGame(line.gameId));
  revalidatePath("/players/reconcile");
  revalidatePath(`/players/${line.playerId}`);
  revalidatePath(`/players/${targetPlayerId}`);
}

/** Delete a stat line outright (by id) — for a bogus OCR line that's nobody's. */
export async function deleteStatLine(formData: FormData) {
  const statId = Number(formData.get("statId"));
  if (!Number.isInteger(statId)) throw new Error("Bad stat line id.");

  const line = await db.gamePlayerStat.findUnique({
    where: { id: statId },
    select: { gameId: true, playerId: true },
  });
  if (!line) return;

  await db.gamePlayerStat.delete({ where: { id: statId } });

  after(() => recomputeGame(line.gameId));
  revalidatePath("/players/reconcile");
  revalidatePath(`/players/${line.playerId}`);
}
