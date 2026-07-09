// Players-page listing. Filters (name / position / season / status) and sorting
// both run at the DB level so paging is correct across the whole dataset, not
// just the loaded rows. Season-scoped columns (current notoriety, position,
// class, number, starter) come from the "context season" — the season filter
// when set, otherwise the current (latest) season — via a LEFT JOIN, so a player
// not on that roster simply shows blank there. Offset-paginated because the sort
// column is arbitrary (a stable id cursor only works for a fixed order).

import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import { PLAYER_STATUS_LABELS } from "@/lib/player-profile";
import type { PlayerStatus, PlayerClass } from "@/generated/prisma/enums";
import { getCurrentSeasonId } from "@/lib/season";

export type PlayerFilters = { q?: string; pos?: string; season?: string; active?: string };

export type PlayerSortKey =
  | "name"
  | "program"
  | "current"
  | "position"
  | "class"
  | "number"
  | "starter"
  | "status";
export type SortDir = "asc" | "desc";
export type PlayerSort = { key: PlayerSortKey; dir: SortDir };

export type PlayerListItem = {
  id: number;
  name: string;
  program: number; // program-wide (overall) notoriety
  current: number | null; // context-season notoriety
  position: string | null;
  class: string | null; // label
  number: number | null;
  starter: boolean | null;
  status: string; // label
};
export type PlayersPage = { items: PlayerListItem[]; nextOffset: number | null };

export const PLAYERS_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Landing sort: the most-noteworthy players in the program, first. */
export const DEFAULT_SORT: PlayerSort = { key: "program", dir: "desc" };

// SQL expression per sortable column. Fixed allowlist — never interpolate a
// caller-supplied column, so ORDER BY can't be injected.
const SORT_SQL: Record<PlayerSortKey, string> = {
  name: "p.name",
  program: "p.overall_notoriety",
  current: "sp.season_notoriety",
  position: "sp.position",
  class: "sp.class",
  number: "sp.number",
  starter: "sp.is_starter",
  status: "p.status",
};

/** Coerce loose input into a valid sort (falls back to DEFAULT_SORT). */
export function parseSort(key: unknown, dir: unknown): PlayerSort {
  const k = String(key ?? "");
  const d = String(dir ?? "");
  return {
    key: (k in SORT_SQL ? k : DEFAULT_SORT.key) as PlayerSortKey,
    dir: d === "asc" || d === "desc" ? d : DEFAULT_SORT.dir,
  };
}

/** Count of players matching a filter (for the header). */
export function countPlayers(f: PlayerFilters): Promise<number> {
  const seasonId = f.season ? Number(f.season) : undefined;
  const and: Record<string, unknown>[] = [];
  if (f.pos) and.push({ seasonPlayers: { some: { position: f.pos } } });
  if (seasonId) and.push({ seasonPlayers: { some: { seasonRoster: { seasonId } } } });
  const activeOnly = f.active !== "0";
  return db.player.count({
    where: {
      ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
      ...(activeOnly ? { status: { not: "POSTACTIVE" as const } } : {}),
      ...(and.length ? { AND: and } : {}),
    },
  });
}

/** Resolve which season's roster backs the season-scoped columns. */
async function contextRosterId(f: PlayerFilters): Promise<number | null> {
  const seasonId = f.season ? Number(f.season) : await getCurrentSeasonId();
  if (seasonId == null || !Number.isInteger(seasonId)) return null;
  const roster = await db.seasonRoster.findUnique({
    where: { seasonId },
    select: { id: true },
  });
  return roster?.id ?? null;
}

type Row = {
  id: number;
  name: string;
  program: number;
  status: PlayerStatus;
  current: number | null;
  position: string | null;
  class: PlayerClass | null;
  number: number | null;
  starter: boolean | null;
};

/**
 * One page of players for the given filters + sort, offset-paginated. Pass the
 * prior page's `nextOffset` (null when exhausted); `null` sort uses DEFAULT_SORT.
 */
export async function fetchPlayersPage(
  f: PlayerFilters,
  sort: PlayerSort = DEFAULT_SORT,
  offset = 0,
  pageSize = PLAYERS_PAGE_SIZE,
): Promise<PlayersPage> {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || PLAYERS_PAGE_SIZE));
  const skip = Math.max(0, Math.trunc(offset) || 0);
  const rosterId = await contextRosterId(f);

  // Positional params ($1, $2, …); helper appends and returns the placeholder.
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const joinParam = p(rosterId);
  const where: string[] = [];
  if (f.q) where.push(`p.name ILIKE ${p(`%${f.q}%`)}`);
  if (f.active !== "0") where.push(`p.status <> 'POSTACTIVE'`);
  if (f.pos) {
    where.push(
      `EXISTS (SELECT 1 FROM season_players e WHERE e.player_id = p.id AND e.position = ${p(f.pos)})`,
    );
  }
  if (f.season) {
    where.push(
      `EXISTS (SELECT 1 FROM season_players e JOIN season_rosters r ON r.id = e.season_roster_id ` +
        `WHERE e.player_id = p.id AND r.season_id = ${p(Number(f.season))})`,
    );
  }

  const { key, dir } = parseSort(sort.key, sort.dir);
  const orderBy = `${SORT_SQL[key]} ${dir === "asc" ? "ASC" : "DESC"} NULLS LAST, p.id ASC`;
  const limitParam = p(take + 1); // one extra row tells us if there's a next page
  const offsetParam = p(skip);

  const sql =
    `SELECT p.id, p.name, p.overall_notoriety AS program, p.status, ` +
    `sp.season_notoriety AS current, sp.position, sp.class, sp.number, sp.is_starter AS starter ` +
    `FROM players p ` +
    `LEFT JOIN season_players sp ON sp.player_id = p.id AND sp.season_roster_id = ${joinParam} ` +
    (where.length ? `WHERE ${where.join(" AND ")} ` : "") +
    `ORDER BY ${orderBy} ` +
    `LIMIT ${limitParam} OFFSET ${offsetParam}`;

  const rows = await db.$queryRawUnsafe<Row[]>(sql, ...params);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const items: PlayerListItem[] = page.map((r) => ({
    id: r.id,
    name: r.name,
    program: r.program,
    current: r.current,
    position: r.position,
    class: r.class ? CLASS_LABELS[r.class] : null,
    number: r.number,
    starter: r.starter,
    status: PLAYER_STATUS_LABELS[r.status],
  }));

  return { items, nextOffset: hasMore ? skip + take : null };
}
