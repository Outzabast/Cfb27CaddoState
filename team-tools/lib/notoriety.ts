// Player notoriety: a non-negative "how noteworthy is this player" score, kept
// in three scopes — GamePlayerStat.gameNotoriety (one game), SeasonPlayer.
// seasonNotoriety (one season), Player.overallNotoriety (the program). It is NOT
// sentiment — it only says "worth writing about", so media generation knows who
// to feature.
//
// Score = baseline (roster standing) + statistical significance. Significance is
// (1) ABSOLUTE production — any stat recorded earns points scaled by magnitude
// with diminishing returns, (2) a LEADING bonus for topping the team, and (3) a
// RECORD bonus for owning a team single-season / career best. Season and overall
// scores RATCHET: they jump up immediately but only ease down, so fame is sticky.

import { db } from "@/lib/db";
import {
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import type { PlayerStatus, StaffRole } from "@/generated/prisma/enums";

// ---- Baselines ----
const BASE_POSTACTIVE = 0; // off the active roster
const BASE_ACTIVE = 20; // rostered
const BASE_STARTER = 50; // rostered starter

/** Roster-standing baseline for a season line. */
function baseline(status: PlayerStatus, isStarter: boolean): number {
  if (status === "POSTACTIVE") return BASE_POSTACTIVE;
  return isStarter ? BASE_STARTER : BASE_ACTIVE;
}

type Values = Record<string, number>;

/**
 * A stat that contributes to notoriety. `value` reads the aggregate; `sql` is the
 * per-group SUM used to find program records. `*Per` = stat units per point (with
 * a `*Cap`); `lead`/`record` are the leading and record bonuses.
 */
type Cat = {
  key: string;
  value: (v: Values) => number;
  sql: string;
  seasonPer: number;
  seasonCap: number;
  gamePer: number;
  gameCap: number;
  lead: number;
  record: number;
};

const CATS: Cat[] = [
  { key: "passYds", value: (v) => v.passYds, sql: "SUM(gps.pass_yds)", seasonPer: 150, seasonCap: 10, gamePer: 45, gameCap: 8, lead: 3, record: 6 },
  { key: "passTd", value: (v) => v.passTd, sql: "SUM(gps.pass_td)", seasonPer: 2, seasonCap: 6, gamePer: 1, gameCap: 6, lead: 2, record: 4 },
  { key: "rushYds", value: (v) => v.rushYds, sql: "SUM(gps.rush_yds)", seasonPer: 120, seasonCap: 10, gamePer: 35, gameCap: 8, lead: 3, record: 6 },
  { key: "rushTd", value: (v) => v.rushTd, sql: "SUM(gps.rush_td)", seasonPer: 1.5, seasonCap: 6, gamePer: 1, gameCap: 6, lead: 2, record: 4 },
  { key: "recYds", value: (v) => v.recYds, sql: "SUM(gps.rec_yds)", seasonPer: 120, seasonCap: 10, gamePer: 35, gameCap: 8, lead: 3, record: 6 },
  { key: "recTd", value: (v) => v.recTd, sql: "SUM(gps.rec_td)", seasonPer: 1.5, seasonCap: 6, gamePer: 1, gameCap: 6, lead: 2, record: 4 },
  { key: "rec", value: (v) => v.rec, sql: "SUM(gps.rec)", seasonPer: 12, seasonCap: 5, gamePer: 4, gameCap: 4, lead: 1, record: 3 },
  { key: "tackles", value: (v) => (v.tacklesSolo ?? 0) + (v.tacklesAst ?? 0), sql: "SUM(gps.tackles_solo + gps.tackles_ast)", seasonPer: 12, seasonCap: 8, gamePer: 4, gameCap: 6, lead: 3, record: 5 },
  { key: "sacks", value: (v) => v.sacks, sql: "SUM(gps.sacks)", seasonPer: 1.5, seasonCap: 6, gamePer: 1, gameCap: 5, lead: 2, record: 4 },
  { key: "defInt", value: (v) => v.defInt, sql: "SUM(gps.def_int)", seasonPer: 1, seasonCap: 5, gamePer: 1, gameCap: 5, lead: 2, record: 4 },
  { key: "forcedFumbles", value: (v) => v.forcedFumbles, sql: "SUM(gps.forced_fumbles)", seasonPer: 1, seasonCap: 4, gamePer: 1, gameCap: 4, lead: 1, record: 3 },
  { key: "fgMade", value: (v) => v.fgMade, sql: "SUM(gps.fg_made)", seasonPer: 3, seasonCap: 5, gamePer: 2, gameCap: 4, lead: 1, record: 3 },
  { key: "scoreTd", value: (v) => (v.defTd ?? 0) + (v.krTd ?? 0) + (v.prTd ?? 0), sql: "SUM(gps.def_td + gps.kr_td + gps.pr_td)", seasonPer: 1, seasonCap: 5, gamePer: 1, gameCap: 5, lead: 1, record: 4 },
];

const clampInt = (n: number) => Math.max(0, Math.round(n));

/** Absolute-production points: every stat, scaled by magnitude with a per-cat cap. */
function productionScore(values: Values, scope: "season" | "game"): number {
  let total = 0;
  for (const c of CATS) {
    const v = c.value(values);
    if (v <= 0) continue;
    const per = scope === "season" ? c.seasonPer : c.gamePer;
    const cap = scope === "season" ? c.seasonCap : c.gameCap;
    total += Math.min(cap, v / per);
  }
  return total;
}

/** Big-game flourishes the smooth production curve misses (100-yd / multi-TD games). */
function gameHeroBonus(line: Values): number {
  let b = 0;
  const tds =
    (line.passTd ?? 0) + (line.rushTd ?? 0) + (line.recTd ?? 0) +
    (line.defTd ?? 0) + (line.krTd ?? 0) + (line.prTd ?? 0);
  if (tds >= 3) b += 6;
  else if (tds >= 2) b += 3;
  if ((line.rushYds ?? 0) >= 100) b += 3;
  if ((line.recYds ?? 0) >= 100) b += 3;
  if ((line.passYds ?? 0) >= 300) b += 4;
  if ((line.sacks ?? 0) >= 2) b += 2;
  if ((line.defInt ?? 0) >= 2) b += 3;
  return b;
}

/**
 * Rise fast, fall slow. If the new target is at or above the stored value it wins
 * outright; if it's lower, only ~25% of the gap is given back this recompute.
 */
function ratchet(prev: number, target: number): number {
  if (target >= prev) return clampInt(target);
  return clampInt(prev - (prev - target) * 0.25);
}

/** Per-category program bests (max of the given per-group SUMs across all rows). */
async function programBests(groupBy: "season" | "career"): Promise<Map<string, number>> {
  const cols = CATS.map((c) => `${c.sql} AS "${c.key}"`).join(", ");
  const sql =
    groupBy === "season"
      ? `SELECT ${cols} FROM game_player_stats gps JOIN games g ON g.id = gps.game_id GROUP BY g.season_id, gps.player_id`
      : `SELECT ${cols} FROM game_player_stats gps GROUP BY gps.player_id`;
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  const best = new Map<string, number>();
  for (const c of CATS) best.set(c.key, 0);
  for (const row of rows) {
    for (const c of CATS) {
      const v = Number(row[c.key] ?? 0);
      if (v > (best.get(c.key) ?? 0)) best.set(c.key, v);
    }
  }
  return best;
}

const agg = aggregateSelect(PLAYER_STAT_GROUPS);

async function seasonValues(playerId: number, seasonId: number): Promise<Values> {
  const a = await db.gamePlayerStat.aggregate({
    where: { playerId, game: { seasonId } },
    _sum: agg.sum as never,
    _max: agg.max as never,
  });
  return mergeAggregate(a, PLAYER_STAT_GROUPS);
}

async function careerValues(playerId: number): Promise<Values> {
  const a = await db.gamePlayerStat.aggregate({
    where: { playerId },
    _sum: agg.sum as never,
    _max: agg.max as never,
  });
  return mergeAggregate(a, PLAYER_STAT_GROUPS);
}

/**
 * Recompute gameNotoriety for every line in a game (per-game snapshot, no
 * ratchet), then roll the change up through the season and overall scopes.
 */
export async function recomputeGame(gameId: number): Promise<void> {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { seasonId: true } });
  if (!game) return;

  const lines = await db.gamePlayerStat.findMany({ where: { gameId } });
  const starters = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId: game.seasonId } },
    select: { playerId: true, isStarter: true },
  });
  const isStarter = new Map(starters.map((s) => [s.playerId, s.isStarter]));

  for (const line of lines) {
    const values = line as unknown as Values;
    const prod = productionScore(values, "game");
    const hero = gameHeroBonus(values);
    const starterBonus = isStarter.get(line.playerId) ? 3 : 0;
    const score = clampInt(prod + hero + starterBonus);
    if (score !== line.gameNotoriety) {
      await db.gamePlayerStat.update({ where: { id: line.id }, data: { gameNotoriety: score } });
    }
  }

  // A game's stats can shift program-wide records (which flow into season/overall
  // bonuses for players in OTHER seasons too), so roll up across the whole program.
  await recomputeAll();
}

