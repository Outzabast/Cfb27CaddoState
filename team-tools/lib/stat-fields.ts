// Descriptors for the box-score stat fields. The same lists drive form
// rendering, server-side FormData parsing, and the stats display pages, so a
// column is only ever declared once. `name` matches the Prisma model field on
// GamePlayerStat / GameTeamStat. `float` marks half-step stats (sacks, TFL).
// `max` marks single-play "long" stats that aggregate with MAX, not SUM.

export type StatField = {
  name: string;
  label: string;
  float?: boolean;
  max?: boolean;
  /** "duration" fields are entered/displayed as mm:ss but stored as seconds. */
  format?: "duration";
};
export type StatGroup = { title: string; fields: StatField[] };

/**
 * A percentage derived from an attempts/made pair (never stored, always
 * computed). `group` is the stat group it renders inline within.
 */
export type DerivedPct = { label: string; num: string; den: string; group: string };

export const PLAYER_STAT_GROUPS: StatGroup[] = [
  {
    title: "Offensive",
    fields: [
      { name: "passCmp", label: "Pass Cmp" },
      { name: "passAtt", label: "Pass Att" },
      { name: "passYds", label: "Pass Yds" },
      { name: "passTd", label: "Pass TD" },
      { name: "passInt", label: "Pass INT" },
      { name: "passLong", label: "Pass Lng", max: true },
      { name: "sacked", label: "Sacked" },
      { name: "rushAtt", label: "Rush Att" },
      { name: "rushYds", label: "Rush Yds" },
      { name: "rushTd", label: "Rush TD" },
      { name: "rushLong", label: "Rush Lng", max: true },
      { name: "targets", label: "Targets" },
      { name: "rec", label: "Rec" },
      { name: "recYds", label: "Rec Yds" },
      { name: "recTd", label: "Rec TD" },
      { name: "recLong", label: "Rec Lng", max: true },
    ],
  },
  {
    title: "Defensive",
    fields: [
      { name: "tacklesSolo", label: "Solo" },
      { name: "tacklesAst", label: "Ast" },
      { name: "tacklesForLoss", label: "TFL", float: true },
      { name: "sacks", label: "Sacks", float: true },
      { name: "qbHurries", label: "Hurries" },
      { name: "defInt", label: "INT" },
      { name: "intYds", label: "INT Yds" },
      { name: "passesDefended", label: "PD" },
      { name: "forcedFumbles", label: "FF" },
      { name: "fumblesRec", label: "FR" },
      { name: "defTd", label: "Def TD" },
    ],
  },
  {
    title: "Kicking",
    fields: [
      { name: "fgMade", label: "FGM" },
      { name: "fgAtt", label: "FGA" },
      { name: "fgLong", label: "FG Lng", max: true },
      { name: "xpMade", label: "XPM" },
      { name: "xpAtt", label: "XPA" },
      { name: "punts", label: "Punts" },
      { name: "puntYds", label: "Punt Yds" },
      { name: "puntLong", label: "Punt Lng", max: true },
    ],
  },
  {
    title: "Other",
    fields: [
      { name: "krRet", label: "KR" },
      { name: "krYds", label: "KR Yds" },
      { name: "krTd", label: "KR TD" },
      { name: "prRet", label: "PR" },
      { name: "prYds", label: "PR Yds" },
      { name: "prTd", label: "PR TD" },
      { name: "fumbles", label: "Fum" },
      { name: "fumblesLost", label: "Fum Lost" },
    ],
  },
];

/** Percentages the player forms/pages compute automatically. */
export const PLAYER_PCTS: DerivedPct[] = [
  { label: "Comp %", num: "passCmp", den: "passAtt", group: "Offensive" },
  { label: "FG %", num: "fgMade", den: "fgAtt", group: "Kicking" },
  { label: "XP %", num: "xpMade", den: "xpAtt", group: "Kicking" },
];

