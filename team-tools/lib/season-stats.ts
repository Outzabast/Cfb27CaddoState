// Derived data for the Season → Team Stats page. Season player leaderboards
// reuse the box-score categories (lib/box-score.ts); the Team tab flattens the
// season team totals + player-derived figures into ESPN-style sections. Pure
// presentation logic — every value already lives on the box-score rows.

import { formatPct, formatDuration } from "./stat-fields";
import type { BoxLine } from "./box-score";

/** How each box-score category ranks players in the season leaderboard (desc).
 *  Mirrors ESPN: passing/rushing/receiving by yards, defense by total tackles. */
export const CATEGORY_RANK: Record<string, (l: BoxLine) => number> = {
  passing: (l) => l.passYds,
  rushing: (l) => l.rushYds,
  receiving: (l) => l.recYds,
  fumbles: (l) => l.fumbles + l.fumblesLost + l.fumblesRec,
  defense: (l) => l.tacklesSolo + l.tacklesAst,
  interceptions: (l) => l.defInt,
  kickReturns: (l) => l.krYds,
  puntReturns: (l) => l.prYds,
  kicking: (l) => l.fgMade * 3 + l.xpMade,
  punting: (l) => l.puntYds,
};

export type Leader = {
  title: string;
  playerId: number;
  name: string;
  number: number | null;
  value: string;
};

/** Top player in each headline stat, ESPN's "Team Leaders" strip. Omits a
 *  category when nobody recorded anything in it. */
export function teamLeaders(lines: BoxLine[]): Leader[] {
  const cats: { title: string; stat: (l: BoxLine) => number; fmt?: (n: number) => string }[] = [
    { title: "Passing Yards", stat: (l) => l.passYds },
    { title: "Rushing Yards", stat: (l) => l.rushYds },
    { title: "Receiving Yards", stat: (l) => l.recYds },
    { title: "Tackles", stat: (l) => l.tacklesSolo + l.tacklesAst },
    { title: "Interceptions", stat: (l) => l.defInt },
  ];
  const out: Leader[] = [];
  for (const c of cats) {
    let best: BoxLine | null = null;
    let bestVal = 0;
    for (const l of lines) {
      const v = c.stat(l);
      if (v > bestVal) {
        bestVal = v;
        best = l;
      }
    }
    if (best && bestVal > 0) {
      out.push({
        title: c.title,
        playerId: best.playerId,
        name: best.name,
        number: best.number,
        value: (c.fmt ?? String)(bestVal),
      });
    }
  }
  return out;
}

export type StatRow = { label: string; value: string | number };
export type StatSection = { title: string; rows: StatRow[] };

/** Season team totals (SUM of the per-game GameTeamStat rows). */
export type TeamSeasonTotals = {
  firstDowns: number;
  totalPlays: number;
  totalYards: number;
  passYds: number;
  rushYds: number;
  thirdDownConv: number;
  thirdDownAtt: number;
  fourthDownConv: number;
  fourthDownAtt: number;
  penalties: number;
  penaltyYds: number;
  turnovers: number;
  timeOfPossession: number;
  sacks: number;
  tacklesForLoss: number;
  takeaways: number;
  defTd: number;
  fgMade: number;
  fgAtt: number;
  xpMade: number;
  xpAtt: number;
  punts: number;
  puntYds: number;
  returnYds: number;
  returnTd: number;
};

export type SeasonMeta = {
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
};

const sum = (ls: BoxLine[], f: (l: BoxLine) => number) => ls.reduce((a, l) => a + f(l), 0);
/** Per-attempt average to one decimal ("0.0" when no attempts). */
const avg1 = (num: number, den: number) => (den > 0 ? (num / den).toFixed(1) : "0.0");
/** Half-step stat (sacks, TFL): drop the ".0" on whole numbers. */
const f1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** Per-game figure to one decimal. */
const perGame = (total: number, games: number) => (games > 0 ? (total / games).toFixed(1) : "0.0");

/**
 * Flatten season totals into ESPN-style sections for the Team tab. Team-level
 * figures come from the GameTeamStat totals; passing comp/att, TDs, INTs thrown,
 * rush attempts, and fumbles lost are derived from the player lines so the two
 * views can never disagree (same approach as the per-game box score).
 */