/** Recompute season + overall notoriety for every player on every season roster,
 *  plus staff. The correct pass whenever program records may have moved. */
export async function recomputeAll(): Promise<void> {
  const seasons = await db.season.findMany({ select: { id: true } });
  for (const s of seasons) await recomputeSeason(s.id);
  await recomputeStaffAll();
}

// ---------------------------------------------------------------------------
// Staff notoriety — role baseline + team performance + longevity, ratcheted.
// No game scope (staff aren't per-game). Performance is read from season results:
// record for everyone, offense output for the OC, points allowed for the DC.
// ---------------------------------------------------------------------------

function staffRoleBase(role: StaffRole | undefined): number {
  switch (role) {
    case "HEAD_COACH":
      return 60;
    case "OFFENSIVE_COORDINATOR":
    case "DEFENSIVE_COORDINATOR":
      return 50;
    default:
      return 40;
  }
}

type TeamAgg = {
  gp: number;
  wins: number;
  pf: number;
  pa: number;
  offYards: number;
  oppYards: number; // yards given up (from opponent team stats), 0 if unentered
};

async function seasonTeamAgg(seasonId: number): Promise<TeamAgg> {
  const games = await db.game.findMany({
    where: { seasonId },
    select: {
      teamPoints: true,
      oppPoints: true,
      teamStats: { select: { totalYards: true } },
      oppStats: { select: { totalYards: true } },
    },
  });
  const agg: TeamAgg = { gp: 0, wins: 0, pf: 0, pa: 0, offYards: 0, oppYards: 0 };
  for (const g of games) {
    if (g.teamPoints === 0 && g.oppPoints === 0) continue; // unplayed
    agg.gp++;
    agg.pf += g.teamPoints;
    agg.pa += g.oppPoints;
    agg.offYards += g.teamStats?.totalYards ?? 0;
    agg.oppYards += g.oppStats?.totalYards ?? 0;
    if (g.teamPoints > g.oppPoints) agg.wins++;
  }
  return agg;
}

