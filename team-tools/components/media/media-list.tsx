"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { loadMediaPage } from "@/app/media/actions";
import type { MediaListItem } from "@/components/media/media-inbox";
import type { MediaQuery } from "@/lib/media/query";

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * A paginated, read-only article list (latest first, cursor-based "Load more").
 * Used where articles are consumed — e.g. a player's Latest News. Empty-state and
 * page-size selector included.
 */
export function MediaList({
  query,
  initialItems,
  initialCursor,
  emptyText = "No articles yet.",
}: {
  query: MediaQuery;
  initialItems: MediaListItem[];
  initialCursor: number | null;
  emptyText?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await loadMediaPage(query, cursor, pageSize);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border bg-card">
        {items.map((m) => (
          <Link
            key={m.id}
            href={`/media/${m.id}`}
            className="flex items-start gap-2 border-b px-4 py-3 last:border-0 hover:bg-accent"
          >
            {!m.viewed && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" />
            )}
            <div className="min-w-0 flex-1">
              <div className={`truncate ${m.viewed ? "font-medium" : "font-bold"}`}>
                {m.headline || "Untitled"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="truncate">{m.subjectLabel}</span>
                {m.authorName && (
                  <>
                    <span>·</span>
                    <span className="truncate">By {m.authorName}</span>
                  </>
                )}
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{m.createdAt}</span>
          </Link>
        ))}
      </div>

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
