// The async generation job. Called from processMediaEvent once a Media row exists
// PENDING. Resolves the model + voice, assembles the seed (primary subject data +
// the handles the writer can research), runs the tool-calling agent, writes the
// article back onto the row, and flips status to READY or FAILED.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_MEDIA_MODEL, DEFAULT_VOICE } from "./constants";
import { writeArticle } from "./agent";
import {
  describeGame,
  describeGamePreview,
  describeInjuryReport,
  describePlayer,
  describePlayers,
  describeSeason,
} from "./subject";
import { angleBySlug, defaultAngleForScope } from "./angles";

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

// The writing task per angle. Falls back to a generic line for unknown slugs.
const ANGLE_INSTRUCTION: Record<string, string> = {
  recap: "Write a GAME RECAP from the box score — what happened and who decided it.",
  preview:
    "Write a GAME PREVIEW of this UPCOMING game. It has NOT been played — never state or imply a final score, stats, or result. Set the stage: the matchup, Caddo State's form, and players to watch.",
  feature: "Write a PLAYER FEATURE.",
  season: "Write a SEASON / TEAM story on the state of the program.",
  injury: "Write an INJURY REPORT on the team's health, grounded in the listed injured players.",
};

type MediaRow = {
  scope: "PLAYER" | "GAME" | "TEAM";
  angle: string | null;
  playerId: number | null;
  gameId: number | null;
  seasonId: number | null;
  promptContext: string | null;
  authorPersonaId: number | null;
};

/** Build the seed message: the subject data + the ids the writer can research. */
async function buildSeed(
  media: MediaRow,
  subject: string,
  subjectPlayerIds: number[],
  focusGameIds: number[],
): Promise<string> {
  const angle = media.angle ?? defaultAngleForScope(media.scope);
  const out: string[] = [];
  out.push(ANGLE_INSTRUCTION[angle] ?? "Write a news article for Caddo State.");
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
    if (subjectPlayerIds.length > 1) {
      const names = await db.player.findMany({
        where: { id: { in: subjectPlayerIds } },
        select: { id: true, name: true },
      });
      const byId = new Map(names.map((n) => [n.id, n.name]));
      out.push(
        "- Players this article is about: " +
          subjectPlayerIds.map((id) => `${byId.get(id) ?? "Unknown"} (playerId ${id})`).join(", "),
      );
    } else {
      out.push(`- This player: playerId ${media.playerId}`);
    }
    if (focusGameIds.length) {
      const games = await db.game.findMany({
        where: { id: { in: focusGameIds } },
        select: { id: true, opponent: true, week: true },
      });
      out.push(
        "- Focus games (center the piece on the subject's performance in these): " +
          games
            .map((g) => `vs ${g.opponent}${g.week != null ? ` Wk ${g.week}` : ""} (gameId ${g.id})`)
            .join(", "),
      );
    }
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

    const angle = media.angle ?? defaultAngleForScope(media.scope);
    const isPreview = angle === "preview";
    const isInjury = angle === "injury";

    let subject: string;
    let subjectPlayerIds: number[] = [];
    let focusGameIds: number[] = [];
    if (media.scope === "GAME" && media.gameId != null) {
      subject = isPreview ? await describeGamePreview(media.gameId) : await describeGame(media.gameId);
    } else if (media.scope === "PLAYER" && media.playerId != null) {
      // A player article can cover several players (tagged via MediaTag), and can
      // be focused on specific games (also MediaTag).
      const tags = await db.mediaTag.findMany({
        where: { mediaId },
        select: { playerId: true, gameId: true },
      });
      subjectPlayerIds = [
        media.playerId,
        ...tags.map((t) => t.playerId).filter((id): id is number => id != null && id !== media.playerId),
      ];
      focusGameIds = tags.map((t) => t.gameId).filter((id): id is number => id != null);
      subject =
        subjectPlayerIds.length > 1
          ? await describePlayers(subjectPlayerIds)
          : await describePlayer(media.playerId);
    } else if (media.scope === "TEAM" && media.seasonId != null) {
      subject = isInjury
        ? await describeInjuryReport(media.seasonId)
        : await describeSeason(media.seasonId);
    } else {
      throw new Error("Media is missing a subject to write about.");
    }

    const model = await resolveModel(media.mediaType);
    const voice = media.authorPersona?.voice || DEFAULT_VOICE;
    const system = `${SYSTEM_PREFACE}\n\nWrite in this author's voice:\n${voice}`;
    const seed = await buildSeed(media, subject, subjectPlayerIds, focusGameIds);

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
