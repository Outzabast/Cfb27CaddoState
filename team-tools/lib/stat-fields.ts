// Descriptors for the box-score stat fields. The same lists drive BOTH the form
// rendering and the server-side FormData parsing, so a column only ever needs to
// be declared once. `name` matches the Prisma model field on GamePlayerStat /
// GameTeamStat. `float` marks half-step stats (sacks, TFL).

export type StatField = { name: string; label: string; float?: boolean };
export type StatGroup = { title: string; fields: StatField[] };

export const PLAYER_STAT_GROUPS: StatGroup[] = [
  {
    title: "Offensive",
    fields: [
      { name: "passCmp", label: "Pass Cmp" },
      { name: "passAtt", label: "Pass Att" },
      { name: "passYds", label: "Pass Yds" },
      { name: "passTd", label: "Pass TD" },
      { name: "passInt", label: "Pass INT" },
      { name: "passLong", label: "Pass Lng" },
      { name: "sacked", label: "Sacked" },
      { name: "rushAtt", label: "Rush Att" },
      { name: "rushYds", label: "Rush Yds" },
      { name: "rushTd", label: "Rush TD" },
      { name: "rushLong", label: "Rush Lng" },
      { name: "targets", label: "Targets" },
      { name: "rec", label: "Rec" },
      { name: "recYds", label: "Rec Yds" },
      { name: "recTd", label: "Rec TD" },
      { name: "recLong", label: "Rec Lng" },
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
      { name: "fgLong", label: "FG Lng" },
      { name: "xpMade", label: "XPM" },
      { name: "xpAtt", label: "XPA" },
      { name: "punts", label: "Punts" },
      { name: "puntYds", label: "Punt Yds" },
      { name: "puntLong", label: "Punt Lng" },
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
      { name: "timeOfPossession", label: "TOP (sec)" },
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
