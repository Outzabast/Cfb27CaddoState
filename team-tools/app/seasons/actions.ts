"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { advanceClass, INACTIVE_CLASSES } from "@/lib/classes";
import { recomputeAllSentiment } from "@/lib/sentiment";

/** Create a season (and its empty roster) from scratch, e.g. the very first one. */
export async function createSeason(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const startYear = Number(formData.get("startYear"));
  const endYear = Number(formData.get("endYear"));

  if (!name) throw new Error("Season name is required.");
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new Error("Start and end year must be whole numbers.");
  }

  const conference = String(formData.get("conference") ?? "").trim() || null;

  await db.season.create({
    data: { name, startYear, endYear, conference, roster: { create: {} } },
  });
  after(() => recomputeAllSentiment());
  revalidatePath("/seasons");
}

/** Set (or clear) a season's manual fan-sentiment baseline override, 0–100. */
export async function setSentimentBaseline(formData: FormData) {
  const id = Number(formData.get("seasonId"));
  if (!Number.isInteger(id)) throw new Error("Bad season id.");

  const raw = String(formData.get("baseline") ?? "").trim();
  let override: number | null = null;
  if (raw !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw new Error("Baseline must be a whole number 0–100 (or blank to auto-derive).");
    }
    override = n;
  }

  await db.season.update({ where: { id }, data: { sentimentBaselineOverride: override } });
  await recomputeAllSentiment();
  revalidatePath("/seasons");
}

/** Set the conference a season played in (shown on its schedule). */
export async function setSeasonConference(formData: FormData) {
  const id = Number(formData.get("seasonId"));
  if (!Number.isInteger(id)) throw new Error("Bad season id.");
  const conference = String(formData.get("conference") ?? "").trim() || null;

  await db.season.update({ where: { id }, data: { conference } });
  revalidatePath(`/seasons/${id}/schedule`);
}

export async function deleteSeason(formData: FormData) {
  const id = Number(formData.get("seasonId"));
  if (!Number.isInteger(id)) throw new Error("Bad season id.");
  await db.season.delete({ where: { id } });
  revalidatePath("/seasons");
}

/**
 * Start the season that follows `fromSeasonId`. Creates the next season + roster
 * and adds a NEW SeasonPlayer row for each returning player with their class
 * stepped up. Seniors advance to GRADUATED and are not carried over. The previous
 * season's SeasonPlayer rows are left untouched, so its record keeps the classes
 * those players actually had that year.
 */
export async function advanceSeason(formData: FormData) {
  const fromSeasonId = Number(formData.get("fromSeasonId"));
  if (!Number.isInteger(fromSeasonId)) throw new Error("Bad season id.");

  const newSeasonId = await db.$transaction(async (tx) => {
    const prev = await tx.season.findUniqueOrThrow({
      where: { id: fromSeasonId },
      include: { roster: { include: { players: true } } },
    });

    const startYear = prev.startYear + 1;
    const endYear = prev.endYear + 1;
    const name = `${startYear}-${endYear}`;

    const next = await tx.season.create({
      data: { name, startYear, endYear, roster: { create: {} } },
      include: { roster: true },
    });
    const nextRosterId = next.roster!.id;

    for (const sp of prev.roster?.players ?? []) {
      const nextClass = advanceClass(sp.class);
      if (INACTIVE_CLASSES.includes(nextClass)) continue; // graduated / transferred
      await tx.seasonPlayer.create({
        data: {
          seasonRosterId: nextRosterId,
          playerId: sp.playerId,
          playerName: sp.playerName,
          position: sp.position,
          class: nextClass,
          number: sp.number,
        },
      });
    }

    return next.id;
  });

  after(() => recomputeAllSentiment());
  revalidatePath("/seasons");
  redirect(`/seasons/${newSeasonId}/roster`);
}
