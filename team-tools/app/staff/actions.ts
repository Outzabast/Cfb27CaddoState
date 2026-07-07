"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isStaffRole } from "@/lib/staff";
import { recomputeStaffAll } from "@/lib/notoriety";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Assign a staff member to a role for a season. Reuses an existing staff record by
 * name (so a coach carries across seasons); replaces whoever held the role.
 */
export async function addSeasonStaff(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) throw new Error("Bad season id.");
  const role = String(formData.get("role") ?? "");
  if (!isStaffRole(role)) throw new Error("Pick a role.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const existing = await db.staff.findFirst({ where: { name }, select: { id: true } });
  const staff = existing ?? (await db.staff.create({ data: { name }, select: { id: true } }));

  await db.seasonStaff.upsert({
    where: { seasonId_role: { seasonId, role } },
    create: { seasonId, role, staffId: staff.id, staffName: name },
    update: { staffId: staff.id, staffName: name },
  });

  after(() => recomputeStaffAll());
  revalidatePath(`/seasons/${seasonId}`);
}

/** Remove a staff assignment; deletes the staff record if fully orphaned. */
export async function removeSeasonStaff(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const seasonStaffId = Number(formData.get("seasonStaffId"));
  if (![seasonId, seasonStaffId].every(Number.isInteger)) throw new Error("Bad ids.");

  await db.$transaction(async (tx) => {
    const row = await tx.seasonStaff.findUnique({
      where: { id: seasonStaffId },
      select: { staffId: true },
    });
    if (!row) return;
    await tx.seasonStaff.delete({ where: { id: seasonStaffId } });
    const remaining = await tx.seasonStaff.count({ where: { staffId: row.staffId } });
    if (remaining === 0) await tx.staff.delete({ where: { id: row.staffId } });
  });

  after(() => recomputeStaffAll());
  revalidatePath(`/seasons/${seasonId}`);
}

/** Update a staff member's profile (bio + PNG photo). */
export async function updateStaffProfile(formData: FormData) {
  const staffId = Number(formData.get("staffId"));
  if (!Number.isInteger(staffId)) throw new Error("Bad staff id.");

  const bioRaw = String(formData.get("bio") ?? "").trim();
  const data: { bio: string | null; photo?: Uint8Array<ArrayBuffer> | null } = {
    bio: bioRaw === "" ? null : bioRaw,
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

  await db.staff.update({ where: { id: staffId }, data });
  revalidatePath(`/staff/${staffId}`);
}
