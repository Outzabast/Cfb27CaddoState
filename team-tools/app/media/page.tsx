import Link from "next/link";
import { Inbox, Plus, Radio, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MediaInbox } from "@/components/media/media-inbox";
import { fetchMediaPage, unviewedCount, type MediaQuery } from "@/lib/media/query";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MediaInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const unviewedOnly = (await searchParams).view === "unviewed";
  const query: MediaQuery = unviewedOnly ? { kind: "unviewed" } : { kind: "all" };
  const [page, unread] = await Promise.all([fetchMediaPage(query, 10, null), unviewedCount()]);
  const items = page.items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Caddo State</div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
            Media
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {unviewedOnly
              ? "Unread articles."
              : "Every article generated from your box scores, players, and posts."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Inbox: unread count; clicking shows only unread */}
          <Link
            href={unviewedOnly ? "/media" : "/media?view=unviewed"}
            title={unviewedOnly ? "Show all media" : "Show unread"}
            className={cn(
              "relative inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
              unviewedOnly ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
            )}
          >
            <Inbox className="h-4 w-4" />
            Inbox
            {unread > 0 && (
              <span className="ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </Link>

          <Link href="/media/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4" />
            New post
          </Link>
          <Link href="/media/space" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Radio className="h-4 w-4" />
            Media Space
          </Link>
          <Link href="/settings/media" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {unviewedOnly && items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          You&rsquo;re all caught up — nothing unread.{" "}
          <Link href="/media" className="font-medium text-primary hover:underline">
            View all media
          </Link>
        </div>
      ) : (
        <MediaInbox initialItems={items} initialCursor={page.nextCursor} query={query} />
      )}
    </div>
  );
}
