import { PLAYER_STAT_GROUPS, TEAM_STAT_GROUPS, type StatGroup } from "@/lib/stat-fields";
import { CLASS_LABELS, LOCATION_LABELS } from "@/lib/classes";
import type { OcrKind } from "./kinds";

/** A flat "key — Label" listing of every stat field, for the model to key on. */
function statFieldList(groups: StatGroup[]): string {
  return groups
    .flatMap((g) =>
      g.fields.map((f) => {
        const kind = f.format === "duration" ? " (mm:ss)" : f.float ? " (may be .5)" : "";
        return `  ${f.name} — ${f.label}${kind}`;
      }),
    )
    .join("\n");
}

const SHARED_RULES = `
You are reading a screenshot from the video game EA Sports College Football 27.
Extract ONLY the data that is clearly visible. Do not guess or invent values.
If a field is not present or is unreadable, omit it (or use null) rather than filling it in.
Respond with a single JSON object and nothing else — no prose, no markdown fences.`.trim();

const CLASS_HINT = Object.values(CLASS_LABELS).join(", ");
const LOCATION_HINT = Object.values(LOCATION_LABELS).join(", ");

/** System + user instruction for a given OCR kind. */
export function buildPrompt(kind: OcrKind): { system: string; instruction: string } {
  switch (kind) {
    case "roster":
      return {
        system: SHARED_RULES,
        instruction: `This is a team roster screen. For every player row you can read, output:
{
  "players": [
    { "name": string, "position": string, "class": string|null, "number": number|null }
  ]
}
- "name" is the player's full name.
- "position" is the abbreviation shown (QB, RB, WR, LT, MLB, CB, K, ...), 8 chars max.
- "class" is the year/class exactly as shown (e.g. "FR", "RS SO", "Senior"). Valid meanings: ${CLASS_HINT}. Use null if not shown.
- "number" is the jersey number as an integer, or null if not shown.
Include every player row you can read; omit rows you cannot.`,
      };

    case "schedule":
      return {
        system: SHARED_RULES,
        instruction: `This is a season schedule screen for the user's team (Caddo State). For every game you can read, output:
{
  "games": [
    { "week": number|null, "date": string|null, "opponent": string, "location": string, "teamPoints": number|null, "oppPoints": number|null }
  ]
}
- "week" is the week number (0-20) or null.
- "date" is ISO YYYY-MM-DD if a date is shown, else null.
- "opponent" is the other team's name (strip any "@" or "vs").
- "location" is one of: ${LOCATION_HINT}. "@" or "at" means Away; "vs" means Home; a neutral-site/bowl game is Neutral. Default to Home if unclear.
- "teamPoints"/"oppPoints" are the final score from Caddo State's perspective (teamPoints = Caddo State). Use null for both if the game has not been played.
Include every game row you can read.`,
      };

    case "teamStats":
      return {
        system: SHARED_RULES,
        instruction: `This is a single game's box score for the user's team (Caddo State). Output:
{
  "scoreboard": { "teamQ1": number, "teamQ2": number, "teamQ3": number, "teamQ4": number, "teamOt": number,
                  "oppQ1": number, "oppQ2": number, "oppQ3": number, "oppQ4": number, "oppOt": number } | null,
  "stats": { <field>: number, ... }
}
SCOREBOARD (only if a quarter-by-quarter score line is visible; otherwise use null):
- "team" = the Caddo State row, "opp" = the opponent row. Read each quarter (1-4) and OT.
- Omit "teamOt"/"oppOt" (or use 0) if the game did not go to overtime. Omit any quarter not shown.
TEAM STATS — use ONLY these field keys (omit any you cannot read):
${statFieldList(TEAM_STAT_GROUPS)}
Notes:
- Time of possession (timeOfPossession) is a string "mm:ss".
- If a stat is shown as made/attempts (e.g. 3rd down "9-18", FG "2/3"), split it into the two keys (thirdDownConv=9, thirdDownAtt=18; fgMade=2, fgAtt=3).
- If a stat is a triple like "Rushes-Yards-TDs 36-135-1", map ONLY the fields that exist here — use the Yards value for rushYds (there is no team rush-attempts or rush-TD field).
- "Passing Yards" -> passYds. All other values are plain numbers.
- This screen may show only part of the team stats (the user scrolls); just read what is visible.
Use the Caddo State column when two teams' columns are shown.`,
      };

    case "playerStats":
      return {
        system: SHARED_RULES,
        instruction: `This is ONE category's player stats table from a box score. The category is shown in a header (e.g. PASSING, RUSHING, RECEIVING, DEFENSE, KICKING) and by the columns. For every player row, output:
{
  "lines": [
    { "playerName": string, "position": string|null, "stats": { <field>: number, ... } }
  ]
}
Map the visible columns to that category's fields. Use ONLY these stat field keys (omit any not shown):
${statFieldList(PLAYER_STAT_GROUPS)}
Category mapping for generic column headers (use the screen's category to disambiguate):
- PASSING table: YARDS->passYds, TD->passTd, INT->passInt, LONG->passLong, COMP->passCmp, ATT->passAtt, SACKS->sacked (times the QB was sacked). A "C/A" like "20/31" means passCmp=20, passAtt=31. Ignore RATING/COMP%/YPC.
- RUSHING table: ATT->rushAtt, YARDS->rushYds, TD->rushTd, LONG->rushLong.
- RECEIVING table: REC->rec, YARDS->recYds, TD->recTd, LONG->recLong, TGT->targets.
- DEFENSE table: TKL/TOT->tacklesSolo, SOLO->tacklesSolo, AST->tacklesAst, SACKS->sacks, TFL->tacklesForLoss, INT->defInt, PD->passesDefended, FF->forcedFumbles.
- KICKING table: FG/FGM & FGA->fgMade/fgAtt, XP->xpMade/xpAtt, LONG->fgLong; punting PUNTS->punts, YDS->puntYds.
Notes:
- "playerName" is exactly as shown, usually first-initial + last name like "B.Joiner" or "T.Turner".
- Include EVERY player row, even ones with all zeros.`,
      };
  }
}
