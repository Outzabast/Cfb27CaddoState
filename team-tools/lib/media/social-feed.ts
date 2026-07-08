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

/** Recent social posts (newest first). Includes not-yet-ready ones so the feed
 *  reflects freshly-posted items. */
export async function fetchSocialFeed(limit = 40): Promise<SocialPost[]> {
  const rows = await db.media.findMany({
    where: { mediaType: "XPOST" },
    orderBy: { id: "desc" },
    take: limit,
    select: {
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
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          handle: true,
          displayName: true,
          body: true,
          likes: true,
          authorPersona: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((m) => {
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
}
