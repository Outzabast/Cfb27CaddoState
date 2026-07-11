// Turns a game's stored player lines + team totals into ESPN-style box-score
// tables. Pure presentation logic: every value here already lives on
// GamePlayerStat / GameTeamStat — nothing new is stored. Categories mirror what
// EA reports in its box score (passing … punting), and each renders only when a
// player recorded something in it (like ESPN's "No Kick Returns").

import { formatPct, formatDuration } from "./stat-fields";
import type { RedZone, DownEff } from "./play-by-play";

/** A player's game line plus display identity. Superset-compatible with a
 *  Prisma GamePlayerStat row spread with the player's name + jersey number. */
export type BoxLine = {
  playerId: number;
  name: string;
  number: number | null;
  passCmp: number; passAtt: number; passYds: number; passTd: number;
  passInt: number; passLong: number; sacked: number;
  rushAtt: number; rushYds: number; rushTd: number; rushLong: number;
  targets: number; rec: number; recYds: number; recTd: number; recLong: number;
  tacklesSolo: number; tacklesAst: number; tacklesForLoss: number; sacks: number;
  qbHurries: number; defInt: number; intYds: number; passesDefended: number;
  forcedFumbles: number; fumblesRec: number; defTd: number;
  fgMade: number; fgAtt: number; fgLong: number; xpMade: number; xpAtt: number;
  punts: number; puntYds: number; puntLong: number;
  krRet: number; krYds: number; krTd: number;
  prRet: number; prYds: number; prTd: number;
  fumbles: number; fumblesLost: number;
};

export type BoxCol = {
  label: string;
  /** One player's cell. */
  cell: (l: BoxLine) => string | number;
  /** The TEAM totals-row cell for this column. */
  total: (ls: BoxLine[]) => string | number;
};

export type BoxCategory = {
  key: string;
  title: string;
  /** Whether a player appears in this category's table. */
  eligible: (l: BoxLine) => boolean;
  cols: BoxCol[];
};

const sum = (ls: BoxLine[], f: (l: BoxLine) => number) =>
  ls.reduce((a, l) => a + f(l), 0);
const max = (ls: BoxLine[], f: (l: BoxLine) => number) =>
  ls.reduce((a, l) => Math.max(a, f(l)), 0);
/** Yards-per-attempt style average to one decimal; "0.0" when no attempts. */
const avg1 = (num: number, den: number) => (den > 0 ? (num / den).toFixed(1) : "0.0");
/** Half-step stat (sacks, TFL): drop the ".0" on whole numbers. */
const f1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Column for a plain counting stat (SUM in the TEAM row). */
const numCol = (label: string, f: (l: BoxLine) => number): BoxCol => ({
  label,
  cell: (l) => f(l),
  total: (ls) => sum(ls, f),
});
/** Column for a single-play "long" stat (MAX in the TEAM row). */
const maxCol = (label: string, f: (l: BoxLine) => number): BoxCol => ({
  label,
  cell: (l) => f(l),
  total: (ls) => max(ls, f),
});
/** Column for a half-step stat (SUM, formatted). */
const floatCol = (label: string, f: (l: BoxLine) => number): BoxCol => ({
  label,
  cell: (l) => f1(f(l)),
  total: (ls) => f1(sum(ls, f)),
});
/** "made/att" pair column, summed component-wise for the TEAM row. */
const ratioCol = (
  label: string,
  a: (l: BoxLine) => number,
  b: (l: BoxLine) => number,
): BoxCol => ({
  label,
  cell: (l) => `${a(l)}/${b(l)}`,
  total: (ls) => `${sum(ls, a)}/${sum(ls, b)}`,
});
/** Yards-per-X average column, recomputed from totals for the TEAM row. */
const avgCol = (
  label: string,
  num: (l: BoxLine) => number,
  den: (l: BoxLine) => number,
): BoxCol => ({
  label,
  cell: (l) => avg1(num(l), den(l)),
  total: (ls) => avg1(sum(ls, num), sum(ls, den)),
});

