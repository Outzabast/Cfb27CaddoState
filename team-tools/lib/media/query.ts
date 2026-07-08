// Shapes Media rows into the list items the inbox renders, computing each
// piece's subject label (who/what it's about) and a short excerpt. Used by the
// global inbox and the per-season Media tab.

import { db } from "@/lib/db";
import type { MediaListItem } from "@/components/media/media-inbox";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function excerpt(body: string | null): string | null {
  if (!body) return null;
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

type Row = {
  id: number;
  headline: string | null;
  body: string | null;
  photoCaption: string | null;
  status: MediaListItem["status"];
  scope: MediaListItem["scope"];
  mediaType: MediaListItem["mediaType"];
  viewed: boolean;
  createdAt: Date;
  authorPersona: { id: number; name: string } | null;
  player: { name: string } | null;
  game: { opponent: string; week: number | null } | null;
  season: { name: string } | null;
};

function toItem(m: Row): MediaListItem {
  let subjectLabel = "—";
  if (m.scope === "PLAYER" && m.player) subjectLabel = m.player.name;
  else if (m.scope === "GAME" && m.game)
    subjectLabel = `vs ${m.game.opponent}${m.game.week != null ? ` · Wk ${m.game.week}` : ""}`;
  else if (m.scope === "TEAM" && m.season) subjectLabel = m.season.name;

  return {
    id: m.id,
    headline: m.headline,
    status: m.status,
    scope: m.scope,
    mediaType: m.mediaType,
    viewed: m.viewed,
    createdAt: dateFmt.format(m.createdAt),
    subjectLabel,
    authorId: m.authorPersona?.id ?? null,
    authorName: m.authorPersona?.name ?? null,
    photoCaption: m.photoCaption,
    hasPhoto: false, // set by the caller (cheap presence check, no bytes loaded)
    excerpt: excerpt(m.body),
  };
}

const listSelect = {
  id: true,
  headline: true,
  body: true,
  photoCaption: true,
  status: true,
  scope: true,
  mediaType: true,
  viewed: true,
  createdAt: true,
  authorPersona: { select: { id: true, name: true } },
  player: { select: { name: true } },
  game: { select: { opponent: true, week: true } },
  season: { select: { name: true } },
} as const;

/** All media, newest first (the global inbox). */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** Coerce an untrusted page size into [1, 100], defaulting to 10. */
export function clampPageSize(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(v)));
}

/** Which slice of media a list wants. Serializable, so it crosses the client
 *  boundary and back into the load-more server action. */
export type MediaQuery =
  | { kind: "all" }
  | { kind: "unviewed" }
  | { kind: "images" }
  | { kind: "season"; seasonId: number }
  | { kind: "player"; playerId: number };

function whereFor(q: MediaQuery) {
  switch (q.kind) {
    case "unviewed":
      return { viewed: false, status: "READY" as const };
    case "images":
      // Ready pieces that carry a header image (for the Images gallery).
      return { status: "READY" as const, photo: { not: null } };
    case "season":
      return { OR: [{ seasonId: q.seasonId }, { game: { seasonId: q.seasonId } }] };
    case "player":
      // As the primary subject OR tagged into a multi-player piece. Reader view →
      // finished pieces only.
      return {
        status: "READY" as const,
        OR: [{ playerId: q.playerId }, { tags: { some: { playerId: q.playerId } } }],
      };
    case "all":
    default:
      return {};
  }
}

export type MediaPage = { items: MediaListItem[]; nextCursor: number | null };

/**
 * One page of media, latest first. Cursor-based on the (monotonic) id: pass the
 * previous page's `nextCursor` to get the next slice; `nextCursor` is null when
 * the list is exhausted. Over-fetches by one to know if more remain.
 */
export async function fetchMediaPage(
  q: MediaQuery,
  pageSize: number,
  cursor: number | null,
): Promise<MediaPage> {
  const take = clampPageSize(pageSize);
  const rows = await db.media.findMany({
    where: whereFor(q),
    orderBy: { id: "desc" },
    take: take + 1,
    ...(cursor != null ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: listSelect,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore && page.length ? page[page.length - 1].id : null;

  // Which of these have a header image — a cheap presence check (no bytes loaded).
  const ids = page.map((r) => r.id);
  const withPhoto = ids.length
    ? await db.media.findMany({
        where: { id: { in: ids }, photo: { not: null } },
        select: { id: true },
      })
    : [];
  const photoIds = new Set(withPhoto.map((r) => r.id));

  return {
    items: page.map((r) => ({ ...toItem(r), hasPhoto: photoIds.has(r.id) })),
    nextCursor,
  };
}

/** Count of unread, ready pieces (drives the nav badge). */
export async function unviewedCount(): Promise<number> {
  return db.media.count({ where: { viewed: false, status: "READY" } });
}
