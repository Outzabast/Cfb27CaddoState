import type { PlayerClass, GameLocation } from "@/generated/prisma/enums";

/** The screens we can OCR-import from. */
export const OCR_KINDS = [
  "roster",
  "schedule",
  "teamStats",
  "playerStats",
  "scoringSummary",
  "recruits",
  "playByPlay",
] as const;
export type OcrKind = (typeof OCR_KINDS)[number];

export function isOcrKind(v: unknown): v is OcrKind {
  return typeof v === "string" && (OCR_KINDS as readonly string[]).includes(v);
}

/** One player read off a roster screen. `class` is null when unreadable. Height/
 *  weight/hometown come from the player detail panel when it's visible. */
export type OcrRosterRow = {
  name: string;
  position: string;
  class: PlayerClass | null;
  number: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  hometownCity: string | null;
  hometownState: string | null;
};

/** One game read off a schedule screen. Scores are null when unplayed/unreadable. */
export type OcrScheduleRow = {
  week: number | null;
  date: string | null; // YYYY-MM-DD
  opponent: string;
  location: GameLocation;
  teamPoints: number | null;
  oppPoints: number | null;
};

/**
 * Quarter-by-quarter score read off a box score's scoreboard. Every field is
 * optional (a screenshot may only show some quarters). "team" = Caddo State.
 */
export type OcrScoreboard = {
  teamQ1?: number;
  teamQ2?: number;
  teamQ3?: number;
  teamQ4?: number;
  teamOt?: number;
  oppQ1?: number;
  oppQ2?: number;
  oppQ3?: number;
  oppQ4?: number;
  oppOt?: number;
};

export const SCOREBOARD_FIELDS: (keyof OcrScoreboard)[] = [
  "teamQ1", "teamQ2", "teamQ3", "teamQ4", "teamOt",
  "oppQ1", "oppQ2", "oppQ3", "oppQ4", "oppOt",
];

/** One player's stat line read off a box score. */
export type OcrPlayerStatLine = {
  playerName: string;
  position: string | null;
  /** Keyed by GamePlayerStat field name; only fields that were read appear. */
  stats: Record<string, number>;
};

/**
 * One entry read off a box score's scoring summary. "team" = Caddo State (the
 * "(CSU)" tag), "opp" = anyone else. `description` is the play text with the team
 * tag stripped; `points` is the model's best inference of the play's value.
 */
export type OcrScoringPlay = {
  quarter: number | null;
  team: "team" | "opp";
  clock: string | null;
  description: string;
  points: number | null;
};

/**
 * The normalized result the /api/ocr route returns for each kind. This is what
 * the staging dialogs render for the user to edit before importing.
 */
export type OcrResult =
  | { kind: "roster"; rows: OcrRosterRow[] }
  | { kind: "schedule"; rows: OcrScheduleRow[] }
  | {
      kind: "teamStats";
      stats: Record<string, number>;
      oppStats: Record<string, number>;
      scoreboard: OcrScoreboard | null;
    }
  | { kind: "playerStats"; lines: OcrPlayerStatLine[] }
  | { kind: "scoringSummary"; plays: OcrScoringPlay[]; scoreboard: OcrScoreboard | null }
  | { kind: "recruits"; rows: OcrRecruitRow[] }
  | { kind: "playByPlay"; plays: OcrPlay[] };

/** One recruiting prospect read off the CFB27 recruiting board. Ranks are the
 *  NAT/STA/POS numbers; `signed` reflects the SIGNED status on the board. */
export type OcrRecruitRow = {
  name: string;
  position: string;
  kind: "HIGH_SCHOOL" | "TRANSFER";
  stars: number | null;
  nationalRank: number | null;
  stateRank: number | null;
  positionRank: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  previousSchool: string | null;
  signed: boolean;
};

/** A typed play outcome the OCR classifies (lowercase mirror of the PlayType enum). */
export type OcrPlayType =
  | "scrimmage"
  | "touchdown"
  | "extra_point"
  | "extra_point_missed"
  | "two_point"
  | "two_point_failed"
  | "field_goal"
  | "field_goal_missed"
  | "safety"
  | "punt"
  | "interception"
  | "fumble"
  | "turnover_on_downs"
  | "kickoff"
  | "penalty"
  | "kneel"
  | "end_period"
  | "other";

/** One play from an in-game play-by-play screen. "team" = Caddo State has the ball;
 *  null means the model couldn't tell (the importer carries the last team forward). */
export type OcrPlay = {
  quarter: number | null;
  clock: string | null;
  team: "team" | "opp" | null;
  situation: string | null;
  description: string;
  /** Typed outcome, if the model can classify it. */
  playType?: OcrPlayType | null;
  /** Points scored on this play (0/absent for non-scoring). */
  points?: number | null;
  /** Which team scored the points — "team"/"opp"; null → the possessing team. */
  scoringTeam?: "team" | "opp" | null;
};

export type OcrResponse =
  | { ok: true; result: OcrResult }
  | { ok: false; error: string };
