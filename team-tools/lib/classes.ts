import type { PlayerClass, GameLocation } from "@/generated/prisma/enums";

/** Display labels for each class enum value. */
export const CLASS_LABELS: Record<PlayerClass, string> = {
  FRESHMAN: "Freshman",
  REDSHIRT_FRESHMAN: "Redshirt Freshman",
  SOPHOMORE: "Sophomore",
  REDSHIRT_SOPHOMORE: "Redshirt Sophomore",
  JUNIOR: "Junior",
  REDSHIRT_JUNIOR: "Redshirt Junior",
  SENIOR: "Senior",
  REDSHIRT_SENIOR: "Redshirt Senior",
  GRADUATED: "Graduated",
  TRANSFERRED: "Transferred",
};

/** Every class value, in the order they should appear in dropdowns. */
export const CLASS_ORDER: PlayerClass[] = [
  "FRESHMAN",
  "REDSHIRT_FRESHMAN",
  "SOPHOMORE",
  "REDSHIRT_SOPHOMORE",
  "JUNIOR",
  "REDSHIRT_JUNIOR",
  "SENIOR",
  "REDSHIRT_SENIOR",
  "GRADUATED",
  "TRANSFERRED",
];

/** Classes that mean the player is no longer active on the team. */
export const INACTIVE_CLASSES: PlayerClass[] = ["GRADUATED", "TRANSFERRED"];

/**
 * The class a player advances to when a new season starts. Seniors graduate;
 * graduated/transferred players stay put (they aren't carried forward).
 */
const ADVANCE_MAP: Record<PlayerClass, PlayerClass> = {
  FRESHMAN: "SOPHOMORE",
  REDSHIRT_FRESHMAN: "REDSHIRT_SOPHOMORE",
  SOPHOMORE: "JUNIOR",
  REDSHIRT_SOPHOMORE: "REDSHIRT_JUNIOR",
  JUNIOR: "SENIOR",
  REDSHIRT_JUNIOR: "REDSHIRT_SENIOR",
  SENIOR: "GRADUATED",
  REDSHIRT_SENIOR: "GRADUATED",
  GRADUATED: "GRADUATED",
  TRANSFERRED: "TRANSFERRED",
};

export function advanceClass(current: PlayerClass): PlayerClass {
  return ADVANCE_MAP[current];
}

export function isValidClass(value: string): value is PlayerClass {
  return value in CLASS_LABELS;
}

// Accept full names and common abbreviations / OCR-friendly spellings when
// importing rosters. Keys are compared after lowercasing, replacing "-" with a
// space, and collapsing whitespace.
const CLASS_ALIASES: Record<string, PlayerClass> = {
  fr: "FRESHMAN", fresh: "FRESHMAN", freshman: "FRESHMAN",
  "rs fr": "REDSHIRT_FRESHMAN", rsfr: "REDSHIRT_FRESHMAN", rfr: "REDSHIRT_FRESHMAN",
  "r fr": "REDSHIRT_FRESHMAN", "redshirt freshman": "REDSHIRT_FRESHMAN",
  so: "SOPHOMORE", soph: "SOPHOMORE", sophomore: "SOPHOMORE", sophmore: "SOPHOMORE",
  "rs so": "REDSHIRT_SOPHOMORE", rso: "REDSHIRT_SOPHOMORE",
  "redshirt sophomore": "REDSHIRT_SOPHOMORE", "redshirt sophmore": "REDSHIRT_SOPHOMORE",
  jr: "JUNIOR", junior: "JUNIOR",
  "rs jr": "REDSHIRT_JUNIOR", rjr: "REDSHIRT_JUNIOR", "redshirt junior": "REDSHIRT_JUNIOR",
  sr: "SENIOR", senior: "SENIOR",
  "rs sr": "REDSHIRT_SENIOR", rsr: "REDSHIRT_SENIOR", "redshirt senior": "REDSHIRT_SENIOR",
  gr: "GRADUATED", grad: "GRADUATED", graduate: "GRADUATED", graduated: "GRADUATED",
  transfer: "TRANSFERRED", transferred: "TRANSFERRED", xfer: "TRANSFERRED",
};

/** Resolve a raw class string (full name or abbreviation) to the enum, or null. */
export function normalizeClass(raw: string): PlayerClass | null {
  const key = raw.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  return CLASS_ALIASES[key] ?? null;
}

export const LOCATION_LABELS: Record<GameLocation, string> = {
  HOME: "Home",
  AWAY: "Away",
  NEUTRAL: "Neutral",
};

export const LOCATION_ORDER: GameLocation[] = ["HOME", "AWAY", "NEUTRAL"];

export function isValidLocation(value: string): value is GameLocation {
  return value in LOCATION_LABELS;
}
