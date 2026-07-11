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
  recruitId?: number | null;
  staffId?: number | null;
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
      recruitId: input.scope === "RECRUIT" ? input.recruitId ?? null : null,
      staffId: input.scope === "STAFF" ? input.staffId ?? null : null,
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
  recruitId: number | null;
  staffId: number | null;
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
    // onto the piece); a RECRUIT event is likewise a single subject. For GAME/TEAM,
    // playerIds are separate PLAYER features to fan out.
    const isPlayerScope = event.scope === "PLAYER";
    const isSingleSubject = isPlayerScope || event.scope === "RECRUIT" || event.scope === "STAFF";
    const targets: Target[] = isSingleSubject
      ? [
          {
            scope: event.scope,
            playerId: event.playerId,
            gameId: null,
            seasonId: null,
            recruitId: event.recruitId,
            staffId: event.staffId,
          },
        ]
      : [
          {
            scope: event.scope,
            playerId: event.playerId,
            gameId: event.gameId,
            seasonId: event.seasonId,
            recruitId: null,
            staffId: null,
          },
          ...event.playerIds.map((pid) => ({
            scope: "PLAYER" as MediaScope,
            playerId: pid,
            gameId: null,
            seasonId: null,
            recruitId: null,
            staffId: null,
          })),
        ];
    // One piece per persona (empty personas = a single default-voice piece).
    const personas: (number | null)[] = event.personaIds.length ? event.personaIds : [null];

    // The season a GAME event's game belongs to — so game recaps also tag their
    // season and surface under it. Likewise a recruit's class season.
    let gameSeasonId: number | null = null;
    if (event.scope === "GAME" && event.gameId != null) {
      const g = await db.game.findUnique({ where: { id: event.gameId }, select: { seasonId: true } });
      gameSeasonId = g?.seasonId ?? null;
    }
    let recruitSeasonId: number | null = null;
    if (event.scope === "RECRUIT" && event.recruitId != null) {
      const r = await db.recruit.findUnique({ where: { id: event.recruitId }, select: { seasonId: true } });
      recruitSeasonId = r?.seasonId ?? null;
    }

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
            recruitId: target.recruitId,
            staffId: target.staffId,
            promptContext: event.context,
            authorPersonaId: personaId,
            mediaEventId: eventId,
          },
          select: { id: true },
        });

        // Subject tags — the anchor this piece is about, plus a game's season, so
        // the media tab can filter by season/subject and player pages surface it.
        const tags: { mediaId: number; playerId?: number; gameId?: number; seasonId?: number }[] = [];
        if (target.playerId != null) tags.push({ mediaId: media.id, playerId: target.playerId });
        if (target.gameId != null) {
          tags.push({ mediaId: media.id, gameId: target.gameId });
          if (gameSeasonId != null) tags.push({ mediaId: media.id, seasonId: gameSeasonId });
        }
        if (target.seasonId != null) tags.push({ mediaId: media.id, seasonId: target.seasonId });
        // A recruiting piece surfaces under its recruiting-class season.
        if (target.recruitId != null && recruitSeasonId != null) {
          tags.push({ mediaId: media.id, seasonId: recruitSeasonId });
        }
        // For a player piece, also tag the extra subject players AND any focus games.
        if (isPlayerScope) {
          tags.push(...event.playerIds.map((pid) => ({ mediaId: media.id, playerId: pid })));
          tags.push(...event.gameIds.map((gid) => ({ mediaId: media.id, gameId: gid })));
        }
        if (tags.length) await db.mediaTag.createMany({ data: tags });

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