export function seasonTeamSections(
  team: TeamSeasonTotals,
  lines: BoxLine[],
  meta: SeasonMeta,
  opp: TeamSeasonTotals | null = null,
): StatSection[] {
  const g = meta.gamesPlayed;
  const cmp = sum(lines, (l) => l.passCmp);
  const att = sum(lines, (l) => l.passAtt);
  const passTd = sum(lines, (l) => l.passTd);
  const intThrown = sum(lines, (l) => l.passInt);
  const sacked = sum(lines, (l) => l.sacked);
  const rushAtt = sum(lines, (l) => l.rushAtt);
  const rushTd = sum(lines, (l) => l.rushTd);
  const fumLost = sum(lines, (l) => l.fumblesLost);
  const defInt = sum(lines, (l) => l.defInt);

  return [
    {
      title: "Scoring",
      rows: [
        { label: "Points For", value: meta.pointsFor },
        { label: "Points Against", value: meta.pointsAgainst },
        { label: "Points / Game", value: perGame(meta.pointsFor, g) },
        { label: "Passing TDs", value: passTd },
        { label: "Rushing TDs", value: rushTd },
      ],
    },
    {
      title: "First Downs",
      rows: [
        { label: "Total 1st Downs", value: team.firstDowns },
        {
          label: "3rd Down Conversions",
          value: `${team.thirdDownConv}-${team.thirdDownAtt} (${formatPct(team.thirdDownConv, team.thirdDownAtt)})`,
        },
        {
          label: "4th Down Conversions",
          value: `${team.fourthDownConv}-${team.fourthDownAtt} (${formatPct(team.fourthDownConv, team.fourthDownAtt)})`,
        },
      ],
    },
    {
      title: "Passing",
      rows: [
        { label: "Passing Yards", value: team.passYds },
        { label: "Comp-Att", value: `${cmp}-${att}` },
        { label: "Yards / Attempt", value: avg1(team.passYds, att) },
        { label: "Passing Yards / Game", value: perGame(team.passYds, g) },
        { label: "Interceptions Thrown", value: intThrown },
        { label: "Sacks Allowed", value: sacked },
      ],
    },
    {
      title: "Rushing",
      rows: [
        { label: "Rushing Yards", value: team.rushYds },
        { label: "Rushing Attempts", value: rushAtt },
        { label: "Yards / Rush", value: avg1(team.rushYds, rushAtt) },
        { label: "Rushing Yards / Game", value: perGame(team.rushYds, g) },
      ],
    },
    {
      title: "Offense",
      rows: [
        { label: "Total Yards", value: team.totalYards },
        { label: "Total Plays", value: team.totalPlays },
        { label: "Yards / Play", value: avg1(team.totalYards, team.totalPlays) },
        { label: "Yards / Game", value: perGame(team.totalYards, g) },
      ],
    },
    {
      title: "Defense",
      rows: [
        { label: "Sacks", value: f1(team.sacks) },
        { label: "Tackles For Loss", value: f1(team.tacklesForLoss) },
        { label: "Interceptions", value: defInt },
        { label: "Takeaways", value: team.takeaways },
        { label: "Defensive TDs", value: team.defTd },
      ],
    },
    ...(opp
      ? [
          {
            title: "Defense — Yards Allowed",
            rows: [
              { label: "Points Allowed", value: meta.pointsAgainst },
              { label: "Points Allowed / Game", value: perGame(meta.pointsAgainst, g) },
              { label: "Total Yards Allowed", value: opp.totalYards },
              { label: "Yards Allowed / Game", value: perGame(opp.totalYards, g) },
              { label: "Passing Yards Allowed", value: opp.passYds },
              { label: "Passing Allowed / Game", value: perGame(opp.passYds, g) },
              { label: "Rushing Yards Allowed", value: opp.rushYds },
              { label: "Rushing Allowed / Game", value: perGame(opp.rushYds, g) },
              { label: "1st Downs Allowed", value: opp.firstDowns },
              {
                label: "Opponent 3rd Down",
                value: `${opp.thirdDownConv}-${opp.thirdDownAtt} (${formatPct(opp.thirdDownConv, opp.thirdDownAtt)})`,
              },
              { label: "Takeaways (Opp Turnovers)", value: opp.turnovers },
            ],
          },
        ]
      : []),
    {
      title: "Kicking",
      rows: [
        { label: "Field Goals", value: `${team.fgMade}-${team.fgAtt} (${formatPct(team.fgMade, team.fgAtt)})` },
        { label: "Extra Points", value: `${team.xpMade}-${team.xpAtt} (${formatPct(team.xpMade, team.xpAtt)})` },
        { label: "Punts", value: team.punts },
        { label: "Punt Yards", value: team.puntYds },
        { label: "Yards / Punt", value: avg1(team.puntYds, team.punts) },
      ],
    },
    {
      title: "Returns",
      rows: [
        { label: "Return Yards", value: team.returnYds },
        { label: "Return TDs", value: team.returnTd },
      ],
    },
    {
      title: "Ball Security & Discipline",
      rows: [
        { label: "Turnovers", value: team.turnovers },
        { label: "Fumbles Lost", value: fumLost },
        { label: "Interceptions Thrown", value: intThrown },
        { label: "Penalties", value: `${team.penalties}-${team.penaltyYds}` },
        { label: "Time of Possession", value: formatDuration(team.timeOfPossession) },
      ],
    },
  ];
}