export const BOX_CATEGORIES: BoxCategory[] = [
  {
    key: "passing",
    title: "Passing",
    eligible: (l) => l.passAtt > 0,
    cols: [
      ratioCol("C/ATT", (l) => l.passCmp, (l) => l.passAtt),
      {
        label: "CMP%",
        cell: (l) => formatPct(l.passCmp, l.passAtt),
        total: (ls) => formatPct(sum(ls, (l) => l.passCmp), sum(ls, (l) => l.passAtt)),
      },
      numCol("YDS", (l) => l.passYds),
      avgCol("AVG", (l) => l.passYds, (l) => l.passAtt),
      numCol("TD", (l) => l.passTd),
      numCol("INT", (l) => l.passInt),
      maxCol("LNG", (l) => l.passLong),
      numCol("SACK", (l) => l.sacked),
    ],
  },
  {
    key: "rushing",
    title: "Rushing",
    eligible: (l) => l.rushAtt > 0,
    cols: [
      numCol("CAR", (l) => l.rushAtt),
      numCol("YDS", (l) => l.rushYds),
      avgCol("AVG", (l) => l.rushYds, (l) => l.rushAtt),
      numCol("TD", (l) => l.rushTd),
      maxCol("LNG", (l) => l.rushLong),
    ],
  },
  {
    key: "receiving",
    title: "Receiving",
    eligible: (l) => l.rec > 0 || l.targets > 0,
    cols: [
      numCol("REC", (l) => l.rec),
      numCol("YDS", (l) => l.recYds),
      avgCol("AVG", (l) => l.recYds, (l) => l.rec),
      numCol("TD", (l) => l.recTd),
      maxCol("LNG", (l) => l.recLong),
      numCol("TGT", (l) => l.targets),
    ],
  },
  {
    key: "fumbles",
    title: "Fumbles",
    eligible: (l) => l.fumbles > 0 || l.fumblesLost > 0 || l.fumblesRec > 0,
    cols: [
      numCol("FUM", (l) => l.fumbles),
      numCol("LOST", (l) => l.fumblesLost),
      numCol("REC", (l) => l.fumblesRec),
    ],
  },
  {
    key: "defense",
    title: "Defense",
    eligible: (l) =>
      l.tacklesSolo + l.tacklesAst > 0 ||
      l.sacks > 0 ||
      l.tacklesForLoss > 0 ||
      l.qbHurries > 0 ||
      l.defInt > 0 ||
      l.passesDefended > 0 ||
      l.forcedFumbles > 0 ||
      l.fumblesRec > 0 ||
      l.defTd > 0,
    cols: [
      {
        label: "TOT",
        cell: (l) => l.tacklesSolo + l.tacklesAst,
        total: (ls) => sum(ls, (l) => l.tacklesSolo + l.tacklesAst),
      },
      numCol("SOLO", (l) => l.tacklesSolo),
      numCol("AST", (l) => l.tacklesAst),
      floatCol("TFL", (l) => l.tacklesForLoss),
      floatCol("SACK", (l) => l.sacks),
      numCol("QBH", (l) => l.qbHurries),
      numCol("PD", (l) => l.passesDefended),
      numCol("FF", (l) => l.forcedFumbles),
      numCol("FR", (l) => l.fumblesRec),
      numCol("TD", (l) => l.defTd),
    ],
  },
  {
    key: "interceptions",
    title: "Interceptions",
    eligible: (l) => l.defInt > 0,
    cols: [
      numCol("INT", (l) => l.defInt),
      numCol("YDS", (l) => l.intYds),
      numCol("TD", (l) => l.defTd),
    ],
  },
  {
    key: "kickReturns",
    title: "Kick Returns",
    eligible: (l) => l.krRet > 0,
    cols: [
      numCol("NO", (l) => l.krRet),
      numCol("YDS", (l) => l.krYds),
      avgCol("AVG", (l) => l.krYds, (l) => l.krRet),
      numCol("TD", (l) => l.krTd),
    ],
  },
  {
    key: "puntReturns",
    title: "Punt Returns",
    eligible: (l) => l.prRet > 0,
    cols: [
      numCol("NO", (l) => l.prRet),
      numCol("YDS", (l) => l.prYds),
      avgCol("AVG", (l) => l.prYds, (l) => l.prRet),
      numCol("TD", (l) => l.prTd),
    ],
  },
  {
    key: "kicking",
    title: "Kicking",
    eligible: (l) => l.fgAtt > 0 || l.xpAtt > 0,
    cols: [
      ratioCol("FG", (l) => l.fgMade, (l) => l.fgAtt),
      {
        label: "PCT",
        cell: (l) => formatPct(l.fgMade, l.fgAtt),
        total: (ls) => formatPct(sum(ls, (l) => l.fgMade), sum(ls, (l) => l.fgAtt)),
      },
      maxCol("LNG", (l) => l.fgLong),
      ratioCol("XP", (l) => l.xpMade, (l) => l.xpAtt),
      numCol("PTS", (l) => l.fgMade * 3 + l.xpMade),
    ],
  },
  {
    key: "punting",
    title: "Punting",
    eligible: (l) => l.punts > 0,
    cols: [
      numCol("NO", (l) => l.punts),
      numCol("YDS", (l) => l.puntYds),
      avgCol("AVG", (l) => l.puntYds, (l) => l.punts),
      maxCol("LNG", (l) => l.puntLong),
    ],
  },
];

