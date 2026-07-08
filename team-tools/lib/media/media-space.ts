// The "mediaSpace": a thin listener over MediaEvents. Posting an event (finishing
// a box score, updating a player, a manual post) is the ONLY way media gets made —
// every generated piece is tied back to its event, so deleting the event cascades
// its media away. Processing fans out: one piece per selected persona for the
// primary subject, plus an optional feature per tagged player.

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { MediaEventType, MediaScope, MediaType } from "@/generated/prisma/enums";
import { runGeneration } from "./generate";

export type PostEventInput = {
  type: MediaEventType;
  scope: MediaScope;
  mediaType?: MediaType;
  /** Article angle slug (recap/preview/season/feature/injury…); null = scope default. */
  angle?: string | null;
  playerId?: number | null;
  gameId?: number | null;
  seasonId?: number | null;
  context?: string | null;
  /** Author personas to write as — one piece each. Empty = one default-voice piece. */
  personaIds?: number[];
  /** GAME/TEAM: extra players to feature separately. PLAYER: extra subjects of one piece. */
  playerIds?: number[];
  /** Focus games (e.g. a player feature centered on these games). */
  gameIds?: number[];
};

/**
 * Post an event to the mediaSpace and schedule its processing in the background,
 * so the save that triggered it returns immediately. Returns the event id.
 */
export async function postMediaEvent(input: PostEventInput): Promise<number> {
  const event = await db.mediaEvent.create({
    data: {
      type: input.type,
      scope: input.scope,
      mediaType: input.mediaType ?? "ARTICLE",
      angle: input.angle ?? null,
      status: "PENDING",
      playerId: input.scope === "PLAYER" ? input.playerId ?? null : null,
      gameId: input.scope === "GAME" ? input.gameId ?? null : null,
      seasonId: input.scope === "TEAM" ? input.seasonId ?? null : null,
      context: input.context?.trim() || null,
      personaIds: input.personaIds ?? [],
      playerIds: input.playerIds ?? [],
      gameIds: input.gameIds ?? [],
    },
    select: { id: true },
  });

  after(() => processMediaEvent(event.id));
  return event.id;
}

type Target = {
  scope: MediaScope;
  playerId: number | null;
  gameId: number | null;
  seasonId: number | null;
};

/**
 * The listener. Creates the media the event calls for — the primary subject plus
 * a feature for each tagged player, each written by every selected persona — and
 * generates them. Owns its errors (recorded on the event, not thrown).
 */
export async function processMediaEvent(eventId: number): Promise<void> {
  const event = await db.mediaEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  try {
    await db.mediaEvent.update({ where: { id: eventId }, data: { status: "PROCESSING" } });

    // Notoriety is a system artifact, recomputed when stats/rosters change — not
    // here. Generation just reads the current values.

    // For a PLAYER event, playerIds are ADDITIONAL SUBJECTS of one article (tagged
    // onto the piece). For GAME/TEAM, they're separate PLAYER features to fan out.
    const isPlayerScope = event.scope === "PLAYER";
    const targets: Target[] = isPlayerScope
      ? [{ scope: "PLAYER", playerId: event.playerId, gameId: null, seasonId: null }]
      : [
          {
            scope: event.scope,
            playerId: event.playerId,
            gameId: event.gameId,
            seasonId: event.seasonId,
          },
          ...event.playerIds.map((pid) => ({
            scope: "PLAYER" as MediaScope,
            playerId: pid,
            gameId: null,
            seasonId: null,
          })),
        ];
    // One piece per persona (empty personas = a single default-voice piece).
    const personas: (number | null)[] = event.personaIds.length ? event.personaIds : [null];

    for (const target of targets) {
      for (const personaId of personas) {
        const media = await db.media.create({
          data: {
            mediaType: event.mediaType,
            scope: target.scope,
            angle: event.angle,
            status: "PENDING",
            playerId: target.playerId,
            gameId: target.gameId,
            seasonId: target.seasonId,
            promptContext: event.context,
            authorPersonaId: personaId,
            mediaEventId: eventId,
          },
          select: { id: true },
        });
        // For a player piece, tag the extra subject players AND any focus games so
        // generation writes about all of them / centers on those games.
        if (isPlayerScope) {
          const tags = [
            ...event.playerIds.map((pid) => ({ mediaId: media.id, playerId: pid })),
            ...event.gameIds.map((gid) => ({ mediaId: media.id, gameId: gid })),
          ];
          if (tags.length) await db.mediaTag.createMany({ data: tags });
        }
        await runGeneration(media.id);
      }
    }

    await db.mediaEvent.update({ where: { id: eventId }, data: { status: "PROCESSED", error: null } });
  } catch (e) {
    await db.mediaEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", error: e instanceof Error ? e.message : "Processing failed." },
    });
  }

  revalidatePath("/media");
  revalidatePath("/media/space");
  if (event.seasonId != null) revalidatePath(`/seasons/${event.seasonId}/media`);
}

/** Read the shared "generate media" fields off a save form (null if unchecked). */
export function readMediaTrigger(
  formData: FormData,
): { context: string | null; personaIds: number[]; playerIds: number[] } | null {
  if (!formData.get("generateMedia")) return null;
  return {
    context: String(formData.get("mediaContext") ?? "").trim() || null,
    personaIds: readIdList(formData, "mediaPersonaId"),
    playerIds: readIdList(formData, "mediaPlayerId"),
  };
}

/** Collect a repeated form field of integer ids (checkbox group). */
export function readIdList(formData: FormData, name: string): number[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n)),
    ),
  ];
}
