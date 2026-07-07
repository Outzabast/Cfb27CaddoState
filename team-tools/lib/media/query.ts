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
    hasPhoto: false, // not shown in the list; kept off the query to avoid loading bytes
    excerpt: excerpt(m.body),
  };
}

const listSelect = {
  id: true,
  headline: true,
  body: true,
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
export async function listAllMedia(): Promise<MediaListItem[]> {
  const rows = await db.media.findMany({
    orderBy: { createdAt: "desc" },
    select: listSelect,
  });
  return rows.map(toItem);
}

/** Media anchored to a season: its team stories plus any of its games' recaps. */
export async function listSeasonMedia(seasonId: number): Promise<MediaListItem[]> {
  const rows = await db.media.findMany({
    where: {
      OR: [{ seasonId }, { game: { seasonId } }],
    },
    orderBy: { createdAt: "desc" },
    select: listSelect,
  });
  return rows.map(toItem);
}

/** Count of unread, ready pieces (drives the nav badge). */
export async function unviewedCount(): Promise<number> {
  return db.media.count({ where: { viewed: false, status: "READY" } });
}
