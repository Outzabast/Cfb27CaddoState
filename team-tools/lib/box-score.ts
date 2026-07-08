// Turns a game's stored player lines + team totals into ESPN-style box-score
// tables. Pure presentation logic: every value here already lives on
// GamePlayerStat / GameTeamStat — nothing new is stored. Categories mirror what
// EA reports in its box score (passing … punting), and each renders only when a
// player recorded something in it (like ESPN's "No Kick Returns").

import { formatPct, formatDuration } from "./stat-fields";

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

/** GameTeamStat fields the team-stats read table needs. */
export type TeamTotals = {
  firstDowns: number;
  thirdDownConv: number; thirdDownAtt: number;
  fourthDownConv: number; fourthDownAtt: number;
  totalYards: number; passYds: number; rushYds: number;
  penalties: number; penaltyYds: number;
  turnovers: number; timeOfPossession: number;
};

/** ESPN-style team comparison rows. Passing comp/att, rush attempts, INTs
 *  thrown, and fumbles lost aren't stored on the team row — they're derived
 *  from the player lines so the two views can never disagree. */
export function teamStatRows(team: TeamTotals, lines: BoxLine[]): TeamStatRow[] {
  const cmp = sum(lines, (l) => l.passCmp);
  const att = sum(lines, (l) => l.passAtt);
  const intThrown = sum(lines, (l) => l.passInt);
  const rushAtt = sum(lines, (l) => l.rushAtt);
  const fumLost = sum(lines, (l) => l.fumblesLost);

  return [
    { label: "1st Downs", value: team.firstDowns },
    { label: "3rd down efficiency", value: `${team.thirdDownConv}-${team.thirdDownAtt}`, sub: true },
    { label: "4th down efficiency", value: `${team.fourthDownConv}-${team.fourthDownAtt}`, sub: true },
    { label: "Total Yards", value: team.totalYards },
    { label: "Passing", value: team.passYds },
    { label: "Comp-Att", value: `${cmp}-${att}`, sub: true },
    { label: "Yards per pass", value: avg1(team.passYds, att), sub: true },
    { label: "Interceptions thrown", value: intThrown, sub: true },
    { label: "Rushing", value: team.rushYds },
    { label: "Rushing Attempts", value: rushAtt, sub: true },
    { label: "Yards per rush", value: avg1(team.rushYds, rushAtt), sub: true },
    { label: "Penalties", value: `${team.penalties}-${team.penaltyYds}` },
    { label: "Turnovers", value: team.turnovers },
    { label: "Fumbles lost", value: fumLost, sub: true },
    { label: "Interceptions thrown", value: intThrown, sub: true },
    { label: "Possession", value: formatDuration(team.timeOfPossession) },
  ];
}

export type TeamCompareRow = {
  label: string;
  us: string | number;
  them: string | number;
  sub?: boolean;
};

/**
 * The team-stat comparison as two columns (us vs opponent). Our column keeps the
 * player-derived detail (comp-att, INTs thrown, ...); the opponent has only team
 * totals, so player-derived rows show "—" for them. `opp` null → all "—".
 */
export function teamCompareRows(
  team: TeamTotals,
  opp: TeamTotals | null,
  lines: BoxLine[],
): TeamCompareRow[] {
  const us = teamStatRows(team, lines);
  const oppByLabel: Record<string, string | number> = opp
    ? {
        "1st Downs": opp.firstDowns,
        "3rd down efficiency": `${opp.thirdDownConv}-${opp.thirdDownAtt}`,
        "4th down efficiency": `${opp.fourthDownConv}-${opp.fourthDownAtt}`,
        "Total Yards": opp.totalYards,
        Passing: opp.passYds,
        Rushing: opp.rushYds,
        Penalties: `${opp.penalties}-${opp.penaltyYds}`,
        Turnovers: opp.turnovers,
        Possession: formatDuration(opp.timeOfPossession),
      }
    : {};
  return us.map((r) => ({
    label: r.label,
    us: r.value,
    them: r.label in oppByLabel ? oppByLabel[r.label] : "—",
    sub: r.sub,
  }));
}
