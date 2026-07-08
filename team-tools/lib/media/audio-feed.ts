// Loads AUDIO (radio monologue) media into a playable feed: each piece with its
// author, duration, transcript, and hashtags derived from its subject tags.

import { db } from "@/lib/db";
import { tagsToHashtags } from "./social-feed";

export type AudioPost = {
  id: number;
  authorName: string;
  status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  headline: string | null;
  transcript: string | null;
  seconds: number | null;
  updatedAtMs: number;
  createdAt: string;
  seasonId: number | null;
  hashtags: string[];
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export async function fetchAudioFeed(limit = 40): Promise<AudioPost[]> {
  const rows = await db.media.findMany({
    where: { mediaType: "AUDIO" },
    orderBy: { id: "desc" },
    take: limit,
    select: {
      id: true,
      headline: true,
      body: true,
      status: true,
      audioSeconds: true,
      createdAt: true,
      updatedAt: true,
      seasonId: true,
      authorPersona: { select: { name: true } },
      tags: {
        select: {
          player: { select: { name: true } },
          game: { select: { opponent: true } },
          season: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    authorName: m.authorPersona?.name ?? "Caddo State Radio",
    status: m.status,
    headline: m.headline,
    transcript: m.body,
    seconds: m.audioSeconds,
    updatedAtMs: m.updatedAt.getTime(),
    createdAt: dateFmt.format(m.createdAt),
    seasonId: m.seasonId,
    hashtags: tagsToHashtags(m.tags),
  }));
}
