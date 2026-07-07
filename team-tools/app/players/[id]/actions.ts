"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/** Update a player's profile info (bio/awards/notable events) and optional PNG. */
export async function updatePlayerProfile(formData: FormData) {
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) throw new Error("Bad player id.");

  const clean = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const data: {
    bio: string | null;
    awards: string | null;
    notableEvents: string | null;
    photo?: Uint8Array | null;
  } = {
    bio: clean("bio"),
    awards: clean("awards"),
    notableEvents: clean("notableEvents"),
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
  revalidatePath(`/players/${playerId}`);
}
