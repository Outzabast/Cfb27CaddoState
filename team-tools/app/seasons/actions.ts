"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { advanceClass, INACTIVE_CLASSES } from "@/lib/classes";

/** Create a season from scratch (e.g. the very first one). */
export async function createSeason(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const startYear = Number(formData.get("startYear"));
  const endYear = Number(formData.get("endYear"));

  if (!name) throw new Error("Season name is required.");
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new Error("Start and end year must be whole numbers.");
  }

  await db.season.create({ data: { name, startYear, endYear } });
  revalidatePath("/seasons");
}

export async function deleteSeason(formData: FormData) {
  const id = Number(formData.get("seasonId"));
  if (!Number.isInteger(id)) throw new Error("Bad season id.");
  await db.season.delete({ where: { id } });
  revalidatePath("/seasons");
}

/**
 * Start the season that follows `fromSeasonId`: create the next season, step up
 * every rostered player's class, and carry forward everyone who hasn't graduated
 * or transferred (keeping their jersey number). Seniors advance to GRADUATED and
 * are dropped from the new roster.
 */
export async function advanceSeason(formData: FormData) {
  const fromSeasonId = Number(formData.get("fromSeasonId"));
  if (!Number.isInteger(fromSeasonId)) throw new Error("Bad season id.");

  const newSeasonId = await db.$transaction(async (tx) => {
    const prev = await tx.season.findUniqueOrThrow({
      where: { id: fromSeasonId },
      include: { rosterEntries: { include: { player: true } } },
    });

    const startYear = prev.startYear + 1;
    const endYear = prev.endYear + 1;
    const name = `${startYear}-${endYear}`;

    const next = await tx.season.create({
      data: { name, startYear, endYear },
    });

    for (const entry of prev.rosterEntries) {
      const nextClass = advanceClass(entry.player.class);
      // Update the player's current class to reflect the new year.
      await tx.player.update({
        where: { id: entry.playerId },
        data: { class: nextClass },
      });
      // Carry the player onto the new roster unless they're now inactive.
      if (!INACTIVE_CLASSES.includes(nextClass)) {
        await tx.rosterEntry.create({
          data: {
            seasonId: next.id,
            playerId: entry.playerId,
            number: entry.number,
          },
        });
      }
    }

    return next.id;
  });

  revalidatePath("/seasons");
  redirect(`/seasons/${newSeasonId}/roster`);
}