export const TEAM_STAT_GROUPS: StatGroup[] = [
  {
    title: "Offensive",
    fields: [
      { name: "firstDowns", label: "1st Downs" },
      { name: "totalPlays", label: "Plays" },
      { name: "totalYards", label: "Total Yds" },
      { name: "passYds", label: "Pass Yds" },
      { name: "rushYds", label: "Rush Yds" },
      { name: "thirdDownConv", label: "3rd Conv" },
      { name: "thirdDownAtt", label: "3rd Att" },
      { name: "fourthDownConv", label: "4th Conv" },
      { name: "fourthDownAtt", label: "4th Att" },
      { name: "penalties", label: "Penalties" },
      { name: "penaltyYds", label: "Pen Yds" },
      { name: "turnovers", label: "Turnovers" },
      { name: "timeOfPossession", label: "TOP", format: "duration" },
    ],
  },
  {
    title: "Defensive",
    fields: [
      { name: "sacks", label: "Sacks", float: true },
      { name: "tacklesForLoss", label: "TFL", float: true },
      { name: "takeaways", label: "Takeaways" },
      { name: "defTd", label: "Def TD" },
    ],
  },
  {
    title: "Kicking",
    fields: [
      { name: "fgMade", label: "FGM" },
      { name: "fgAtt", label: "FGA" },
      { name: "xpMade", label: "XPM" },
      { name: "xpAtt", label: "XPA" },
      { name: "punts", label: "Punts" },
      { name: "puntYds", label: "Punt Yds" },
    ],
  },
  {
    title: "Other",
    fields: [
      { name: "returnYds", label: "Return Yds" },
      { name: "returnTd", label: "Return TD" },
    ],
  },
];

/** Percentages the team forms/pages compute automatically. */
export const TEAM_PCTS: DerivedPct[] = [
  { label: "3rd Down %", num: "thirdDownConv", den: "thirdDownAtt", group: "Offensive" },
  { label: "4th Down %", num: "fourthDownConv", den: "fourthDownAtt", group: "Offensive" },
  { label: "FG %", num: "fgMade", den: "fgAtt", group: "Kicking" },
  { label: "XP %", num: "xpMade", den: "xpAtt", group: "Kicking" },
];

/** Format made/attempts as a whole-number percentage, or "—" when no attempts. */
export function formatPct(num: number, den: number): string {
  if (!den || den <= 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

/** Seconds -> "m:ss" (minutes may exceed 59 for season totals, e.g. "312:45"). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Parse "mm:ss" (or a plain seconds number) into seconds. Blank -> 0. */
export function parseDuration(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const parts = s.split(":");
    const m = Number(parts[0]);
    const sec = Number(parts[1]);
    if (
      parts.length !== 2 ||
      !Number.isInteger(m) ||
      !Number.isInteger(sec) ||
      m < 0 ||
      sec < 0 ||
      sec > 59
    ) {
      throw new Error("Time must be mm:ss (seconds 0–59).");
    }
    return m * 60 + sec;
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) throw new Error("Time must be mm:ss.");
  return n;
}

/**
 * Read every field in `groups` from FormData. Blank -> 0 (so partial box scores
 * are fine). Throws on non-numeric input or a decimal in an integer field.
 */
export function parseStats(
  formData: FormData,
  groups: StatGroup[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const group of groups) {
    for (const f of group.fields) {
      const raw = String(formData.get(f.name) ?? "").trim();
      if (f.format === "duration") {
        out[f.name] = parseDuration(raw);
        continue;
      }
      if (raw === "") {
        out[f.name] = 0;
        continue;
      }
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`${f.label} must be a number.`);
      if (!f.float && !Number.isInteger(n)) {
        throw new Error(`${f.label} must be a whole number.`);
      }
      out[f.name] = n;
    }
  }
  return out;
}

/** Field names that aggregate with SUM / MAX, for Prisma aggregate() selects. */
export function sumFieldNames(groups: StatGroup[]): string[] {
  return groups.flatMap((g) => g.fields).filter((f) => !f.max).map((f) => f.name);
}
export function maxFieldNames(groups: StatGroup[]): string[] {
  return groups.flatMap((g) => g.fields).filter((f) => f.max).map((f) => f.name);
}

/** Build the `_sum` / `_max` select objects for a Prisma aggregate() call. */
export function aggregateSelect(groups: StatGroup[]) {
  const sum = Object.fromEntries(sumFieldNames(groups).map((n) => [n, true]));
  const max = Object.fromEntries(maxFieldNames(groups).map((n) => [n, true]));
  return { sum, max };
}

/** Merge a Prisma aggregate result ({ _sum, _max }) into one flat values map. */
export function mergeAggregate(
  agg: { _sum?: Record<string, number | null>; _max?: Record<string, number | null> },
  groups: StatGroup[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of groups) {
    for (const f of g.fields) {
      const src = f.max ? agg._max : agg._sum;
      out[f.name] = src?.[f.name] ?? 0;
    }
  }
  return out;
}
