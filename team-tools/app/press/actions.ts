"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readIdList } from "@/lib/media/media-space";
import {
  buildPressContext,
  nextPressQuestion,
  renderTranscript,
  PRESS_TYPE_LABELS,
} from "@/lib/media/press-conference";
import { synthesizeSpeech } from "@/lib/media/audio";
import { DEFAULT_AUDIO_MODEL, DEFAULT_TTS_VOICE } from "@/lib/media/constants";
import type { PressConferenceType } from "@/generated/prisma/enums";

function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** The current turn's Q&A history, oldest first. */
async function turnsFor(confId: number) {
  const qs = await db.pressConferenceQuestion.findMany({
    where: { conferenceId: confId },
    orderBy: { order: "asc" },
    select: { personaName: true, question: true, answer: true },
  });
  return qs;
}

/** Generate + persist the next question for a conference (no-op when it's over or
 *  if generation fails — the room can still be finished with what's answered). */
async function appendNextQuestion(confId: number): Promise<void> {
  try {
    const conf = await db.pressConference.findUnique({ where: { id: confId } });
    if (!conf || conf.status === "DONE") return;
    // Don't queue a second unanswered question.
    const openCount = await db.pressConferenceQuestion.count({
      where: { conferenceId: confId, answer: null },
    });
    if (openCount > 0) return;

    const ctx = await buildPressContext(confId);
    if (!ctx) return;
    const turns = await turnsFor(confId);
    const next = await nextPressQuestion(ctx, turns, conf.maxPerPersona, conf.maxTotal);
    if (!next) return;
    const created = await db.pressConferenceQuestion.create({
      data: {
        conferenceId: confId,
        order: turns.length,
        personaId: next.personaId,
        personaName: next.personaName,
        question: next.question,
        isFollowUp: next.isFollowUp,
      },
      select: { id: true },
    });

    // Optionally voice the question in the asking persona's TTS voice.
    if (conf.speakQuestions) {
      try {
        const voice = next.personaId
          ? (await db.authorPersona.findUnique({ where: { id: next.personaId }, select: { ttsVoice: true } }))?.ttsVoice ?? DEFAULT_TTS_VOICE
          : DEFAULT_TTS_VOICE;
        const audioModel =
          (await db.modelSetting.findUnique({ where: { mediaType: "AUDIO" }, select: { modelId: true } }))?.modelId ??
          DEFAULT_AUDIO_MODEL;
        const speech = await synthesizeSpeech(audioModel, voice, next.question);
        await db.pressConferenceQuestion.update({
          where: { id: created.id },
          data: { audio: speech.wav, audioMime: speech.mime },
        });
      } catch (e) {
        console.error("presser TTS failed", e);
      }
    }
  } catch (e) {
    console.error("press question generation failed", e);
  }
}

/** Start a press conference: validate the occasion + subject + reporters, create
 *  it, ask the opening question, and open the room. */
export async function createPressConference(formData: FormData) {
  const occasion = String(formData.get("occasion") ?? ""); // "game" | "season"
  const subjectKind = String(formData.get("subjectKind") ?? ""); // "player" | "staff"
  const subjectId = Number(formData.get("subjectId"));
  if (!Number.isInteger(subjectId)) throw new Error("Pick who's at the podium.");

  let type: PressConferenceType;
  let gameId: number | null = null;
  let seasonId: number | null = null;

  if (occasion === "game") {
    gameId = Number(formData.get("gameId"));
    if (!Number.isInteger(gameId)) throw new Error("Pick a game.");
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: { teamPoints: true, oppPoints: true },
    });
    if (!game) throw new Error("Game not found.");
    // A recorded result forces a post-game presser; an unplayed game is pre-game.
    type = game.teamPoints !== 0 || game.oppPoints !== 0 ? "POST_GAME" : "PRE_GAME";
  } else if (occasion === "season") {
    seasonId = Number(formData.get("seasonId"));
    if (!Number.isInteger(seasonId)) throw new Error("Pick a season.");
    type = String(formData.get("seasonPhase")) === "post" ? "POST_SEASON" : "PRE_SEASON";
  } else {
    throw new Error("Pick a game or a season.");
  }

  const conf = await db.pressConference.create({
    data: {
      type,
      gameId,
      seasonId,
      playerId: subjectKind === "player" ? subjectId : null,
      staffId: subjectKind === "staff" ? subjectId : null,
      personaIds: readIdList(formData, "personaId"),
      maxPerPersona: clampInt(formData.get("maxPerPersona"), 2, 1, 5),
      maxTotal: clampInt(formData.get("maxTotal"), 10, 1, 30),
      speakQuestions: formData.get("speakQuestions") != null,
    },
    select: { id: true },
  });

  await appendNextQuestion(conf.id); // the opening question
  redirect(`/press/${conf.id}`);
}

