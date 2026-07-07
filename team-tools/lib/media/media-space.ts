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
  playerId?: number | null;
  gameId?: number | null;
  seasonId?: number | null;
  context?: string | null;
  /** Author personas to write as — one piece each. Empty = one default-voice piece. */
  personaIds?: number[];
  /** Extra players to also generate individual features for (default none). */
  playerIds?: number[];
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
      status: "PENDING",
      playerId: input.scope === "PLAYER" ? input.playerId ?? null : null,
      gameId: input.scope === "GAME" ? input.gameId ?? null : null,
      seasonId: input.scope === "TEAM" ? input.seasonId ?? null : null,
      context: input.context?.trim() || null,
      personaIds: input.personaIds ?? [],
      playerIds: input.playerIds ?? [],
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

    // Subjects to cover: the event's primary subject, plus any tagged players.
    const targets: Target[] = [
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
