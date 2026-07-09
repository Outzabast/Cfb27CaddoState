"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { FactScope } from "@/generated/prisma/enums";
import { getCurrentSeasonId } from "@/lib/season";

// Standing-fact CRUD, shared by every page that edits facts (team home, season
// edit, roster edit). TEAM facts are global (seasonId null); SEASON/ROSTER facts
// attach to the season the calling page passes in. Each form carries a hidden
// `_revalidate` = the page path so the list refreshes in place after a save.

const FACT_SCOPES: FactScope[] = ["TEAM", "SEASON", "ROSTER"];

function parseFactScope(raw: unknown): FactScope {
  const s = String(raw ?? "");
  if ((FACT_SCOPES as string[]).includes(s)) return s as FactScope;
  throw new Error("Unknown fact layer.");
}

/** Clamp an importance value to 0–100 (defaults to 50 when absent/invalid). */
function parseImportance(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

/** Revalidate the page the form was submitted from (falls back to nothing). */
function revalidateFrom(formData: FormData) {
  const path = String(formData.get("_revalidate") ?? "").trim();
  if (path.startsWith("/")) revalidatePath(path);
}

/**
 * The season a SEASON/ROSTER fact attaches to: the explicit `seasonId` the page
 * passed, else the current season. TEAM facts are always global (null).
 */
async function resolveSeasonId(scope: FactScope, formData: FormData): Promise<number | null> {
  if (scope === "TEAM") return null;
  const raw = Number(formData.get("seasonId"));
  if (Number.isInteger(raw)) return raw;
  const current = await getCurrentSeasonId();
  if (current == null) throw new Error("No season to attach this fact to.");
  return current;
}

/** Add a standing fact. New facts append to their (scope, season) group's order. */
export async function createFact(formData: FormData) {
  const scope = parseFactScope(formData.get("scope"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Write the fact.");
  const seasonId = await resolveSeasonId(scope, formData);

  const last = await db.fact.findFirst({
    where: { scope, seasonId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await db.fact.create({
    data: {
      scope,
      seasonId,
      body,
      importance: parseImportance(formData.get("importance")),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidateFrom(formData);
}

/** Update a fact's body, importance, order, and active flag (scope/season fixed). */
export async function updateFact(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad fact id.");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Write the fact.");
  const sortOrder = Number(formData.get("sortOrder"));

  await db.fact.update({
    where: { id },
    data: {
      body,
      importance: parseImportance(formData.get("importance")),
      active: formData.get("active") != null,
      ...(Number.isInteger(sortOrder) ? { sortOrder } : {}),
    },
  });
  revalidateFrom(formData);
}

/** Delete a standing fact. */
export async function deleteFact(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad fact id.");
  await db.fact.delete({ where: { id } });
  revalidateFrom(formData);
}
