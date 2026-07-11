"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isValidClass } from "@/lib/classes";
import { attachPlayerToRoster } from "@/lib/player-roster";
import { postMediaEvent, readIdList } from "@/lib/media/media-space";
import { recomputeGame, recomputeStaffAll } from "@/lib/notoriety";
import { writeGameSummary } from "@/lib/media/game-summary";
import { playMergeKey } from "@/lib/play-by-play";
import { recomputeAllSentiment } from "@/lib/sentiment";
import type { PlayerClass } from "@/generated/prisma/enums";
import { SCOREBOARD_FIELDS, type OcrScoreboard } from "@/lib/ocr/kinds";
import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  parseStats,
  type StatGroup,
} from "@/lib/stat-fields";

/** Keep only known, non-negative stat fields from an untrusted OCR payload. */
function pickStats(input: unknown, groups: StatGroup[]): Record<string, number> {
  const rec = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const g of groups) {
    for (const f of g.fields) {
      const v = rec[f.name];
      if (v == null) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      out[f.name] = f.float ? n : Math.trunc(n);
    }
  }
  return out;
}

function baseIds(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const gameId = Number(formData.get("gameId"));
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  return { seasonId, gameId, path: `/seasons/${seasonId}/schedule/${gameId}/box-score` };
}

/** Save the quarter-by-quarter score and set the Final = sum of quarters + OT. */
export async function updateScoreboard(formData: FormData) {
  const { seasonId, gameId, path } = baseIds(formData);

  const q = (name: string): number => {
    const n = Number(formData.get(name) ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be 0 or more.`);
    return n;
  };

  const teamQ1 = q("teamQ1"), teamQ2 = q("teamQ2"), teamQ3 = q("teamQ3"),
    teamQ4 = q("teamQ4"), teamOt = q("teamOt");
  const oppQ1 = q("oppQ1"), oppQ2 = q("oppQ2"), oppQ3 = q("oppQ3"),
    oppQ4 = q("oppQ4"), oppOt = q("oppOt");

  await db.game.update({
    where: { id: gameId },
    data: {
      teamQ1, teamQ2, teamQ3, teamQ4, teamOt,
      oppQ1, oppQ2, oppQ3, oppQ4, oppOt,
      teamPoints: teamQ1 + teamQ2 + teamQ3 + teamQ4 + teamOt,
      oppPoints: oppQ1 + oppQ2 + oppQ3 + oppQ4 + oppOt,
    },
  });

  // Record + points scored/allowed drive staff notoriety and fan sentiment.
  after(() => recomputeStaffAll());
  after(() => recomputeAllSentiment());
  revalidatePath(path);
  revalidatePath(`/seasons/${seasonId}/schedule`);
}

/** Create or replace this game's team stat totals (Caddo State). */
export async function upsertTeamStats(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const data = parseStats(formData, TEAM_STAT_GROUPS);

  await db.gameTeamStat.upsert({
    where: { gameId },
    create: { gameId, ...data },
    update: data,
  });

  after(() => recomputeStaffAll()); // offense output → OC notoriety
  revalidatePath(path);
}

/** Create or replace this game's OPPONENT team stat totals (yards/points given up). */
export async function upsertOppStats(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const data = parseStats(formData, TEAM_STAT_GROUPS);

  await db.gameOppStat.upsert({
    where: { gameId },
    create: { gameId, ...data },
    update: data,
  });

  after(() => recomputeStaffAll()); // yards allowed → DC notoriety
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

  after(() => recomputeGame(gameId));
  revalidatePath(path);
  // Return to a clean "add" form (drops any ?player= edit selection) while
  // staying in edit mode.
  redirect(`${path}?mode=edit`);
}

/** Create or replace one player's stat line, staying put (for the dialog editor —
 *  the caller closes the dialog + refreshes; no redirect). */
export async function upsertPlayerStatLine(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Pick a player.");

  const data = parseStats(formData, PLAYER_STAT_GROUPS);
  await db.gamePlayerStat.upsert({
    where: { gameId_playerId: { gameId, playerId } },
    create: { gameId, playerId, ...data },
    update: data,
  });

  after(() => recomputeGame(gameId));
  revalidatePath(path);
}

/**
 * Add all-zero stat lines for every rostered player who doesn't already have one
 * in this game. Lets you record the handful of players who did something and then
 * fill in the rest of the roster at 0 with a single click.
 */
export async function zeroOutRoster(formData: FormData) {
  const { seasonId, gameId, path } = baseIds(formData);

  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    select: { playerId: true },
  });
  const existing = await db.gamePlayerStat.findMany({
    where: { gameId },
    select: { playerId: true },
  });
  const have = new Set(existing.map((e) => e.playerId));

  const toAdd = roster
    .filter((r) => !have.has(r.playerId))
    .map((r) => ({ gameId, playerId: r.playerId })); // all stats default to 0

  if (toAdd.length) await db.gamePlayerStat.createMany({ data: toAdd });
  after(() => recomputeGame(gameId));
  revalidatePath(path);
}

const MAX_POSITION_LEN = 8;

/**
 * Commit a box score's team totals and (optionally) the quarter-by-quarter
 * score, gathered from one or more screenshots and reviewed by the user. When
 * `scoreboard` is null the game's score is left untouched.
 */
export async function commitOcrBoxScore(
  seasonId: number,
  gameId: number,
  stats: Record<string, number>,
  oppStats: Record<string, number>,
  scoreboard: OcrScoreboard | null,
) {
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  const path = `/seasons/${seasonId}/schedule/${gameId}/box-score`;

  const teamData = pickStats(stats, TEAM_STAT_GROUPS);
  await db.gameTeamStat.upsert({
    where: { gameId },
    create: { gameId, ...teamData },
    update: teamData,
  });

  // Opponent team totals (only when something was read).
  const oppData = pickStats(oppStats, TEAM_STAT_GROUPS);
  if (Object.keys(oppData).length > 0) {
    await db.gameOppStat.upsert({
      where: { gameId },
      create: { gameId, ...oppData },
      update: oppData,
    });
  }
  after(() => recomputeStaffAll());

  if (scoreboard && SCOREBOARD_FIELDS.some((f) => scoreboard[f] != null)) {
    const q = (f: keyof OcrScoreboard) => {
      const n = Number(scoreboard[f] ?? 0);
      return Number.isInteger(n) && n >= 0 ? n : 0;
    };
    const teamQ1 = q("teamQ1"), teamQ2 = q("teamQ2"), teamQ3 = q("teamQ3"),
      teamQ4 = q("teamQ4"), teamOt = q("teamOt");
    const oppQ1 = q("oppQ1"), oppQ2 = q("oppQ2"), oppQ3 = q("oppQ3"),
      oppQ4 = q("oppQ4"), oppOt = q("oppOt");
    await db.game.update({
      where: { id: gameId },
      data: {
        teamQ1, teamQ2, teamQ3, teamQ4, teamOt,
        oppQ1, oppQ2, oppQ3, oppQ4, oppOt,
        teamPoints: teamQ1 + teamQ2 + teamQ3 + teamQ4 + teamOt,
        oppPoints: oppQ1 + oppQ2 + oppQ3 + oppQ4 + oppOt,
      },
    });
    after(() => recomputeAllSentiment());
    revalidatePath(`/seasons/${seasonId}/schedule`);
  }

  revalidatePath(path);
}

export type OcrScoringPlayInput = {
  quarter: number | null;
  team: "team" | "opp";
  clock: string | null;
  description: string;
  points: number | null;
};

/** "mm:ss" → seconds (for ordering within a quarter, where the clock counts down);
 *  null/garbage sorts to the end of the quarter. */
function clockSeconds(clock: string | null): number {
  if (!clock) return -1;
  const m = clock.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

/**
 * Replace a game's scoring summary with the reviewed OCR plays, and optionally set
 * the quarter-by-quarter score (same as the box-score import). Plays are ordered
 * chronologically — quarter ascending, then game clock descending (it counts down).
 */
export async function commitOcrScoringSummary(
  seasonId: number,
  gameId: number,
  plays: OcrScoringPlayInput[],
  scoreboard: OcrScoreboard | null,
) {
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  const path = `/seasons/${seasonId}/schedule/${gameId}/box-score`;

  const cleaned = (Array.isArray(plays) ? plays : [])
    .map((p) => ({
      quarter: Number.isInteger(p?.quarter) ? (p.quarter as number) : 1,
      team: p?.team === "opp" ? ("OPP" as const) : ("TEAM" as const),
      clock: typeof p?.clock === "string" && /^\d{1,2}:\d{2}$/.test(p.clock) ? p.clock : null,
      description: String(p?.description ?? "").trim(),
      points: Number.isInteger(p?.points) && (p.points as number) >= 0 ? (p.points as number) : null,
    }))
    .filter((p) => p.description);

  cleaned.sort((a, b) => a.quarter - b.quarter || clockSeconds(b.clock) - clockSeconds(a.clock));

  await db.$transaction(async (tx) => {
    await tx.scoringPlay.deleteMany({ where: { gameId } });
    if (cleaned.length) {
      await tx.scoringPlay.createMany({
        data: cleaned.map((p, i) => ({
          gameId,
          quarter: p.quarter,
          team: p.team,
          clock: p.clock,
          description: p.description,
          points: p.points,
          sortOrder: i,
        })),
      });
    }
  });

  if (scoreboard && SCOREBOARD_FIELDS.some((f) => scoreboard[f] != null)) {
    const q = (f: keyof OcrScoreboard) => {
      const n = Number(scoreboard[f] ?? 0);
      return Number.isInteger(n) && n >= 0 ? n : 0;
    };
    const teamQ1 = q("teamQ1"), teamQ2 = q("teamQ2"), teamQ3 = q("teamQ3"),
      teamQ4 = q("teamQ4"), teamOt = q("teamOt");
    const oppQ1 = q("oppQ1"), oppQ2 = q("oppQ2"), oppQ3 = q("oppQ3"),
      oppQ4 = q("oppQ4"), oppOt = q("oppOt");
    await db.game.update({
      where: { id: gameId },
      data: {
        teamQ1, teamQ2, teamQ3, teamQ4, teamOt,
        oppQ1, oppQ2, oppQ3, oppQ4, oppOt,
        teamPoints: teamQ1 + teamQ2 + teamQ3 + teamQ4 + teamOt,
        oppPoints: oppQ1 + oppQ2 + oppQ3 + oppQ4 + oppOt,
      },
    });
    after(() => recomputeAllSentiment());
    after(() => recomputeStaffAll());
    revalidatePath(`/seasons/${seasonId}/schedule`);
  }

  revalidatePath(path);
}

export type OcrPlayInput = {
  quarter: number | null;
  clock: string | null;
  /** null = unknown → carried forward from the previous play. */
  team: "team" | "opp" | null;
  situation: string | null;
  description: string;
  playType?: string | null;
  points?: number | null;
  scoringTeam?: "team" | "opp" | null;
};

const PLAY_TYPES = new Set([
  "SCRIMMAGE", "TOUCHDOWN", "EXTRA_POINT", "EXTRA_POINT_MISSED", "TWO_POINT",
  "TWO_POINT_FAILED", "FIELD_GOAL", "FIELD_GOAL_MISSED", "SAFETY", "PUNT",
  "INTERCEPTION", "FUMBLE", "TURNOVER_ON_DOWNS", "KICKOFF", "PENALTY", "KNEEL",
  "END_PERIOD", "OTHER",
]);
type PlayTypeValue = "SCRIMMAGE" | "TOUCHDOWN" | "EXTRA_POINT" | "EXTRA_POINT_MISSED"
  | "TWO_POINT" | "TWO_POINT_FAILED" | "FIELD_GOAL" | "FIELD_GOAL_MISSED" | "SAFETY"
  | "PUNT" | "INTERCEPTION" | "FUMBLE" | "TURNOVER_ON_DOWNS" | "KICKOFF" | "PENALTY"
  | "KNEEL" | "END_PERIOD" | "OTHER";
/** OCR play-type string (any case) → the PlayType enum, defaulting to SCRIMMAGE. */
function toPlayType(v: unknown): PlayTypeValue {
  const up = String(v ?? "").toUpperCase();
  return (PLAY_TYPES.has(up) ? up : "SCRIMMAGE") as PlayTypeValue;
}
const toTeam = (v: unknown): "TEAM" | "OPP" | null =>
  v === "opp" || v === "OPP" ? "OPP" : v === "team" || v === "TEAM" ? "TEAM" : null;

/**
 * Replace a game's play-by-play with the reviewed OCR plays. Plays are ordered by
 * quarter then game clock (which counts down), so drives read correctly even when
 * quarters are uploaded out of order; possession is carried forward from the prior
 * play whenever the model couldn't tell whose ball it was; and the typed outcome /
 * points / scoring team are stored so the derived score doesn't rely on text.
 */
export async function commitOcrPlayByPlay(
  seasonId: number,
  gameId: number,
  plays: OcrPlayInput[],
  opts?: { generateSummary?: boolean; summaryPersonaId?: number | null },
) {
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  const path = `/seasons/${seasonId}/schedule/${gameId}/box-score`;

  const mapped = (Array.isArray(plays) ? plays : [])
    .map((p) => ({
      quarter: Number.isInteger(p?.quarter) ? (p.quarter as number) : 1,
      clock: typeof p?.clock === "string" && /^\d{1,2}:\d{2}$/.test(p.clock) ? p.clock : null,
      rawTeam: toTeam(p?.team),
      situation: String(p?.situation ?? "").trim() || null,
      description: String(p?.description ?? "").trim(),
      playType: toPlayType(p?.playType),
      points: Number.isInteger(p?.points) && (p!.points as number) >= 0 ? (p!.points as number) : 0,
      rawScoringTeam: toTeam(p?.scoringTeam),
    }))
    .filter((p) => p.description);

  // Quarter asc, then clock descending within the quarter (higher clock = earlier).
  // Stable, so plays sharing a timestamp keep their on-screen order.
  mapped.sort((a, b) => a.quarter - b.quarter || clockSeconds(b.clock) - clockSeconds(a.clock));

  // Merge plays the screenshots repeat: same period + clock + text = the same play
  // seen twice (we no longer ask the OCR to dedupe — it just transcribes). Two
  // plays sharing a timestamp but with DIFFERENT text are both kept for the user
  // to resolve in the editor.
  const seen = new Set<string>();
  const unique = mapped.filter((p) => {
    const key = playMergeKey(p.quarter, p.clock, p.description);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Carry possession forward when the model couldn't tell; attribute points to the
  // scoring team (defaulting to the possessing team when unspecified).
  let lastTeam: "TEAM" | "OPP" = "TEAM";
  const cleaned = unique.map((p) => {
    const team = p.rawTeam ?? lastTeam;
    lastTeam = team;
    const scoringTeam = p.points > 0 ? p.rawScoringTeam ?? team : null;
    return {
      quarter: p.quarter,
      clock: p.clock,
      team,
      situation: p.situation,
      description: p.description,
      playType: p.playType,
      points: p.points,
      scoringTeam,
    };
  });

  await db.$transaction(async (tx) => {
    await tx.gamePlay.deleteMany({ where: { gameId } });
    if (cleaned.length) {
      await tx.gamePlay.createMany({
        data: cleaned.map((p, i) => ({
          gameId,
          quarter: p.quarter,
          clock: p.clock,
          team: p.team,
          situation: p.situation,
          description: p.description,
          playType: p.playType,
          points: p.points,
          scoringTeam: p.scoringTeam,
          sortOrder: i,
        })),
      });
    }
  });

  // Optionally write a one-paragraph game summary from the freshly-saved plays.
  if (opts?.generateSummary) {
    try {
      const summary = await writeGameSummary(gameId, opts.summaryPersonaId ?? null);
      await db.game.update({ where: { id: gameId }, data: { summary } });
    } catch (e) {
      console.error("game summary generation failed", e);
    }
  }

  revalidatePath(path);
}

/** (Re)generate the game summary in a chosen persona's voice. */
export async function generateGameSummaryAction(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const raw = Number(formData.get("personaId"));
  const personaId = Number.isInteger(raw) && raw > 0 ? raw : null;

  const summary = await writeGameSummary(gameId, personaId);
  await db.game.update({ where: { id: gameId }, data: { summary } });
  revalidatePath(path);
}

/** Save a hand-edited game summary (blank clears it). */
export async function updateGameSummary(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const summary = String(formData.get("summary") ?? "").trim();
  await db.game.update({ where: { id: gameId }, data: { summary: summary || null } });
  revalidatePath(path);
}

// ---- Play-by-play editing ------------------------------------------------

/** Edit one play-by-play row — possession, timing, and text. */
export async function updateGamePlay(formData: FormData) {
  const { path } = baseIds(formData);
  const playId = Number(formData.get("playId"));
  if (!Number.isInteger(playId)) throw new Error("Bad play id.");
  const quarter = Number(formData.get("quarter"));
  const clock = String(formData.get("clock") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Play description can’t be empty.");
  const team = String(formData.get("team")) === "OPP" ? "OPP" : "TEAM";
  const playType = toPlayType(formData.get("playType"));
  const pointsRaw = Number(formData.get("points"));
  const points = Number.isInteger(pointsRaw) && pointsRaw >= 0 ? pointsRaw : 0;
  const scoringTeam = points > 0 ? toTeam(formData.get("scoringTeam")) ?? team : null;
  await db.gamePlay.update({
    where: { id: playId },
    data: {
      quarter: Number.isInteger(quarter) && quarter >= 1 ? quarter : 1,
      clock: /^\d{1,2}:\d{2}$/.test(clock) ? clock : null,
      team,
      situation: String(formData.get("situation") ?? "").trim() || null,
      description,
      playType,
      points,
      scoringTeam,
    },
  });
  revalidatePath(path);
}

/** Delete one play-by-play row. */
export async function deleteGamePlay(formData: FormData) {
  const { path } = baseIds(formData);
  const playId = Number(formData.get("playId"));
  if (!Number.isInteger(playId)) throw new Error("Bad play id.");
  await db.gamePlay.delete({ where: { id: playId } });
  revalidatePath(path);
}

/** Reassign possession for a set of plays at once — e.g. a whole drive the OCR
 *  mis-attributed to the wrong team. Adjacent same-possession drives re-merge
 *  automatically on the next render. */
export async function setPlaysPossession(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const team = String(formData.get("team")) === "OPP" ? "OPP" : "TEAM";
  const ids = String(formData.get("playIds") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return;
  await db.gamePlay.updateMany({ where: { id: { in: ids }, gameId }, data: { team } });
  revalidatePath(path);
}

/** Set a play's drive-boundary override, controlling how drives are grouped:
 *  "split" starts a new drive at this play, "merge" folds it onto the previous
 *  drive, "auto" reverts to the automatic possession-change rule. */
export async function setPlayDriveBoundary(formData: FormData) {
  const { path } = baseIds(formData);
  const playId = Number(formData.get("playId"));
  if (!Number.isInteger(playId)) throw new Error("Bad play id.");
  const mode = String(formData.get("boundary"));
  const newDrive = mode === "split" ? true : mode === "merge" ? false : null;
  await db.gamePlay.update({ where: { id: playId }, data: { newDrive } });
  revalidatePath(path);
}

/** Add a play to the play-by-play. Inserts right after `afterPlayId` (0 or absent
 *  = append at the end), shifting later plays down. `startsDrive` forces the new
 *  play to begin its own drive — the way to hand-create a drive from scratch. */
export async function addGamePlay(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Play description can’t be empty.");
  const quarter = Number(formData.get("quarter"));
  const clock = String(formData.get("clock") ?? "").trim();
  const afterPlayId = Number(formData.get("afterPlayId")) || 0;
  const startsDrive = String(formData.get("startsDrive")) === "1";
  const team = String(formData.get("team")) === "OPP" ? ("OPP" as const) : ("TEAM" as const);
  const playType = toPlayType(formData.get("playType"));
  const pointsRaw = Number(formData.get("points"));
  const points = Number.isInteger(pointsRaw) && pointsRaw >= 0 ? pointsRaw : 0;
  const scoringTeam = points > 0 ? toTeam(formData.get("scoringTeam")) ?? team : null;

  const data = {
    gameId,
    quarter: Number.isInteger(quarter) && quarter >= 1 ? quarter : 1,
    clock: /^\d{1,2}:\d{2}$/.test(clock) ? clock : null,
    team,
    situation: String(formData.get("situation") ?? "").trim() || null,
    description,
    newDrive: startsDrive ? true : null,
    playType,
    points,
    scoringTeam,
  };

  await db.$transaction(async (tx) => {
    const top = await tx.gamePlay.findFirst({
      where: { gameId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const maxSort = top?.sortOrder ?? -1;

    // Where does it slot in chronologically? Right after `afterPlayId`, else last.
    let base = maxSort;
    if (afterPlayId > 0) {
      const after = await tx.gamePlay.findFirst({
        where: { id: afterPlayId, gameId },
        select: { sortOrder: true },
      });
      if (after) base = after.sortOrder;
    }

    // Open a gap after `base` and drop the new play into it.
    await tx.gamePlay.updateMany({
      where: { gameId, sortOrder: { gt: base } },
      data: { sortOrder: { increment: 1 } },
    });
    await tx.gamePlay.create({ data: { ...data, sortOrder: base + 1 } });
  });

  revalidatePath(path);
}

/** Delete a whole drive — every play in it. */
export async function deleteDrive(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const ids = String(formData.get("playIds") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return;
  await db.gamePlay.deleteMany({ where: { id: { in: ids }, gameId } });
  revalidatePath(path);
}

/** Wipe the entire play-by-play for a game — so a bad import can be re-imported
 *  from scratch. */
export async function deleteAllPlays(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  await db.gamePlay.deleteMany({ where: { gameId } });
  revalidatePath(path);
}

export type OcrPlayerStatInput = {
  /** An existing rostered player, or null when creating a new one. */
  playerId: number | null;
  /** Details for a player not yet on the roster (used when playerId is null). */
  newPlayer?: { name: string; position: string; class: string } | null;
  stats: Record<string, number>;
};

/**
 * Commit reviewed OCR player stat lines. Each line is either matched to an
 * existing rostered player or creates a new one (added to this season's
 * roster). Upserts one line per player (create-or-replace).
 */
export async function commitOcrPlayerStats(
  seasonId: number,
  gameId: number,
  lines: OcrPlayerStatInput[],
) {
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("No stat lines to import.");
  }

  // Validate up front so a bad new-player row fails loudly before any writes.
  for (const l of lines) {
    if (Number.isInteger(l?.playerId)) continue;
    const np = l?.newPlayer;
    if (!np) throw new Error("Assign each stat line to a player first.");
    if (!np.name?.trim()) throw new Error("New players need a name.");
    if (!np.position?.trim() || np.position.trim().length > MAX_POSITION_LEN) {
      throw new Error(`New player ${np.name}: position is required (≤${MAX_POSITION_LEN} chars).`);
    }
    if (!isValidClass(np.class)) throw new Error(`New player ${np.name}: choose a class.`);
  }

  // Ensure this season has a roster to attach new players to.
  const roster = await db.seasonRoster.upsert({
    where: { seasonId },
    create: { seasonId },
    update: {},
  });

  await db.$transaction(async (tx) => {
    const seen = new Set<number>();
    for (const l of lines) {
      let playerId = Number.isInteger(l.playerId) ? (l.playerId as number) : null;

      if (playerId === null && l.newPlayer) {
        const np = l.newPlayer;
        playerId = await attachPlayerToRoster(tx, roster.id, {
          name: np.name.trim(),
          position: np.position.trim(),
          class: np.class as PlayerClass,
          number: null,
        });
      }
      if (playerId === null || seen.has(playerId)) continue;
      seen.add(playerId);

      const data = pickStats(l.stats, PLAYER_STAT_GROUPS);
      await tx.gamePlayerStat.upsert({
        where: { gameId_playerId: { gameId, playerId } },
        create: { gameId, playerId, ...data },
        update: data,
      });
    }
  });

  after(() => recomputeGame(gameId));
  revalidatePath(`/seasons/${seasonId}/schedule/${gameId}/box-score`);
}

export type OcrOppPlayerInput = {
  playerName: string;
  position: string | null;
  stats: Record<string, number>;
};

/**
 * Commit OPPONENT player stat lines for a game. These aren't Player objects — just
 * named lines on the game — so this replaces the game's opponent lines wholesale
 * (dedup by name). No notoriety/roster side effects.
 */
export async function commitOcrOppPlayerStats(
  seasonId: number,
  gameId: number,
  lines: OcrOppPlayerInput[],
) {
  if (![seasonId, gameId].every(Number.isInteger)) throw new Error("Bad ids.");
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("No stat lines to import.");

  const seen = new Set<string>();
  const clean = lines
    .map((l) => ({
      playerName: String(l?.playerName ?? "").trim(),
      position: String(l?.position ?? "").trim().slice(0, MAX_POSITION_LEN) || null,
      stats: pickStats(l?.stats, PLAYER_STAT_GROUPS),
    }))
    .filter((l) => {
      if (!l.playerName) return false;
      const k = l.playerName.toLowerCase();
      return seen.has(k) ? false : seen.add(k);
    });
  if (clean.length === 0) throw new Error("No named stat lines to import.");

  await db.$transaction(async (tx) => {
    await tx.gameOppPlayerStat.deleteMany({ where: { gameId } });
    await tx.gameOppPlayerStat.createMany({
      data: clean.map((l) => ({ gameId, playerName: l.playerName, position: l.position, ...l.stats })),
    });
  });

  revalidatePath(`/seasons/${seasonId}/schedule/${gameId}/box-score`);
}

/** Add or edit one opponent player's stat line by hand. `oppStatId` present =
 *  edit that row; absent/0 = create a new line on this game. */
export async function upsertOppPlayerStatLine(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const id = Number(formData.get("oppStatId")) || 0;
  const playerName = String(formData.get("playerName") ?? "").trim();
  if (!playerName) throw new Error("Player name is required.");
  const position = String(formData.get("position") ?? "").trim().slice(0, MAX_POSITION_LEN) || null;
  const data = parseStats(formData, PLAYER_STAT_GROUPS);

  if (id > 0) {
    await db.gameOppPlayerStat.update({ where: { id }, data: { playerName, position, ...data } });
  } else {
    await db.gameOppPlayerStat.create({ data: { gameId, playerName, position, ...data } });
  }
  revalidatePath(path);
}

/** Delete one opponent player stat line. */
export async function deleteOppPlayerStatLine(formData: FormData) {
  const { path } = baseIds(formData);
  const id = Number(formData.get("oppStatId"));
  if (!Number.isInteger(id)) throw new Error("Bad id.");
  await db.gameOppPlayerStat.delete({ where: { id } });
  revalidatePath(path);
}

/**
 * Post a box-score event to the mediaSpace: it recomputes notoriety and writes a
 * notoriety-weighted recap in the background. Redirects to the Media Space feed so
 * the user watches the event process.
 */
export async function generateGameArticle(formData: FormData) {
  const { seasonId, gameId } = baseIds(formData);
  const context = String(formData.get("mediaContext") ?? "").trim();
  const personaIds = readIdList(formData, "mediaPersonaId");
  const playerIds = readIdList(formData, "mediaPlayerId"); // extra player features (default none)

  await postMediaEvent({
    type: "BOX_SCORE",
    scope: "GAME",
    gameId,
    context: context || null,
    personaIds,
    playerIds,
  });

  revalidatePath("/media");
  revalidatePath(`/seasons/${seasonId}/media`);
  redirect("/media/space");
}

export async function deletePlayerStat(formData: FormData) {
  const { gameId, path } = baseIds(formData);
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");

  await db.gamePlayerStat.delete({
    where: { gameId_playerId: { gameId, playerId } },
  });

  after(() => recomputeGame(gameId));
  revalidatePath(path);
}
