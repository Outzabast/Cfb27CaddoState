"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  parseStats,
} from "@/lib/stat-fields";

function baseIds(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const gameId = Number(formData.get("gameId"));
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  return { seasonId, gameId, path: `/seasons/${seasonId}/schedule/${gameId}/box-score` };
}

/** Create or replace this game's team stat totals. */
export async function upsertTeamStats(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const data = parseStats(formData, TEAM_STAT_GROUPS);

  await db.gameTeamStat.upsert({
    where: { gameId },
    create: { gameId, ...data },
    update: data,
  });

  revalidatePath(path);
}

/** Create or replace one player's stat line for this game. */
export async function upsertPlayerStat(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Pick a player.");

  const data = parseStats(formData, PLAYER_STAT_GROUPS);

  await db.gamePlayerStat.upsert({
    where: { gameId_playerId: { gameId, playerId } },
    create: { gameId, playerId, ...data },
    update: data,
  });

  revalidatePath(path);
  // Return to a clean "add" form (drops any ?player= edit selection).
  redirect(path);
}

export async function deletePlayerStat(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");

  await db.gamePlayerStat.delete({
    where: { gameId_playerId: { gameId, playerId } },
  });

  revalidatePath(path);
}
