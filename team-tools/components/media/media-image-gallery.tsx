"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { loadMediaPage } from "@/app/media/actions";
import type { MediaListItem } from "@/components/media/media-inbox";

const PAGE_SIZES = [12, 24, 48];

/**
 * Paginated gallery of article header images: each tile shows the image, its
 * caption (subtitle), and links to the article. Cursor "Load more".
 */
export function MediaImageGallery({
  initialItems,
  initialCursor,
}: {
  initialItems: MediaListItem[];
  initialCursor: number | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await loadMediaPage({ kind: "images" }, cursor, pageSize);
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
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        No images yet. Add a header image to an article and it&rsquo;ll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((m) => (
          <Link
            key={m.id}
            href={`/media/${m.id}`}
            className="group block overflow-hidden rounded-md border bg-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/media/${m.id}/photo`}
              alt=""
              className="aspect-video w-full object-cover"
            />
            <div className="p-2">
              <div className="truncate text-sm font-medium group-hover:text-primary">
                {m.headline || "Untitled"}
              </div>
              {m.photoCaption && (
                <div className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">
                  {m.photoCaption}
                </div>
              )}
            </div>
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
