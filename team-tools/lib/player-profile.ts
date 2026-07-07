// Small helpers for the player profile header: height formatting, status
// labels, and the "headline" stat tiles shown for a player's latest season.

import { PlayerStatus } from "@/generated/prisma/enums";

/** Inches -> `6'2"`; null/0 -> null (nothing to show). */
export function formatHeight(inches: number | null | undefined): string | null {
  if (inches == null || inches <= 0) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  ACTIVE: "Active",
  INJURED: "Injured (IR)",
  POSTACTIVE: "Graduated / Transferred",
};

export const PLAYER_STATUS_OPTIONS = (Object.keys(PLAYER_STATUS_LABELS) as PlayerStatus[]).map(
  (value) => ({ value, label: PLAYER_STATUS_LABELS[value] }),
);

/** Coerce untrusted form input to a valid PlayerStatus (defaults to ACTIVE). */
export function parseStatus(raw: unknown): PlayerStatus {
  const s = String(raw ?? "");
  return (Object.keys(PLAYER_STATUS_LABELS) as string[]).includes(s)
    ? (s as PlayerStatus)
    : "ACTIVE";
}

type Headline = { label: string; get: (v: Record<string, number>) => number };

// Ordered candidates; the first few non-zero become the header summary tiles,
// so the set adapts to the player's position without any position lookup.
const HEADLINE: Headline[] = [
  { label: "Pass Yds", get: (v) => v.passYds },
  { label: "Pass TD", get: (v) => v.passTd },
  { label: "Rush Yds", get: (v) => v.rushYds },
  { label: "Rush TD", get: (v) => v.rushTd },
  { label: "Rec", get: (v) => v.rec },
  { label: "Rec Yds", get: (v) => v.recYds },
  { label: "Tackles", get: (v) => v.tacklesSolo + v.tacklesAst },
  { label: "Sacks", get: (v) => v.sacks },
  { label: "INT", get: (v) => v.defInt },
  { label: "FG", get: (v) => v.fgMade },
];

export function headlineTiles(
  values: Record<string, number>,
  max = 4,
): { label: string; value: number }[] {
  return HEADLINE.map((h) => ({ label: h.label, value: h.get(values) }))
    .filter((t) => t.value > 0)
    .slice(0, max);
}
