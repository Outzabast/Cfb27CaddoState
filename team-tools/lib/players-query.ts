// Cursor-paginated player listing for the Players page. Filters (name / position
// / season) run at the DB level; ordering is name-then-id so the id cursor is
// deterministic. Scales to many seasons of rosters without loading everything.

import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";

export type PlayerFilters = { q?: string; pos?: string; season?: string; active?: string };
export type PlayerListItem = { id: number; name: string; meta: string };
export type PlayersPage = { items: PlayerListItem[]; nextCursor: number | null };

export const PLAYERS_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function whereFor(f: PlayerFilters) {
  const seasonId = f.season ? Number(f.season) : undefined;
  // Position and season are independent "some" checks (as the old in-memory
  // filter was) — a player matches if any season row satisfies each.
  const and: Record<string, unknown>[] = [];
  if (f.pos) and.push({ seasonPlayers: { some: { position: f.pos } } });
  if (seasonId) and.push({ seasonPlayers: { some: { seasonRoster: { seasonId } } } });
  // Active by default: hide graduated/transferred (POSTACTIVE) unless active="0".
  const activeOnly = f.active !== "0";
  return {
    ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
    ...(activeOnly ? { status: { not: "POSTACTIVE" as const } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

/** Count of players matching a filter (for the header). */
export function countPlayers(f: PlayerFilters): Promise<number> {
  return db.player.count({ where: whereFor(f) });
}

/**
 * One page of players (A→Z), cursor-based on id. Pass the prior page's
 * `nextCursor`; it's null when the list is exhausted.
 */
export async function fetchPlayersPage(
  f: PlayerFilters,
  cursor: number | null,
  pageSize = PLAYERS_PAGE_SIZE,
): Promise<PlayersPage> {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || PLAYERS_PAGE_SIZE));
  const rows = await db.player.findMany({
    where: whereFor(f),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursor != null ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { seasonPlayers: { include: { seasonRoster: { include: { season: true } } } } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore && page.length ? page[page.length - 1].id : null;

  const items = page.map((p) => {
    const sp = [...p.seasonPlayers].sort(
      (a, b) => a.seasonRoster.season.startYear - b.seasonRoster.season.startYear,
    );
    const latest = sp[sp.length - 1];
    const seasonNames = sp.map((s) => s.seasonRoster.season.name).join(", ");
    return {
      id: p.id,
      name: p.name,
      meta: latest
        ? `${latest.position} · ${CLASS_LABELS[latest.class]} · ${seasonNames}`
        : "no seasons",
    };
  });

  return { items, nextCursor };
}
