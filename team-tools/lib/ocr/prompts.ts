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
You are reading screenshots from the video game EA Sports College Football 27.
You may be given SEVERAL images that are different parts of the SAME screen (the
user scrolled, or captured different sections/categories). Treat them together and
return ONE combined result covering all of them.
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
    { "name": string, "position": string, "class": string|null, "number": number|null,
      "height": string|null, "weightLbs": number|null, "hometown": string|null }
  ]
}
- "name" is the player's full name (from the row, or the DETAIL PANEL header when it's the selected player).
- "position" is the abbreviation shown (QB, RB, WR, LT, MLB, CB, K, LEDG, WILL, ...), 8 chars max.
- "class" is the YEAR column. A "(RS)" tag means the player has redshirted — combine them: "SR (RS)" → "Redshirt Senior", "SO (RS)" → "Redshirt Sophomore", "SR" → "Senior". Valid meanings: ${CLASS_HINT}. Use null if not shown.
- "number" is the jersey number as an integer (e.g. "#7" → 7), or null if not shown.
- "height"/"weightLbs"/"hometown" come from the player DETAIL PANEL (right side) when it is open — read the HEIGHT & WEIGHT (e.g. "5'11\" | 208 lbs" → height "5'11\"", weightLbs 208) and HOMETOWN ("Wallingford, CT") for THAT selected player only. Leave these null for every other row (the table columns are ratings, not these).
Include every player row you can read; omit rows you cannot. If several images are
given, return all unique players across them (a player shown twice merges into one).`,
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
Include every game row you can read. If several images are given, return all games across them (no duplicates).`,
      };

    case "teamStats":
      return {
        system: SHARED_RULES,
        instruction: `This is a single game's box score. It shows a TEAM STATS comparison with TWO columns: the user's team (Caddo State) and the OPPONENT. Read BOTH columns. Output:
{
  "scoreboard": { "teamQ1": number, "teamQ2": number, "teamQ3": number, "teamQ4": number, "teamOt": number,
                  "oppQ1": number, "oppQ2": number, "oppQ3": number, "oppQ4": number, "oppOt": number } | null,
  "stats": { <field>: number, ... },
  "oppStats": { <field>: number, ... }
}
SCOREBOARD (only if a quarter-by-quarter score line is visible; otherwise use null):
- "team" = the Caddo State row, "opp" = the opponent row. Read each quarter (1-4) and OT.
- Omit "teamOt"/"oppOt" (or use 0) if the game did not go to overtime. Omit any quarter not shown.
TEAM STATS — use ONLY these field keys (omit any you cannot read):
${statFieldList(TEAM_STAT_GROUPS)}
- "stats" = the CADDO STATE column. "oppStats" = the OPPONENT column, using the SAME field keys.
- If only one team's column is visible, fill only that team's object and leave the other empty ({}).
Notes / label mapping (this is the EA team-stats comparison screen):
- "First Downs" -> firstDowns. "Total Plays" -> totalPlays. "Passing Yards" -> passYds.
- CRITICAL: "Total Offense" and "Total Yards" are TWO SEPARATE stats — never merge them or copy one into the other. "Total Offense" (passing + rushing production) -> totalOffense. "Total Yards" (all-purpose: total offense PLUS return and defensive yards; a distinct, usually larger number) -> totalYards. Capture whichever of the two the screen shows into its OWN key; if only one appears, leave the other's key omitted.
- "Rushes | Yards | TDs" (e.g. "45 | 224 | 3") -> rushAtt=45, rushYds=224, rushTd=3.
- "Comp | Att | TDs" (e.g. "31 | 47 | 2") -> passCmp=31, passAtt=47, passTd=2.
- "3rd Down Conv" "9 | 18 (50%)" -> thirdDownConv=9, thirdDownAtt=18 (ignore the %). Same shape for "4th Down Conv" -> fourthDownConv/fourthDownAtt and "2-Point Conv" -> twoPointConv/twoPointAtt.
- "Red Zone TD | FG | %" (e.g. "5 | 2 | 100 %") -> redZoneTd=5, redZoneFg=2, and redZoneTrips = total red-zone trips: round((redZoneTd+redZoneFg) / (percent/100)); if the percent is 100 or 0, redZoneTrips = redZoneTd+redZoneFg.
- "Turnovers" "2 (+1)" -> turnovers=2 (ignore the margin in parentheses). "Interceptions" -> interceptions. "Fumble Lost" -> fumblesLost.
- "PR Yards" -> prYds. "KR Yards" -> krYds.
- "Punts" shown as a decimal average (e.g. "53.5") -> puntAvg (a decimal is fine).
- "Penalties" "0 | 0" -> penalties (count) then penaltyYds. "Possession Time" "mm:ss" -> timeOfPossession.
- IGNORE the "Score" row (the scoreboard covers it) and the derived ratios "Yards Per Play / Rush / Pass" (do not output them).
- Time of possession is a string "mm:ss".
- Stats span several images (the user scrolls). Combine them into ONE "stats" and ONE "oppStats" object; read the "scoreboard" from whichever image shows the header quarter-by-quarter line.`,
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
- Include EVERY player row, even ones with all zeros.
- Several images may be given, each a different category (e.g. one PASSING, one RUSHING). MERGE a player's categories into ONE line — the same person is the same first-initial + last name (e.g. "B.Joiner" passing and "B.Joiner" rushing → one line with both).`,
      };

    case "scoringSummary":
      return {
        system: SHARED_RULES,
        instruction: `This is a box score's SCORING SUMMARY. The header shows the scoreboard by quarter and a "Quarter" heading (First/Second/Third/Fourth); below it, "SCORING SUMMARY" lists each scoring play for that quarter. Each play line looks like:
"(CSU) Isaac Boone, 34 Yd run (Danny Paul kick), 9:53" — a team tag, the play, and the game clock.
Output:
{
  "scoreboard": { "teamQ1": number, ..., "oppQ4": number, "teamOt": number, "oppOt": number } | null,
  "plays": [
    { "quarter": number, "team": "team"|"opp", "clock": string|null, "description": string, "points": number|null }
  ]
}
- The user's team is CADDO STATE, tagged "(CSU)". A play tagged "(CSU)" is "team"; ANY OTHER tag (e.g. "(KENN)") is "opp".
- "quarter" is the period the play happened in (1-4; 5+ for overtime), taken from the "Quarter" heading of the image the play is under.
- "clock" is the time shown at the end of the line ("11:54", "0:19"), or null if absent.
- "description" is the play text WITHOUT the leading team tag and WITHOUT the trailing clock — e.g. "Isaac Boone, 34 Yd run (Danny Paul kick)", "Team Safety", "Daniel Kinney, 28 Yd FG".
- "points" is the play's value if you can infer it: touchdown + kick = 7; touchdown + 2-pt conversion = 8; touchdown with no PAT shown = 6; field goal = 3; safety = 2. Use null if unsure.
- SCOREBOARD: read the quarter-by-quarter line from the header if visible (as in the team-stats screen), else null. Omit OT unless the game went to overtime.
- Several images are usually given (one per quarter). Return ALL plays across them, each tagged with its own quarter — keep them in on-screen order.
- OVERLAPPING IMAGES: images may overlap and repeat scoring plays. Each play shows a clock time — use the time + quarter + text to recognize the SAME scoring play across images and output it only ONCE.`,
      };

    case "recruits":
      return {
        system: SHARED_RULES,
        instruction: `This is the CFB27 RECRUITING BOARD. The large card on the right is one prospect's full detail; a list on the left may show more prospects (with shorter data). Read every prospect you can. Output:
{
  "recruits": [
    { "name": string, "position": string, "kind": "HIGH_SCHOOL"|"TRANSFER",
      "stars": number|null, "nationalRank": number|null, "stateRank": number|null, "positionRank": number|null,
      "height": string|null, "weightLbs": number|null, "hometown": string|null, "previousSchool": string|null, "signed": boolean }
  ]
}
From the DETAIL CARD (most complete — prefer it):
- "name": the prospect's full name, in normal case (e.g. header "SHAUN ROZEBOOM" → "Shaun Rozeboom").
- "position": the POSITION value (QB, RT, SS, …), 8 chars max.
- "stars": count of FILLED stars (★) in the rating, 0–5.
- The stat row reads "NAT: 1974 | STA: 72 | POS: 151" → nationalRank=1974, stateRank=72, positionRank=151. Use null for any not shown.
- "height": the HEIGHT & WEIGHT value's height exactly as shown, e.g. "6'6\"". "weightLbs": the weight number (284).
- "hometown": the HOMETOWN value, e.g. "New Orleans, LA".
- "kind": "HIGH_SCHOOL" when CLASS is "High School"; "TRANSFER" for a transfer-portal prospect (CLASS shows a college / eligibility, or they're on the Transfer Portal tab). For a transfer, put the prior program in "previousSchool".
- "signed": true if this prospect shows a SIGNED status/banner, else false.
From LIST ROWS (left sidebar), if present: read name (may be an initial + surname like "S. Rozeboom"), position, stars, and signed. Leave unknown fields null.
- If the same prospect appears in both the list and the detail card, return them as separate entries — they'll be reconciled later; just prefer the fuller detail-card name.`,
      };

    case "playByPlay":
      return {
        system: SHARED_RULES,
        instruction: `This is a game PLAY-BY-PLAY (the in-game drive log). It's a running list of plays. A team banner (e.g. "NIU at 15:00" or "CADDO STATE at 14:09") marks who has the ball; every play under a banner belongs to THAT team until the next banner. Each play shows a situation line ("1st & 10 on NIU 25", "Kickoff on CSU 35", "4th & 14 on NIU 21") and a detail line "(15:00 Q1) <description>". Output, in top-to-bottom order:
{
  "plays": [
    { "quarter": number|null, "clock": string|null, "team": "team"|"opp"|null,
      "situation": string|null, "description": string,
      "playType": string|null, "points": number|null, "scoringTeam": "team"|"opp"|null }
  ]
}
- The user's team is CADDO STATE (abbreviated CSU). Plays under a Caddo State / CSU banner are "team"; under any other team's banner are "opp". If you genuinely CANNOT tell whose ball it is, set "team": null — the importer defaults it to whoever had it on the previous play. Prefer null over guessing.
- "quarter" from the "Q1"/"Q2"… in the detail line (1-4; 5+ for OT). ALWAYS include "clock" — the "mm:ss" in the detail line (e.g. "15:00", "14:24") — it's what orders the plays.
- "situation" is the down-and-distance / field-position line exactly as shown (e.g. "1st & 10 on NIU 25"), or null. "description" is the play text (e.g. "Ryan Browne pass to Joe Stein for 6 yards.").
- CLASSIFY each play with "playType" (one of): scrimmage (ordinary rush/pass), touchdown, extra_point, extra_point_missed, two_point, two_point_failed, field_goal, field_goal_missed, safety, punt, interception, fumble, turnover_on_downs, kickoff, penalty, kneel, end_period, other. Use "scrimmage" for a normal play that doesn't score or end the drive.
- SCORING: set "points" to the points this SINGLE play scored (touchdown=6, extra point good=1, two-point good=2, field goal good=3, safety=2; everything else 0), and "scoringTeam" to who got them. CRITICAL — the scorer is NOT always the team with the ball:
  · pick-six ("intercepted … returned for a TD") and fumble-return TD → playType "interception"/"fumble", points 6, scoringTeam = the DEFENDING team (the OTHER team).
  · punt-return TD → playType "punt", points 6, scoringTeam = the RETURNING team (the OTHER team).
  · kickoff-return TD → playType "kickoff", points 6, scoringTeam = the RECEIVING team.
  · safety → points 2, scoringTeam = the DEFENDING team.
  · a missed/blocked kick or failed conversion → points 0.
  Leave scoringTeam null when points is 0.
- A DRIVE ends with a concluding play: a touchdown (then its extra_point or two_point on the NEXT line), a made field_goal, a punt, a turnover (interception/fumble/turnover_on_downs), a safety, or end_period (end of quarter/half/game). In OT a walk-off touchdown may have no extra point. Classify these correctly so drives can be scored.
- OVERLAPPING IMAGES: the screens are captured by scrolling, so consecutive images overlap and repeat some plays. DON'T try to dedupe — just transcribe EVERY play you can read, exactly once per time it appears on screen, keeping its "(mm:ss Qn)" timestamp and text. The app merges repeats internally (same quarter + clock + text = one play), so an accurate timestamp on every play matters more than avoiding repeats.
- Transcribe plays in top-to-bottom order across the images — do not reorder.`,
      };
  }
}
