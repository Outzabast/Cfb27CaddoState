"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SocialPostCard } from "./social-feed";
import { loadSocialFeed } from "@/app/media/actions";
import type { SocialPost, SocialFeedScope } from "@/lib/media/social-feed";

/** The media page's Social feed: cursor-based "Load more" over social posts. */
export function SocialFeedList({
  initialItems,
  initialCursor,
  scope = {},
}: {
  initialItems: SocialPost[];
  initialCursor: number | null;
  scope?: SocialFeedScope;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await loadSocialFeed(scope, cursor, 10);
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
        No social posts yet. Use <span className="font-medium">New post</span> and pick the
        <span className="font-medium"> Social</span> media type to generate one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {items.map((p) => (
          <SocialPostCard key={p.id} post={p} />
        ))}
      </div>
      {cursor != null && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
