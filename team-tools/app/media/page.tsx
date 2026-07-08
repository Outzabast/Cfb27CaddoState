import Link from "next/link";
import {
  Inbox,
  Plus,
  Radio,
  Settings,
  Newspaper,
  MessageSquare,
  Image as ImageIcon,
  AudioLines,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MediaInbox } from "@/components/media/media-inbox";
import { MediaImageGallery } from "@/components/media/media-image-gallery";
import { SocialFeedList } from "@/components/media/social-feed-list";
import { AudioFeed } from "@/components/media/audio-feed";
import { fetchMediaPage, unviewedCount, type MediaQuery } from "@/lib/media/query";
import { fetchSocialFeedPage } from "@/lib/media/social-feed";
import { fetchAudioFeed } from "@/lib/media/audio-feed";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const SECTIONS = [
  { key: "articles", label: "Articles", Icon: Newspaper },
  { key: "social", label: "Social", Icon: MessageSquare },
  { key: "audio", label: "Audio", Icon: AudioLines },
  { key: "images", label: "Images", Icon: ImageIcon },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default async function MediaHubPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; view?: string; season?: string }>;
}) {
  const sp = await searchParams;
  const section: SectionKey =
    SECTIONS.some((s) => s.key === sp.section) ? (sp.section as SectionKey) : "articles";
  const unviewedOnly = section === "articles" && sp.view === "unviewed";
  const unread = await unviewedCount();

  // Build the active section's content (its own first page + pagination).
  let content: React.ReactNode;
  if (section === "images") {
    const page = await fetchMediaPage({ kind: "images" }, 12, null);
    content = <MediaImageGallery initialItems={page.items} initialCursor={page.nextCursor} />;
  } else if (section === "social") {
    const page = await fetchSocialFeedPage({}, 10, null);
    content = <SocialFeedList initialItems={page.items} initialCursor={page.nextCursor} scope={{}} />;
  } else if (section === "audio") {
    content = <AudioFeed posts={await fetchAudioFeed()} />;
  } else {
    const seasonId = sp.season ? Number(sp.season) : NaN;
    const query: MediaQuery = unviewedOnly
      ? { kind: "unviewed" }
      : Number.isInteger(seasonId)
        ? { kind: "season", seasonId }
        : { kind: "all" };
    const [page, seasons] = await Promise.all([
      fetchMediaPage(query, 10, null),
      db.season.findMany({ orderBy: { startYear: "desc" }, select: { id: true, name: true } }),
    ]);
    const inbox =
      unviewedOnly && page.items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          You&rsquo;re all caught up — nothing unread.{" "}
          <Link href="/media" className="font-medium text-primary hover:underline">
            View all articles
          </Link>
        </div>
      ) : (
        <MediaInbox initialItems={page.items} initialCursor={page.nextCursor} query={query} />
      );
    content = (
      <div className="space-y-4">
        {!unviewedOnly && (
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="section" value="articles" />
            <div className="grid gap-1">
              <label htmlFor="season" className="text-xs text-muted-foreground">
                Season
              </label>
              <select id="season" name="season" defaultValue={sp.season ?? ""} className={selectClass}>
                <option value="">All seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-accent"
            >
              Filter
            </button>
            {sp.season && (
              <Link
                href="/media?section=articles"
                className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                Clear
              </Link>
            )}
          </form>
        )}
        {inbox}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Caddo State</div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
            Media
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything generated from your box scores, players, and posts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={unviewedOnly ? "/media" : "/media?section=articles&view=unviewed"}
            title={unviewedOnly ? "Show all articles" : "Show unread"}
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

      {/* Top-level sections: Articles / Social / Images */}
      <div className="flex gap-1 border-b">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={`/media?section=${s.key}`}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide transition-colors",
              section === s.key
                ? "border-[var(--brand-gold)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <s.Icon className="h-3.5 w-3.5" />
            {s.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}
