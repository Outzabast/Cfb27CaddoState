// Press conferences: reporters (author personas) question a player or coach live.
// Each answer prompts the next question — a follow-up from the same reporter or a
// new one — until the caps are hit. Question TEXT is written by the model in the
// asking persona's voice; WHO asks (and cap enforcement) is decided in code.

import { db } from "@/lib/db";
import { callOpenRouter, parseJsonLoose, type ChatMessage } from "./openrouter";
import { DEFAULT_MEDIA_MODEL, DEFAULT_VOICE } from "./constants";
import { describePlayer, describeStaffFeature, describeGame, describeGamePreview, describeSeason } from "./subject";
import type { PressConferenceType } from "@/generated/prisma/enums";

export const PRESS_TYPE_LABELS: Record<PressConferenceType, string> = {
  PRE_GAME: "Pre-game",
  POST_GAME: "Post-game",
  PRE_SEASON: "Preseason",
  POST_SEASON: "Postseason",
};

type Asker = { id: number; name: string; voice: string };
type Turn = { personaName: string; question: string; answer: string | null };

export type PressContext = {
  subjectName: string;
  subjectBrief: string;
  occasionLabel: string;
  occasionBrief: string;
  askers: Asker[];
};

/** Load everything the model needs: who's answering, the occasion, and the
 *  reporters (author personas) asking, with their voices. */
export async function buildPressContext(confId: number): Promise<PressContext | null> {
  const conf = await db.pressConference.findUnique({ where: { id: confId } });
  if (!conf) return null;

  let subjectName = "the subject";
  let subjectBrief = "";
  if (conf.playerId != null) {
    const p = await db.player.findUnique({ where: { id: conf.playerId }, select: { name: true } });
    subjectName = p?.name ?? subjectName;
    subjectBrief = await describePlayer(conf.playerId);
  } else if (conf.staffId != null) {
    const s = await db.staff.findUnique({ where: { id: conf.staffId }, select: { name: true } });
    subjectName = s?.name ?? subjectName;
    subjectBrief = await describeStaffFeature(conf.staffId);
  }

  let occasionBrief = "";
  if (conf.type === "PRE_GAME" && conf.gameId != null) occasionBrief = await describeGamePreview(conf.gameId);
  else if (conf.type === "POST_GAME" && conf.gameId != null) occasionBrief = await describeGame(conf.gameId);
  else if (conf.seasonId != null) occasionBrief = await describeSeason(conf.seasonId);

  const personas = conf.personaIds.length
    ? await db.authorPersona.findMany({
        where: { id: { in: conf.personaIds } },
        select: { id: true, name: true, voice: true },
      })
    : [];
  const askers: Asker[] = personas.length
    ? personas.map((p) => ({ id: p.id, name: p.name, voice: p.voice }))
    : [{ id: 0, name: "Beat Writer", voice: DEFAULT_VOICE }];

  return {
    subjectName,
    subjectBrief,
    occasionLabel: PRESS_TYPE_LABELS[conf.type],
    occasionBrief,
    askers,
  };
}

/** Decide + write the next question, or return null when the conference is over
 *  (per-persona or total cap reached). */
export async function nextPressQuestion(
  ctx: PressContext,
  transcript: Turn[],
  maxPerPersona: number,
  maxTotal: number,
): Promise<{ personaId: number | null; personaName: string; question: string; isFollowUp: boolean } | null> {
  if (transcript.length >= maxTotal) return null;

  const counts = new Map<string, number>();
  for (const t of transcript) counts.set(t.personaName, (counts.get(t.personaName) ?? 0) + 1);
  const eligible = ctx.askers.filter((a) => (counts.get(a.name) ?? 0) < maxPerPersona);
  if (eligible.length === 0) return null;

  const lastAsker = transcript.at(-1)?.personaName ?? null;
  const eligibleList = eligible
    .map((a) => `- ${a.name}: ${a.voice}`)
    .join("\n");
  const convo = transcript.length
    ? transcript.map((t) => `${t.personaName}: ${t.question}\n${ctx.subjectName}: ${t.answer ?? "(no answer)"}`).join("\n\n")
    : "(no questions asked yet — this is the opening question)";

  const system =
    "You are moderating a college-football press conference for Caddo State. You write ONE reporter's next " +
    "question, in that reporter's voice. Questions are pointed, specific, and grounded in the briefing — never generic. " +
    "You may have a reporter follow up on the subject's previous answer, or move to a new reporter. Respond with a " +
    "single JSON object and nothing else.";
  const user = [
    `OCCASION: ${ctx.occasionLabel} press conference. At the podium: ${ctx.subjectName}.`,
    "",
    "SUBJECT BRIEFING:",
    ctx.subjectBrief || "(none)",
    "",
    "OCCASION BRIEFING:",
    ctx.occasionBrief || "(none)",
    "",
    "REPORTERS STILL ABLE TO ASK (pick exactly one by name):",
    eligibleList,
    lastAsker ? `\nThe last question was from ${lastAsker}; a follow-up from them is allowed if they're listed above.` : "",
    "",
    "CONVERSATION SO FAR:",
    convo,
    "",
    'Return JSON: { "reporter": "<one of the reporter names above>", "question": "<the question>", "isFollowUp": <true if it builds on the subject\'s last answer> }',
  ].join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let parsed: { reporter?: unknown; question?: unknown; isFollowUp?: unknown };
  try {
    const res = await callOpenRouter(DEFAULT_MEDIA_MODEL, messages, { jsonResponse: true, temperature: 0.8 });
    parsed = parseJsonLoose(res.content) as typeof parsed;
  } catch {
    parsed = {};
  }

  const question = String(parsed.question ?? "").trim();
  if (!question) {
    // Fallback: a plain opener from the first eligible reporter.
    const a = eligible[0];
    return { personaId: a.id || null, personaName: a.name, question: `Talk us through the ${ctx.occasionLabel.toLowerCase()} — what's on your mind?`, isFollowUp: false };
  }
  const wantName = String(parsed.reporter ?? "").trim().toLowerCase();
  const chosen = eligible.find((a) => a.name.toLowerCase() === wantName) ?? eligible[0];
  return {
    personaId: chosen.id || null,
    personaName: chosen.name,
    question,
    isFollowUp: parsed.isFollowUp === true,
  };
}

/** Render the finished Q&A as a Markdown transcript for the Media body, with a
 *  clear divider between each exchange. */
export function renderTranscript(subjectName: string, turns: Turn[]): string {
  return turns
    .map((t) => {
      return [
        `**Q — ${t.personaName}:** ${t.question}`,
        "",
        `**A — ${subjectName}:** ${t.answer?.trim() || "*(no comment)*"}`,
      ].join("\n");
    })
    .join("\n\n---\n\n")
    .trim();
}
