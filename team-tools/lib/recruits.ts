// Recruit helpers: funnel-status labels/ordering, and small formatters for the
// 247-style scouting fields (stars, composite rating, rankings). Kept UI-free so
// both server components and the media layer can share them.

import type { RecruitStatus, RecruitKind } from "@/generated/prisma/enums";

export const RECRUIT_KIND_LABELS: Record<RecruitKind, string> = {
  HIGH_SCHOOL: "High school",
  TRANSFER: "Transfer",
};

export const RECRUIT_KIND_ORDER: RecruitKind[] = ["HIGH_SCHOOL", "TRANSFER"];

/** Coerce untrusted input to a valid recruit kind (defaults to HIGH_SCHOOL). */
export function parseRecruitKind(raw: unknown): RecruitKind {
  const s = String(raw ?? "");
  return (Object.keys(RECRUIT_KIND_LABELS) as string[]).includes(s) ? (s as RecruitKind) : "HIGH_SCHOOL";
}

export const RECRUIT_STATUS_LABELS: Record<RecruitStatus, string> = {
  TARGET: "Target",
  OFFERED: "Offered",
  COMMITTED: "Committed",
  SIGNED: "Signed",
  ENROLLED: "Enrolled",
  DECOMMITTED: "Decommitted",
  LOST: "Lost",
};

/** Funnel order for dropdowns / sorting (top of board → landed → fell through). */
export const RECRUIT_STATUS_ORDER: RecruitStatus[] = [
  "TARGET",
  "OFFERED",
  "COMMITTED",
  "SIGNED",
  "ENROLLED",
  "DECOMMITTED",
  "LOST",
];

/** Statuses that mean the prospect is committed to us in some form. */
export const COMMITTED_STATUSES: RecruitStatus[] = ["COMMITTED", "SIGNED", "ENROLLED"];

/** Coerce untrusted input to a valid status (defaults to TARGET). */
export function parseRecruitStatus(raw: unknown): RecruitStatus {
  const s = String(raw ?? "");
  return (Object.keys(RECRUIT_STATUS_LABELS) as string[]).includes(s)
    ? (s as RecruitStatus)
    : "TARGET";
}

/** Clamp a star rating to 0–5 (whole stars). */
export function parseStars(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

/** Composite rating (0–1) → "0.9421", or null when unset/invalid. */
export function formatRating(rating: number | null | undefined): string | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return rating.toFixed(4);
}

/** "★★★★☆"-style string for a 0–5 star count. */
export function starString(stars: number): string {
  const s = Math.min(5, Math.max(0, Math.round(stars)));
  return "★".repeat(s) + "☆".repeat(5 - s);
}

/** "Dallas, TX" / "Dallas" / "TX" / null from the two origin parts. */
export function formatHometown(
  city: string | null | undefined,
  state: string | null | undefined,
): string | null {
  const c = city?.trim() || "";
  const st = state?.trim() || "";
  if (c && st) return `${c}, ${st}`;
  return c || st || null;
}