/**
 * A player's complete recorded line as one readable, comma-delimited string,
 * grouped by category — e.g. "Passing: 18/34, 246 yds, 2 TD, 1 INT  ·  Rushing:
 * 12-36, 1 TD". Only categories with something recorded appear; empty → "".
 * Lets the box-score edit list show every value without opening each line.
 */
export function formatStatLine(v: Record<string, number>): string {
  const n = (k: string) => v[k] ?? 0;
  const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  const segs: string[] = [];

  if (n("passAtt") > 0) {
    const p = [`${n("passCmp")}/${n("passAtt")}`, `${n("passYds")} yds`];
    if (n("passTd")) p.push(`${n("passTd")} TD`);
    if (n("passInt")) p.push(`${n("passInt")} INT`);
    if (n("passLong")) p.push(`LNG ${n("passLong")}`);
    if (n("sacked")) p.push(`${n("sacked")} sacked`);
    segs.push(`Passing: ${p.join(", ")}`);
  }
  if (n("rushAtt") > 0) {
    // "att-yds" reads cleanly for non-negative yards; spell it out when negative.
    const rush = n("rushYds") < 0 ? `${n("rushAtt")} for ${n("rushYds")} yds` : `${n("rushAtt")}-${n("rushYds")}`;
    const p = [rush];
    if (n("rushTd")) p.push(`${n("rushTd")} TD`);
    if (n("rushLong")) p.push(`LNG ${n("rushLong")}`);
    segs.push(`Rushing: ${p.join(", ")}`);
  }
  if (n("rec") > 0 || n("targets") > 0) {
    const p = [`${n("rec")} rec`, `${n("recYds")} yds`];
    if (n("recTd")) p.push(`${n("recTd")} TD`);
    if (n("targets")) p.push(`${n("targets")} tgt`);
    if (n("recLong")) p.push(`LNG ${n("recLong")}`);
    segs.push(`Receiving: ${p.join(", ")}`);
  }
  const tkl = n("tacklesSolo") + n("tacklesAst");
  const hasDef =
    tkl > 0 || n("sacks") > 0 || n("tacklesForLoss") > 0 || n("qbHurries") > 0 ||
    n("defInt") > 0 || n("passesDefended") > 0 || n("forcedFumbles") > 0 ||
    n("fumblesRec") > 0 || n("defTd") > 0;
  if (hasDef) {
    const p: string[] = [];
    if (tkl) p.push(`${tkl} tkl (${n("tacklesSolo")} solo/${n("tacklesAst")} ast)`);
    if (n("tacklesForLoss")) p.push(`${f(n("tacklesForLoss"))} TFL`);
    if (n("sacks")) p.push(`${f(n("sacks"))} sack`);
    if (n("qbHurries")) p.push(`${n("qbHurries")} QBH`);
    if (n("defInt")) p.push(`${n("defInt")} INT${n("intYds") ? ` (${n("intYds")} yds)` : ""}`);
    if (n("passesDefended")) p.push(`${n("passesDefended")} PD`);
    if (n("forcedFumbles")) p.push(`${n("forcedFumbles")} FF`);
    if (n("fumblesRec")) p.push(`${n("fumblesRec")} FR`);
    if (n("defTd")) p.push(`${n("defTd")} def TD`);
    segs.push(`Defense: ${p.join(", ")}`);
  }
  if (n("fgAtt") > 0 || n("xpAtt") > 0) {
    const p: string[] = [];
    if (n("fgAtt")) p.push(`${n("fgMade")}/${n("fgAtt")} FG${n("fgLong") ? ` (LNG ${n("fgLong")})` : ""}`);
    if (n("xpAtt")) p.push(`${n("xpMade")}/${n("xpAtt")} XP`);
    segs.push(`Kicking: ${p.join(", ")}`);
  }
  if (n("punts") > 0) {
    const p = [`${n("punts")} for ${n("puntYds")} yds`];
    if (n("puntLong")) p.push(`LNG ${n("puntLong")}`);
    segs.push(`Punting: ${p.join(", ")}`);
  }
  if (n("krRet") > 0 || n("prRet") > 0) {
    const p: string[] = [];
    if (n("krRet")) p.push(`${n("krRet")} KR ${n("krYds")} yds${n("krTd") ? `, ${n("krTd")} TD` : ""}`);
    if (n("prRet")) p.push(`${n("prRet")} PR ${n("prYds")} yds${n("prTd") ? `, ${n("prTd")} TD` : ""}`);
    segs.push(`Returns: ${p.join(", ")}`);
  }
  if (n("fumbles") > 0 || n("fumblesLost") > 0) {
    const p = [`${n("fumbles")} fum`];
    if (n("fumblesLost")) p.push(`${n("fumblesLost")} lost`);
    segs.push(`Fumbles: ${p.join(", ")}`);
  }

  return segs.join("  ·  ");
}

