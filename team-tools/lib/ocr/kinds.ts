import type { PlayerClass, GameLocation } from "@/generated/prisma/enums";

/** The screens we can OCR-import from. */
export const OCR_KINDS = ["roster", "schedule", "teamStats", "playerStats"] as const;
export type OcrKind = (typeof OCR_KINDS)[number];

export function isOcrKind(v: unknown): v is OcrKind {
  return typeof v === "string" && (OCR_KINDS as readonly string[]).includes(v);
}

/** One player read off a roster screen. `class` is null when unreadable. */
export type OcrRosterRow = {
  name: string;
  position: string;
  class: PlayerClass | null;
  number: number | null;
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
 * The normalized result the /api/ocr route returns for each kind. This is what
 * the staging dialogs render for the user to edit before importing.
 */
export type OcrResult =
  | { kind: "roster"; rows: OcrRosterRow[] }
  | { kind: "schedule"; rows: OcrScheduleRow[] }
  | { kind: "teamStats"; stats: Record<string, number>; scoreboard: OcrScoreboard | null }
  | { kind: "playerStats"; lines: OcrPlayerStatLine[] };

export type OcrResponse =
  | { ok: true; result: OcrResult }
  | { ok: false; error: string };
