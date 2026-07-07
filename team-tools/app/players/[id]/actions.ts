"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseStatus } from "@/lib/player-profile";
import { postMediaEvent, readMediaTrigger } from "@/lib/media/media-space";
import { recomputeAll } from "@/lib/notoriety";
import type { PlayerStatus } from "@/generated/prisma/enums";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/** Update a player's profile info (bio, structured header fields, PNG). */
export async function updatePlayerProfile(formData: FormData) {
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");

  const clean = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const posInt = (k: string): number | null => {
    const v = String(formData.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
  };

  // Height entered as feet + inches, stored as total inches.
  const feet = posInt("heightFeet");
  const inch = posInt("heightInch");
  const heightInches =
    feet != null || inch != null ? (feet ?? 0) * 12 + (inch ?? 0) : null;

  // A graduated/transferred player is POSTACTIVE regardless of what was picked.
  const latest = await db.seasonPlayer.findFirst({
    where: { playerId },
    orderBy: { seasonRoster: { season: { startYear: "desc" } } },
    select: { class: true, seasonRoster: { select: { seasonId: true } } },
  });
  const isPostByClass = latest?.class === "GRADUATED" || latest?.class === "TRANSFERRED";
  const status: PlayerStatus = isPostByClass ? "POSTACTIVE" : parseStatus(formData.get("status"));

  const data: {
    bio: string | null;
    awards: string | null;
    notableEvents: string | null;
    heightInches: number | null;
    weightLbs: number | null;
    hometown: string | null;
    status: PlayerStatus;
    injuryDetails: string | null;
    photo?: Uint8Array<ArrayBuffer> | null;
  } = {
    bio: clean("bio"),
    awards: clean("awards"),
    notableEvents: clean("notableEvents"),
    heightInches,
    weightLbs: posInt("weightLbs"),
    hometown: clean("hometown"),
    status,
    // Injury note only means anything while INJURED.
    injuryDetails: status === "INJURED" ? clean("injuryDetails") : null,
  };

  if (formData.get("removePhoto")) {
    data.photo = null;
  } else {
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      if (file.type !== "image/png") throw new Error("Photo must be a PNG.");
      if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 5MB.");
      data.photo = new Uint8Array(await file.arrayBuffer());
    }
  }

  await db.player.update({ where: { id: playerId }, data });

  // A player update can shift baselines/records program-wide — recompute everyone.
  after(() => recomputeAll());

  // Optionally post a player-update event to the mediaSpace (writes in background).
  const trigger = readMediaTrigger(formData);
  if (trigger) {
    await postMediaEvent({
      type: "PLAYER_UPDATE",
      scope: "PLAYER",
      playerId,
      context: trigger.context,
      personaIds: trigger.personaIds,
    });
    revalidatePath("/media");
  }

  revalidatePath(`/players/${playerId}`);
}
