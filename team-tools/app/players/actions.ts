"use server";

import {
  fetchPlayersPage,
  type PlayerFilters,
  type PlayersPage,
} from "@/lib/players-query";

/** Fetch the next page of players (cursor-based). Used by "Load more". */
export async function loadPlayersPage(
  filters: PlayerFilters,
  cursor: number | null,
  pageSize: number,
): Promise<PlayersPage> {
  return fetchPlayersPage(filters, cursor, pageSize);
}
