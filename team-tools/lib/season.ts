// Which season is "current". The app defaults to it everywhere; history is
// everything else. Current = the latest by year (names are "YYYY-YYYY", and
// startYear sorts them). No flag to keep in sync — advancing simply creates a
// newer season, which becomes current.

import { db } from "@/lib/db";

/** The current (latest) season, or null if none exist. */
export function getCurrentSeason() {
  return db.season.findFirst({ orderBy: { startYear: "desc" } });
}

/** The current season's id, or null. */
export async function getCurrentSeasonId(): Promise<number | null> {
  const s = await db.season.findFirst({
    orderBy: { startYear: "desc" },
    select: { id: true },
  });
  return s?.id ?? null;
}