export type TeamStatRow = { label: string; value: string | number; sub?: boolean };

/**
 * The stored team-stat record (OCR import / manual entry). Every field here
 * OVERRIDES the value derived from the player lines + play-by-play when it's set
 * (non-zero); otherwise the box score falls back to the derived value. Penalties
 * and time of possession are only ever stored (nothing to derive them from).
 */
export type TeamTotals = {
  firstDowns: number;
  thirdDownConv: number; thirdDownAtt: number;
  fourthDownConv: number; fourthDownAtt: number;
  totalOffense: number; totalPlays: number; totalYards: number;
  passYds: number; rushYds: number; passCmp: number; passAtt: number; rushAtt: number;
  interceptions: number; fumblesLost: number; turnovers: number;
  redZoneTd: number; redZoneFg: number; redZoneTrips: number;
  penalties: number; penaltyYds: number; timeOfPossession: number;
};

/** "3/4 (75%)" — red-zone scores (TD + FG) over trips. */
const rzScore = (z: RedZone) => `${z.td + z.fg}/${z.trips} (${formatPct(z.td + z.fg, z.trips)})`;
/** "2/4 (50%)" — red-zone touchdowns over trips. */
const rzTd = (z: RedZone) => `${z.td}/${z.trips} (${formatPct(z.td, z.trips)})`;

/**
 * A team's box-score totals, mixing three sources so nothing has to be entered
 * twice: yardage / volume / turnovers come from that team's player lines, red-zone
 * efficiency from the play-by-play, and the situational stats (1st downs, 3rd/4th
 * down, penalties, time of possession) from the stored team-stat record. `stored`
 * may be null (no team-stats import yet) — the derived rows still fill in.
 */
