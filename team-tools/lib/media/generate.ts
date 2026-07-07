// The async generation job. Called from processMediaEvent once a Media row exists
// PENDING. Resolves the model + voice, assembles the seed (primary subject data +
// the handles the writer can research), runs the tool-calling agent, writes the
// article back onto the row, and flips status to READY or FAILED.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_MEDIA_MODEL, DEFAULT_VOICE } from "./constants";
import { writeArticle } from "./agent";
import { describeGame, describePlayer, describeSeason } from "./subject";

/** Resolve which OpenRouter model writes a given media type. */
async function resolveModel(mediaType: "ARTICLE"): Promise<string> {
  const setting = await db.modelSetting.findUnique({ where: { mediaType } });
  return setting?.modelId || DEFAULT_MEDIA_MODEL;
}

const SYSTEM_PREFACE =
  "You cover the Caddo State Lumberjacks. Refer to the team as Caddo State or the " +
  "Lumberjacks — never invent a different nickname or city. " +
  "You are a writer for a college-football program's internal media hub. You have " +
  "research tools — use them to build your own picture of whoever and whatever the " +
  "story touches (player dossiers, a player's other games, the roster, prior " +
  "articles by you or about this subject) so each piece is specific and fresh, not " +
  "a template. Write ONLY from real data the tools and prompt provide — never invent " +
  "scores, names, or stats, and never contradict the box score. Use the editor's " +
  "extra context for color. When done researching, reply with ONLY a JSON object: " +
  '{"headline": string, "body": string}. The body is the full article as plain text ' +
  "with paragraphs separated by blank lines; no markdown headers.";

const SCOPE_LABEL = { GAME: "game recap", PLAYER: "player feature", TEAM: "team/season" } as const;

type MediaRow = {
  scope: "PLAYER" | "GAME" | "TEAM";
  playerId: number | null;
  gameId: number | null;
  seasonId: number | null;
  promptContext: string | null;
  authorPersonaId: number | null;
};

/** Build the seed message: the subject data + the ids the writer can research. */
async function buildSeed(media: MediaRow, subject: string): Promise<string> {
  const out: string[] = [];
  out.push(`Write a ${SCOPE_LABEL[media.scope]} article for Caddo State.`);
  out.push("");
  out.push("PRIMARY SUBJECT DATA:");
  out.push(subject);
  out.push("");
  out.push("Handles you can research with the tools:");

  if (media.scope === "GAME" && media.gameId != null) {
    const game = await db.game.findUnique({ where: { id: media.gameId }, select: { seasonId: true } });
    out.push(`- This game: gameId ${media.gameId}` + (game ? `, seasonId ${game.seasonId}` : ""));
    // The featured players (with ids) so the writer can pull their dossiers/history.
    const featured = await db.gamePlayerStat.findMany({
      where: { gameId: media.gameId, gameNotoriety: { gt: 0 } },
      orderBy: { gameNotoriety: "desc" },
      take: 5,
      select: { playerId: true, player: { select: { name: true } } },
    });
    if (featured.length) {
      out.push(
        "- Featured players: " +
          featured.map((f) => `${f.player.name} (playerId ${f.playerId})`).join(", "),
      );
    }
  } else if (media.scope === "PLAYER" && media.playerId != null) {
    out.push(`- This player: playerId ${media.playerId}`);
  } else if (media.scope === "TEAM" && media.seasonId != null) {
    out.push(`- This season: seasonId ${media.seasonId}`);
  }
  if (media.authorPersonaId != null) {
    out.push(`- Your byline persona id: ${media.authorPersonaId} (list_articles to see your past pieces)`);
  }

  if (media.promptContext) {
    out.push("");
    out.push(`Editor's added context (not in the stats): ${media.promptContext}`);
  }

  out.push("");
  out.push("Research what's useful, then respond with ONLY the JSON article.");
  return out.join("\n");
}

/**
 * Run generation for one Media row. Safe to call inline: owns its error handling
 * (failures are recorded on the row) and never throws out.
 */
export async function runGeneration(mediaId: number): Promise<void> {
  const media = await db.media.findUnique({
    where: { id: mediaId },
    include: { authorPersona: true },
  });
  if (!media) return;

  try {
    await db.media.update({ where: { id: mediaId }, data: { status: "GENERATING" } });

    let subject: string;
    if (media.scope === "GAME" && media.gameId != null) {
      subject = await describeGame(media.gameId);
    } else if (media.scope === "PLAYER" && media.playerId != null) {
      subject = await describePlayer(media.playerId);
    } else if (media.scope === "TEAM" && media.seasonId != null) {
      subject = await describeSeason(media.seasonId);
    } else {
      throw new Error("Media is missing a subject to write about.");
    }

    const model = await resolveModel(media.mediaType);
    const voice = media.authorPersona?.voice || DEFAULT_VOICE;
    const system = `${SYSTEM_PREFACE}\n\nWrite in this author's voice:\n${voice}`;
    const seed = await buildSeed(media, subject);

    const { headline, body, costUsd } = await writeArticle(model, system, seed);

    await db.media.update({
      where: { id: mediaId },
      data: { headline, body, status: "READY", modelId: model, costUsd, genError: null },
    });
  } catch (e) {
    await db.media.update({
      where: { id: mediaId },
      data: { status: "FAILED", genError: e instanceof Error ? e.message : "Generation failed." },
    });
  }

  revalidatePath("/media");
  if (media.seasonId != null) revalidatePath(`/seasons/${media.seasonId}/media`);
  revalidatePath(`/media/${mediaId}`);
}