/** Answer the pending question, then have the AI ask the next one. */
export async function answerQuestion(formData: FormData) {
  const confId = Number(formData.get("conferenceId"));
  const questionId = Number(formData.get("questionId"));
  if (![confId, questionId].every(Number.isInteger)) throw new Error("Bad ids.");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) throw new Error("Type your response.");

  await db.pressConferenceQuestion.update({ where: { id: questionId }, data: { answer } });
  await appendNextQuestion(confId);
  revalidatePath(`/press/${confId}`);
}

/** Publish the conference: render the answered Q&A into a transcript Media piece
 *  and mark it done. */
export async function finishPressConference(formData: FormData) {
  const confId = Number(formData.get("conferenceId"));
  if (!Number.isInteger(confId)) throw new Error("Bad id.");

  const conf = await db.pressConference.findUnique({
    where: { id: confId },
    include: {
      questions: { where: { answer: { not: null } }, orderBy: { order: "asc" } },
      player: { select: { name: true } },
      staff: { select: { name: true } },
      game: { select: { opponent: true, seasonId: true } },
      season: { select: { name: true } },
    },
  });
  if (!conf) throw new Error("Press conference not found.");
  if (conf.questions.length === 0) throw new Error("Answer at least one question before publishing.");
  if (conf.mediaId) redirect(`/media/${conf.mediaId}`);

  const subjectName = conf.player?.name ?? conf.staff?.name ?? "Caddo State";
  const occasionSuffix = conf.game
    ? ` vs ${conf.game.opponent}`
    : conf.season
      ? ` — ${conf.season.name}`
      : "";
  const headline = `${PRESS_TYPE_LABELS[conf.type]} presser: ${subjectName}${occasionSuffix}`;
  const body = renderTranscript(
    subjectName,
    conf.questions.map((q) => ({ personaName: q.personaName, question: q.question, answer: q.answer })),
  );

  const mediaId = await db.$transaction(async (tx) => {
    const media = await tx.media.create({
      data: {
        mediaType: "ARTICLE",
        scope: conf.playerId != null ? "PLAYER" : "STAFF",
        status: "READY",
        headline,
        body,
        playerId: conf.playerId,
        staffId: conf.staffId,
      },
      select: { id: true },
    });
    // Surface it on the relevant game/season pages via tags.
    const tags: { mediaId: number; gameId?: number; seasonId?: number }[] = [];
    if (conf.gameId != null) {
      tags.push({ mediaId: media.id, gameId: conf.gameId });
      if (conf.game?.seasonId != null) tags.push({ mediaId: media.id, seasonId: conf.game.seasonId });
    }
    if (conf.seasonId != null) tags.push({ mediaId: media.id, seasonId: conf.seasonId });
    if (tags.length) await tx.mediaTag.createMany({ data: tags });

    await tx.pressConference.update({ where: { id: confId }, data: { status: "DONE", mediaId: media.id } });
    return media.id;
  });

  revalidatePath("/media");
  redirect(`/media/${mediaId}`);
}