function staffSeasonTarget(role: StaffRole, agg: TeamAgg): number {
  let bonus = Math.min(20, agg.wins * 3); // shared: winning reflects on all staff
  if (agg.gp > 0 && agg.wins / agg.gp >= 0.5) bonus += 5;

  if (role === "HEAD_COACH") {
    bonus += Math.min(15, agg.wins * 2); // the head coach owns the record most
  } else if (role === "OFFENSIVE_COORDINATOR" && agg.gp > 0) {
    const ppg = agg.pf / agg.gp;
    const ypg = agg.offYards / agg.gp;
    bonus += Math.min(20, ppg / 2 + ypg / 50);
  } else if (role === "DEFENSIVE_COORDINATOR" && agg.gp > 0) {
    const ppgAllowed = agg.pa / agg.gp;
    let d = Math.max(0, 35 - ppgAllowed); // fewer points allowed = better
    if (agg.oppYards > 0) {
      const ypgAllowed = agg.oppYards / agg.gp; // fewer yards allowed = better
      d += Math.max(0, (400 - ypgAllowed) / 20);
    }
    bonus += Math.min(20, d);
  }
  return staffRoleBase(role) + bonus;
}

/** Recompute seasonNotoriety for a season's staff, then their overall scores. */
export async function recomputeSeasonStaff(seasonId: number): Promise<void> {
  const rows = await db.seasonStaff.findMany({ where: { seasonId } });
  if (rows.length === 0) return;
  const agg = await seasonTeamAgg(seasonId);

  for (const r of rows) {
    const next = ratchet(r.seasonNotoriety, staffSeasonTarget(r.role, agg));
    if (next !== r.seasonNotoriety) {
      await db.seasonStaff.update({ where: { id: r.id }, data: { seasonNotoriety: next } });
    }
  }

  for (const staffId of [...new Set(rows.map((r) => r.staffId))]) {
    await recomputeStaffOverall(staffId);
  }
}

