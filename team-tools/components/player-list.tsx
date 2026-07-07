"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { loadPlayersPage } from "@/app/players/actions";
import type { PlayerFilters, PlayerListItem } from "@/lib/players-query";

const PAGE_SIZES = [25, 50, 100];

/** Paginated player list (A→Z, cursor "Load more"). Filters come from the page's
 *  GET form and are echoed back on each fetch. */
export function PlayerList({
  filters,
  initialItems,
  initialCursor,
}: {
  filters: PlayerFilters;
  initialItems: PlayerListItem[];
  initialCursor: number | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await loadPlayersPage(filters, cursor, pageSize);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No players match.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/players/${p.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-right text-sm text-muted-foreground">{p.meta}</span>
            </Link>
          </li>
        ))}
      </ul>

      {cursor != null && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm shadow-xs outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
