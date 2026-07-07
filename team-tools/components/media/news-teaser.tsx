import Link from "next/link";

export type TeaserItem = {
  id: number;
  headline: string | null;
  viewed: boolean;
};

/**
 * The "Latest News" block on the season home and player profile pages: a short
 * list of recent articles, or a dashed empty state. `viewAllHref` links to the
 * full inbox for that context.
 */
export function NewsTeaser({
  items,
  viewAllHref,
}: {
  items: TeaserItem[];
  viewAllHref: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No articles yet. Check &ldquo;Generate media&rdquo; when saving to write one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/media/${m.id}`}
          className="flex items-center gap-2 border-b px-4 py-3 last:border-0 hover:bg-accent"
        >
          {!m.viewed && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" />
          )}
          <span className={`truncate text-sm ${m.viewed ? "font-medium" : "font-bold"}`}>
            {m.headline}
          </span>
        </Link>
      ))}
      <Link
        href={viewAllHref}
        className="block px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
      >
        View all →
      </Link>
    </div>
  );
}
