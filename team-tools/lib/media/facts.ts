// Standing editorial facts injected into media generation. Distinct from the
// hard TEAM_FACTS canon (that lives in constants.ts and stays in the system
// message as the immutable "never invent" floor) — these are the editable,
// layered background you'd otherwise retype into every prompt: program-wide
// canon (TEAM), a season's storylines (SEASON), and that season's roster context
// (ROSTER). Assembled per-article and emitted as a STANDING CONTEXT block in the
// seed, above the editor's one-off note.

import { db } from "@/lib/db";
import type { FactScope } from "@/generated/prisma/enums";
import { FACT_AUTOINJECT_THRESHOLD } from "./constants";

/** The layers, in the order they read best in the block. */
const SCOPE_ORDER: FactScope[] = ["TEAM", "SEASON", "ROSTER"];

/** The where-clause for facts that apply to an article about `seasonId`: global
 *  TEAM facts, plus that season's SEASON/ROSTER facts. */
function applicableWhere(seasonId: number | null) {
  return {
    active: true,
    OR: [
      { scope: "TEAM" as FactScope, seasonId: null },
      ...(seasonId != null
        ? [{ scope: { in: ["SEASON", "ROSTER"] as FactScope[] }, seasonId }]
        : []),
    ],
  };
}

/**
 * Gather the HIGH-importance standing facts (≥ threshold) that apply to an article
 * about `seasonId` and format them as the STANDING CONTEXT block for the seed.
 * Lower-importance facts are left out of context — the writer can pull them via
 * the list_facts tool. Returns "" when there's nothing to inject.
 */
export async function assembleFacts(seasonId: number | null): Promise<string> {
  const facts = await db.fact.findMany({
    where: { ...applicableWhere(seasonId), importance: { gte: FACT_AUTOINJECT_THRESHOLD } },
    // Most important first; sortOrder is a manual tiebreak within equal importance.
    orderBy: [{ importance: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { scope: true, body: true },
  });
  if (!facts.length) return "";

  // Group by scope so the layers stay together, in SCOPE_ORDER.
  const byScope = new Map<FactScope, string[]>();
  for (const f of facts) {
    const body = f.body.trim();
    if (!body) continue;
    const arr = byScope.get(f.scope) ?? [];
    arr.push(body);
    byScope.set(f.scope, arr);
  }

  const lines = SCOPE_ORDER.flatMap((scope) =>
    (byScope.get(scope) ?? []).map((body) => `- ${body}`),
  );
  if (!lines.length) return "";

  return ["STANDING CONTEXT (editorial background, not in the stats):", ...lines].join("\n");
}

export type FactEditRow = {
  id: number;
  body: string;
  importance: number;
  active: boolean;
  sortOrder: number;
};

/**
 * Every fact in one layer for editing UIs, most-important first. `seasonId` is
 * null for the global TEAM layer, or the season for SEASON/ROSTER.
 */
export async function factsForScope(
  scope: FactScope,
  seasonId: number | null,
): Promise<FactEditRow[]> {
  return db.fact.findMany({
    where: { scope, seasonId },
    orderBy: [{ importance: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, body: true, importance: true, active: true, sortOrder: true },
  });
}

/**
 * The researchable archive: active standing facts that were NOT force-injected
 * (importance below the threshold), for the writer to pull on demand. Backs the
 * list_facts tool. Optionally narrowed to one layer.
 */
export async function researchFacts(
  seasonId: number | null,
  scope?: FactScope,
): Promise<{ scope: FactScope; body: string; importance: number }[]> {
  const where = applicableWhere(seasonId);
  const facts = await db.fact.findMany({
    where: {
      ...where,
      importance: { lt: FACT_AUTOINJECT_THRESHOLD },
      ...(scope ? { scope } : {}),
    },
    orderBy: [{ importance: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { scope: true, body: true, importance: true },
  });
  return facts;
}
