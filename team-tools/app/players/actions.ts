"use server";

import {
  fetchPlayersPage,
  parseSort,
  type PlayerFilters,
  type PlayerSort,
  type PlayersPage,
} from "@/lib/players-query";

/** Fetch a page of players for the given filters + sort (offset-based). Used by
 *  the list's sort/column changes and "Load more". */
export async function loadPlayersPage(
  filters: PlayerFilters,
  sort: PlayerSort,
  offset: number,
  pageSize: number,
): Promise<PlayersPage> {
  return fetchPlayersPage(filters, parseSort(sort?.key, sort?.dir), offset, pageSize);
}