export function teamStatRows(
  stored: TeamTotals | null,
  lines: BoxLine[],
  rz: RedZone,
  down: DownEff,
): TeamStatRow[] {
  // Derived-from-data values...
  const dPassYds = sum(lines, (l) => l.passYds);
  const dRushYds = sum(lines, (l) => l.rushYds);
  const dCmp = sum(lines, (l) => l.passCmp);
  const dAtt = sum(lines, (l) => l.passAtt);
  const dRushAtt = sum(lines, (l) => l.rushAtt);
  const dIntThrown = sum(lines, (l) => l.passInt);
  const dFumLost = sum(lines, (l) => l.fumblesLost);
  const dReturns = sum(lines, (l) => l.krYds) + sum(lines, (l) => l.prYds) + sum(lines, (l) => l.intYds);

  // ...each overridden by a non-zero stored value (manual entry / OCR import wins).
  const ov = (s: number | undefined, d: number) => (s && s > 0 ? s : d);
  const passYds = ov(stored?.passYds, dPassYds);
  const rushYds = ov(stored?.rushYds, dRushYds);
  const cmp = ov(stored?.passCmp, dCmp);
  const att = ov(stored?.passAtt, dAtt);
  const rushAtt = ov(stored?.rushAtt, dRushAtt);
  const totalOffense = ov(stored?.totalOffense, dPassYds + dRushYds);
  const totalPlays = ov(stored?.totalPlays, dAtt + dRushAtt + sum(lines, (l) => l.sacked));
  const totalYards = ov(stored?.totalYards, dPassYds + dRushYds + dReturns);
  const intThrown = ov(stored?.interceptions, dIntThrown);
  const fumLost = ov(stored?.fumblesLost, dFumLost);
  const turnovers = ov(stored?.turnovers, dIntThrown + dFumLost);
  const firstDowns = ov(stored?.firstDowns, down.firstDowns);
  const third = stored && stored.thirdDownAtt > 0
    ? { c: stored.thirdDownConv, a: stored.thirdDownAtt }
    : { c: down.thirdConv, a: down.thirdAtt };
  const fourth = stored && stored.fourthDownAtt > 0
    ? { c: stored.fourthDownConv, a: stored.fourthDownAtt }
    : { c: down.fourthConv, a: down.fourthAtt };
  const rzR: RedZone = stored && stored.redZoneTrips > 0
    ? { trips: stored.redZoneTrips, td: stored.redZoneTd, fg: stored.redZoneFg }
    : rz;
  const eff = (c: number, a: number) => (a > 0 ? `${c}-${a} (${formatPct(c, a)})` : `${c}-${a}`);

  return [
    { label: "1st Downs", value: firstDowns },
    { label: "3rd down efficiency", value: eff(third.c, third.a), sub: true },
    { label: "4th down efficiency", value: eff(fourth.c, fourth.a), sub: true },
    { label: "Total Offense", value: totalOffense },
    { label: "Total Plays", value: totalPlays, sub: true },
    { label: "Yards per play", value: avg1(totalOffense, totalPlays), sub: true },
    { label: "Passing", value: passYds, sub: true },
    { label: "Comp-Att", value: `${cmp}-${att}`, sub: true },
    { label: "Yards per pass", value: avg1(passYds, att), sub: true },
    { label: "Interceptions thrown", value: intThrown, sub: true },
    { label: "Rushing", value: rushYds, sub: true },
    { label: "Rushing Attempts", value: rushAtt, sub: true },
    { label: "Yards per rush", value: avg1(rushYds, rushAtt), sub: true },
    { label: "Total Yards (all-purpose)", value: totalYards },
    { label: "Red zone scores", value: rzScore(rzR) },
    { label: "Red zone TDs", value: rzTd(rzR), sub: true },
    { label: "Penalties", value: `${stored?.penalties ?? 0}-${stored?.penaltyYds ?? 0}` },
    { label: "Turnovers", value: turnovers },
    { label: "Fumbles lost", value: fumLost, sub: true },
    { label: "Possession", value: formatDuration(stored?.timeOfPossession ?? 0) },
  ];
}

export type TeamCompareRow = {
  label: string;
  us: string | number;
  them: string | number;
  sub?: boolean;
};

/**
 * The team-stat comparison as two columns (us vs opponent). BOTH columns are built
 * the same way — each team's countable stats from ITS player lines, red zone from
 * the play-by-play, situational stats from ITS stored record — so the opponent
 * column is just as complete as ours.
 */
export function teamCompareRows(
  teamStored: TeamTotals | null,
  oppStored: TeamTotals | null,
  teamLines: BoxLine[],
  oppLines: BoxLine[],
  rz: { team: RedZone; opp: RedZone },
  down: { team: DownEff; opp: DownEff },
): TeamCompareRow[] {
  const us = teamStatRows(teamStored, teamLines, rz.team, down.team);
  const them = teamStatRows(oppStored, oppLines, rz.opp, down.opp);
  return us.map((r, i) => ({ label: r.label, us: r.value, them: them[i].value, sub: r.sub }));
}
