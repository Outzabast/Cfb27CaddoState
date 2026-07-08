// Loads XPOST (social) media into a renderable feed: each post with its author,
// the hashtags derived from its subject tags, and its reply thread.

import { db } from "@/lib/db";

export type FeedReply = {
  id: number;
  name: string;
  handle: string;
  isPersona: boolean;
  body: string;
  likes: number;
};

export type SocialPost = {
  id: number;
  authorName: string;
  authorHandle: string;
  isTeamAccount: boolean;
  status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  genError: string | null;
  body: string | null;
  createdAt: string;
  seasonId: number | null;
  hashtags: string[];
  replies: FeedReply[];
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "Deyonte Hocker III" -> "@DeyonteHockerIII". */
export function handleFor(name: string): string {
  return "@" + name.replace(/[^a-zA-Z0-9]/g, "");
}

/** Subject tags → hashtags: #PlayerName, #vsOpponent, #Season. Deduped, order:
 *  players, games, seasons. Shared by the social + audio feeds. */
export function tagsToHashtags(tags: {
  player: { name: string } | null;
  game: { opponent: string } | null;
  season: { name: string } | null;
}[]): string[] {
  const out = new Set<string>();
  for (const t of tags) if (t.player) out.add("#" + t.player.name.replace(/[^a-zA-Z0-9]/g, ""));
  for (const t of tags) if (t.game) out.add("#vs" + t.game.opponent.replace(/[^a-zA-Z0-9]/g, ""));
  for (const t of tags) if (t.season) out.add("#" + t.season.name.replace(/[^a-zA-Z0-9-]/g, ""));
  return [...out];
}

export type SocialFeedScope = {
  playerId?: number;
  seasonId?: number;
  limit?: number;
  /** Only finished posts (for embeds on player/season pages). */
  readyOnly?: boolean;
};

/** Recent social posts (newest first). Unscoped = the whole feed (incl. in-flight
 *  posts); pass a playerId/seasonId to embed a subject's posts elsewhere. */
export type SocialFeedPage = { items: SocialPost[]; nextCursor: number | null };

const SELECT = {
  id: true,
  body: true,
  status: true,
  genError: true,
  createdAt: true,
  seasonId: true,
  authorPersona: { select: { name: true } },
  tags: {
    select: {
      player: { select: { name: true } },
      game: { select: { opponent: true } },
      season: { select: { name: true } },
    },
  },
  socialReplies: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      handle: true,
      displayName: true,
      body: true,
      likes: true,
      authorPersona: { select: { name: true } },
    },
  },
} as const;

function whereForScope(scope: SocialFeedScope): Record<string, unknown> {
  const where: Record<string, unknown> = { mediaType: "XPOST" };
  if (scope.readyOnly) where.status = "READY";
  if (scope.playerId != null) {
    where.OR = [{ playerId: scope.playerId }, { tags: { some: { playerId: scope.playerId } } }];
  } else if (scope.seasonId != null) {
    where.OR = [
      { seasonId: scope.seasonId },
      { game: { seasonId: scope.seasonId } },
      { tags: { some: { seasonId: scope.seasonId } } },
    ];
  }
  return where;
}

/** Core query: one page of posts (newest first), cursor-based on id. */
async function queryPage(
  scope: SocialFeedScope,
  take: number,
  cursor: number | null,
): Promise<SocialFeedPage> {
  const rows = await db.media.findMany({
    where: whereForScope(scope),
    orderBy: { id: "desc" },
    take: take + 1,
    ...(cursor != null ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: SELECT,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const items: SocialPost[] = page.map((m) => {
    const authorName = m.authorPersona?.name ?? "Caddo State";
    return {
      id: m.id,
      authorName,
      authorHandle: handleFor(authorName),
      isTeamAccount: m.authorPersona == null,
      status: m.status,
      genError: m.genError,
      body: m.body,
      createdAt: dateFmt.format(m.createdAt),
      seasonId: m.seasonId,
      hashtags: tagsToHashtags(m.tags),
      replies: m.socialReplies.map((r) => ({
        id: r.id,
        name: r.authorPersona?.name ?? r.displayName ?? r.handle,
        handle: r.authorPersona ? handleFor(r.authorPersona.name) : r.handle,
        isPersona: r.authorPersona != null,
        body: r.body,
        likes: r.likes,
      })),
    };
  });
  return { items, nextCursor: hasMore && page.length ? page[page.length - 1].id : null };
}

/** Non-paginated recent posts (for embeds on player/season pages). */
export async function fetchSocialFeed(scope: SocialFeedScope = {}): Promise<SocialPost[]> {
  const { items } = await queryPage(scope, scope.limit ?? 40, null);
  return items;
}

/** One cursor page of posts (for the media page's Social feed). */
export function fetchSocialFeedPage(
  scope: SocialFeedScope,
  pageSize: number,
  cursor: number | null,
): Promise<SocialFeedPage> {
  const take = Math.min(100, Math.max(1, Math.trunc(pageSize) || 10));
  return queryPage(scope, take, cursor);
}
