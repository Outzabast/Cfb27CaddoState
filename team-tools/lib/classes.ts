import { PlayerClass, GameLocation } from "@/generated/prisma/enums";

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

export const LOCATION_LABELS: Record<GameLocation, string> = {
  HOME: "Home",
  AWAY: "Away",
  NEUTRAL: "Neutral",
};

export const LOCATION_ORDER: GameLocation[] = ["HOME", "AWAY", "NEUTRAL"];

export function isValidLocation(value: string): value is GameLocation {
  return value in LOCATION_LABELS;
}
