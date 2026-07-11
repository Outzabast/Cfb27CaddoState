"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { advanceClass, INACTIVE_CLASSES, isValidClass } from "@/lib/classes";
import { recomputeAllSentiment } from "@/lib/sentiment";
import { recomputeAll } from "@/lib/notoriety";
import { recordRosterEvent } from "@/lib/roster-events";
import type { PlayerClass } from "@/generated/prisma/enums";

/** Collect a repeated integer form field (checkbox group). */
function idList(fd: FormData, name: string): number[] {
  return [...new Set(fd.getAll(name).map((v) => Number(v)).filter((n) => Number.isInteger(n)))];
}

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

/** Update a season's core fields (name, years, conference) from its edit page. */
export async function updateSeason(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad season id.");
  const name = String(formData.get("name") ?? "").trim();
  const startYear = Number(formData.get("startYear"));
  const endYear = Number(formData.get("endYear"));
  if (!name) throw new Error("Season name is required.");
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new Error("Start and end year must be whole numbers.");
  }
  const conference = String(formData.get("conference") ?? "").trim() || null;

  await db.season.update({
    where: { id },
    data: { name, startYear, endYear, conference },
  });
  after(() => recomputeAllSentiment());
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${id}`);
  revalidatePath(`/seasons/edit/${id}`);
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
 * Commit the offseason: start the season after `fromSeasonId` and build its roster
 * from three reviewed lists —
 *   • returning players carry over with their class stepped up (seniors graduate),
 *     EXCEPT anyone in `departingPlayerId` (transfer out / early departure);
 *   • players not carried forward (graduates + departures) are marked POSTACTIVE;
 *   • `enrollRecruitId` signees (of the finishing cycle) become players on the new
 *     roster — a Player + SeasonPlayer, with the recruit linked (status ENROLLED),
 *     each using its per-recruit `class_<id>` / `number_<id>` inputs.
 * The previous season's SeasonPlayer rows are left untouched.
 */
export async function commitAdvance(formData: FormData) {
  const fromSeasonId = Number(formData.get("fromSeasonId"));
  if (!Number.isInteger(fromSeasonId)) throw new Error("Bad season id.");

  const departing = new Set(idList(formData, "departingPlayerId"));
  const departingStaff = new Set(idList(formData, "departingStaffId"));
  const enrollRecruitIds = idList(formData, "enrollRecruitId");
  const enrollClass = (id: number): PlayerClass => {
    const raw = String(formData.get(`class_${id}`) ?? "FRESHMAN");
    return isValidClass(raw) ? raw : "FRESHMAN";
  };
  const enrollNumber = (id: number): number | null => {
    const n = Math.round(Number(formData.get(`number_${id}`)));
    return Number.isInteger(n) ? n : null;
  };

  const newSeasonId = await db.$transaction(async (tx) => {
    const prev = await tx.season.findUniqueOrThrow({
      where: { id: fromSeasonId },
      include: { roster: { include: { players: true } }, staff: true },
    });

    const startYear = prev.startYear + 1;
    const endYear = prev.endYear + 1;
    const next = await tx.season.create({
      data: { name: `${startYear}-${endYear}`, startYear, endYear, roster: { create: {} } },
      include: { roster: true },
    });
    const nextRosterId = next.roster!.id;

    // Returning players (class stepped up); graduates + marked departures drop off
    // and become POSTACTIVE.
    const leaving: number[] = [];
    for (const sp of prev.roster?.players ?? []) {
      const nextClass = advanceClass(sp.class);
      const graduates = INACTIVE_CLASSES.includes(nextClass);
      if (graduates || departing.has(sp.playerId)) {
        leaving.push(sp.playerId);
        await recordRosterEvent(tx, {
          playerId: sp.playerId,
          seasonId: fromSeasonId,
          type: graduates ? "GRADUATED" : "TRANSFERRED_OUT",
        });
        continue;
      }
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
    if (leaving.length) {
      await tx.player.updateMany({ where: { id: { in: leaving } }, data: { status: "POSTACTIVE" } });
    }

    // Coaching staff carries forward too (same coach, same role) unless marked as
    // departing. Season notoriety resets — it's per-season and gets recomputed.
    for (const ss of prev.staff) {
      if (departingStaff.has(ss.staffId)) continue;
      await tx.seasonStaff.create({
        data: {
          seasonId: next.id,
          staffId: ss.staffId,
          staffName: ss.staffName,
          role: ss.role,
          seasonNotoriety: 0,
        },
      });
    }

    // Enroll the selected signees of the finishing cycle onto the new roster.
    if (enrollRecruitIds.length) {
      const recruits = await tx.recruit.findMany({
        where: { id: { in: enrollRecruitIds }, seasonId: fromSeasonId, playerId: null },
      });
      for (const r of recruits) {
        const player = await tx.player.create({
          data: {
            name: r.name,
            heightInches: r.heightInches,
            weightLbs: r.weightLbs,
            hometown: [r.hometownCity, r.hometownState].filter(Boolean).join(", ") || null,
            bio: r.bio,
            status: "ACTIVE",
          },
          select: { id: true, name: true },
        });
        await tx.seasonPlayer.create({
          data: {
            seasonRosterId: nextRosterId,
            playerId: player.id,
            playerName: player.name,
            position: r.position.slice(0, 8),
            class: enrollClass(r.id),
            number: enrollNumber(r.id),
            isStarter: false,
          },
        });
        await tx.recruit.update({ where: { id: r.id }, data: { playerId: player.id, status: "ENROLLED" } });
        await recordRosterEvent(tx, {
          playerId: player.id,
          seasonId: next.id,
          type: r.kind === "TRANSFER" ? "JOINED_TRANSFER" : "JOINED_RECRUIT",
          counterparty: r.kind === "TRANSFER" ? r.previousSchool : null,
        });
      }
    }

    return next.id;
  });

  after(() => recomputeAllSentiment());
  after(() => recomputeAll()); // seeds season carry-in for the new roster + staff
  revalidatePath("/seasons");
  revalidatePath("/players");
  redirect(`/seasons/${newSeasonId}/roster`);
}
