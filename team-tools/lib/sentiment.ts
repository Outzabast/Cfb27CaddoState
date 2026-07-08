// Fan sentiment (0–100): how the fanbase feels about the program this season.
// It starts from a preseason BASELINE — derived from recent past performance, or
// a manual override — and moves with how the team does relative to expectation.
// It carries over: a season's final sentiment feeds the next season's baseline,
// so a happy, winning year raises expectations (and the bar) for the next.

import { db } from "@/lib/db";

export const NEUTRAL = 50;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

type GameScore = { teamPoints: number; oppPoints: number };

/** Win pct over played games (both scores 0 = unplayed), or null if none played. */
function winPct(games: GameScore[]): number | null {
  const played = games.filter((g) => g.teamPoints !== 0 || g.oppPoints !== 0);
  if (played.length === 0) return null;
  const wins = played.filter((g) => g.teamPoints > g.oppPoints).length;
  const ties = played.filter((g) => g.teamPoints === g.oppPoints).length;
  return (wins + ties * 0.5) / played.length;
}

/**
 * The derived preseason baseline for a season: a blend of last season's mood
 * (its final sentiment) and how well it actually did. No prior season → neutral.
 */
export async function deriveBaseline(seasonId: number): Promise<number> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { startYear: true },
  });
  if (!season) return NEUTRAL;

  const prior = await db.season.findFirst({
    where: { startYear: { lt: season.startYear } },
    orderBy: { startYear: "desc" },
    select: { fanSentiment: true, games: { select: { teamPoints: true, oppPoints: true } } },
  });
  if (!prior) return NEUTRAL;

  const priorWin = winPct(prior.games) ?? 0.5;
  // Half carried mood, half actual results.
  return clamp(0.5 * prior.fanSentiment + 0.5 * (priorWin * 100));
}

/** The baseline actually in effect: the manual override, else the derived value. */
export async function effectiveBaseline(seasonId: number): Promise<number> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { sentimentBaselineOverride: true },
  });
  if (season?.sentimentBaselineOverride != null) return clamp(season.sentimentBaselineOverride);
  return deriveBaseline(seasonId);
}

/**
 * Recompute and store one season's fanSentiment: baseline, moved by this
 * season's win pct vs. the win pct the baseline implies fans expect.
 */
export async function recomputeFanSentiment(seasonId: number): Promise<void> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: {
      fanSentiment: true,
      games: { select: { teamPoints: true, oppPoints: true } },
    },
  });
  if (!season) return;

  const baseline = await effectiveBaseline(seasonId);
  const wp = winPct(season.games);
  // No games yet → sentiment is just the baseline. Otherwise reward/punish the
  // gap between actual results and what the baseline implies fans expect.
  const sentiment = wp == null ? baseline : clamp(baseline + (wp - baseline / 100) * 120);

  if (sentiment !== season.fanSentiment) {
    await db.season.update({ where: { id: seasonId }, data: { fanSentiment: sentiment } });
  }
}

/**
 * Recompute every season's sentiment oldest-first, so each season's carried-over
 * baseline reads its predecessor's fresh value. Call whenever a result changes.
 */
export async function recomputeAllSentiment(): Promise<void> {
  const seasons = await db.season.findMany({
    orderBy: { startYear: "asc" },
    select: { id: true },
  });
  for (const s of seasons) await recomputeFanSentiment(s.id);
}

export type SentimentBand = { label: string; tone: "bad" | "low" | "neutral" | "good" | "great" };

/** Human label + tone for a sentiment value (drives badges and media mood). */
export function sentimentBand(value: number): SentimentBand {
  if (value < 20) return { label: "Furious", tone: "bad" };
  if (value < 40) return { label: "Restless", tone: "low" };
  if (value < 60) return { label: "Neutral", tone: "neutral" };
  if (value < 80) return { label: "Pleased", tone: "good" };
  return { label: "Elated", tone: "great" };
}