/** Recompute a staff member's program-wide notoriety: peak season + longevity. */
export async function recomputeStaffOverall(staffId: number): Promise<void> {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: {
      overallNotoriety: true,
      seasonStaff: {
        select: { role: true, seasonNotoriety: true },
        orderBy: { season: { startYear: "desc" } },
      },
    },
  });
  if (!staff) return;

  const peak = staff.seasonStaff.reduce((m, s) => Math.max(m, s.seasonNotoriety), 0);
  const currentBase = staffRoleBase(staff.seasonStaff[0]?.role);
  const longevity = Math.min(10, staff.seasonStaff.length * 2);
  const next = ratchet(staff.overallNotoriety, Math.max(peak, currentBase) + longevity);
  if (next !== staff.overallNotoriety) {
    await db.staff.update({ where: { id: staffId }, data: { overallNotoriety: next } });
  }
}

/** Recompute notoriety for all staff across all seasons. */
export async function recomputeStaffAll(): Promise<void> {
  const seasons = await db.season.findMany({ select: { id: true } });
  for (const s of seasons) await recomputeSeasonStaff(s.id);
}

/**
 * Recompute seasonNotoriety for every player on a season's roster (baseline +
 * production + leading + record, ratcheted), then their overall scores.
 */
export async function recomputeSeason(seasonId: number): Promise<void> {
  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    include: { player: { select: { status: true } } },
  });
  if (roster.length === 0) return;

  // Each player's season aggregate.
  const valuesByPlayer = new Map<number, Values>();
  for (const sp of roster) {
    valuesByPlayer.set(sp.playerId, await seasonValues(sp.playerId, seasonId));
  }

  // Team leader per category (this season).
  const leader = new Map<string, number>();
  for (const c of CATS) {
    let m = 0;
    for (const v of valuesByPlayer.values()) m = Math.max(m, c.value(v));
    leader.set(c.key, m);
  }

  const seasonRecord = await programBests("season");

  for (const sp of roster) {
    const values = valuesByPlayer.get(sp.playerId)!;
    let score = baseline(sp.player.status, sp.isStarter);
    score += productionScore(values, "season");
    for (const c of CATS) {
      const v = c.value(values);
      if (v <= 0) continue;
      // Leading bonus, scaled by how dominant (share of the team-leading value).
      if (v >= (leader.get(c.key) ?? 0)) {
        score += c.lead;
      }
      // Record bonus: ties/owns the program single-season best for this stat.
      if (v >= (seasonRecord.get(c.key) ?? 0)) {
        score += c.record;
      }
    }

    const next = ratchet(sp.seasonNotoriety, score);
    if (next !== sp.seasonNotoriety) {
      await db.seasonPlayer.update({ where: { id: sp.id }, data: { seasonNotoriety: next } });
    }
  }

  const playerIds = [...new Set(roster.map((r) => r.playerId))];
  const careerRecord = await programBests("career");
  for (const playerId of playerIds) {
    await recomputeOverall(playerId, careerRecord);
  }
}

/**
 * Recompute a player's program-wide overallNotoriety: roughly their peak season
 * fame, plus career-record ownership and a small longevity bump, ratcheted.
 */
export async function recomputeOverall(
  playerId: number,
  careerRecord?: Map<string, number>,
): Promise<void> {
  const player = await db.player.findUnique({
    where: { id: playerId },
    select: {
      overallNotoriety: true,
      status: true,
      seasonPlayers: {
        select: { isStarter: true, seasonNotoriety: true },
        orderBy: { seasonRoster: { season: { startYear: "desc" } } },
      },
      notorietyEvents: { select: { points: true } },
    },
  });
  if (!player) return;

  const peakSeason = player.seasonPlayers.reduce((m, s) => Math.max(m, s.seasonNotoriety), 0);
  const currentStarter = player.seasonPlayers[0]?.isStarter ?? false;
  const currentBase = baseline(player.status, currentStarter);

  const records = careerRecord ?? (await programBests("career"));
  const career = await careerValues(playerId);
  let recordBonus = 0;
  for (const c of CATS) {
    const v = c.value(career);
    if (v > 0 && v >= (records.get(c.key) ?? 0)) recordBonus += c.record;
  }
  const longevity = Math.min(10, player.seasonPlayers.length * 2);
  // Manually-attributed notoriety events add on top (non-negative).
  const manual = player.notorietyEvents.reduce((s, e) => s + Math.max(0, e.points), 0);

  const target = Math.max(peakSeason, currentBase) + recordBonus + longevity + manual;
  const next = ratchet(player.overallNotoriety, target);
  if (next !== player.overallNotoriety) {
    await db.player.update({ where: { id: playerId }, data: { overallNotoriety: next } });
  }
}
