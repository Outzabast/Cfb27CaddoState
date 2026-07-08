// X-style social post generation. Reuses the research agent (runAgent), but the
// model returns a short post + a thread of replies (some attributed to known
// author personas, the rest to randomly-generated fans) instead of an article.

import { runAgent } from "./agent";
import { parseJsonLoose } from "./openrouter";

export type ReplyDraft = {
  /** Persona name (isPersona) or a made-up @handle (fan). */
  author: string;
  isPersona: boolean;
  displayName: string | null;
  body: string;
  likes: number;
};

export type WrittenSocial = {
  post: string;
  replies: ReplyDraft[];
  costUsd: number | null;
  toolCalls: number;
};

/** System prompt for a social post: the account's voice + the reply cast + schema. */
export function socialSystem(
  posterName: string,
  posterVoice: string,
  otherPersonaNames: string[],
): string {
  const cast = otherPersonaNames.length ? otherPersonaNames.join(", ") : "(none)";
  return (
    `You run the X (Twitter) account "${posterName}" covering the Caddo State ` +
    "Lumberjacks. Refer to the team as Caddo State or the Lumberjacks — never invent " +
    "a different nickname or city. You have research tools — use them to ground the " +
    "post in real players and stats; never invent scores, names, or results.\n\n" +
    `Write ONE short, punchy X-style post (max 280 chars) in this voice:\n${posterVoice}\n\n` +
    "Then write 4–8 replies to it — a realistic, varied mix (hyped, salty, funny, " +
    "analytical) of:\n" +
    `- some of these KNOWN accounts (use the EXACT name, set isPersona true): ${cast}\n` +
    "- randomly-generated fans (invent an @handle + display name, isPersona false).\n\n" +
    "Reply bodies are short too. Do NOT put hashtags in the post — the app adds them " +
    "from the post's tags.\n\n" +
    "When done researching, respond with ONLY this JSON object:\n" +
    '{"post": string, "replies": [{"author": string, "isPersona": boolean, ' +
    '"displayName": string, "body": string, "likes": number}]}'
  );
}

function normalizeReply(raw: unknown): ReplyDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const author = String(r.author ?? "").trim();
  const body = String(r.body ?? "").trim();
  if (!author || !body) return null;
  const likes = Number(r.likes);
  return {
    author,
    isPersona: r.isPersona === true,
    displayName: r.displayName ? String(r.displayName).trim() : null,
    body,
    likes: Number.isFinite(likes) && likes >= 0 ? Math.trunc(likes) : 0,
  };
}

/** Run the agent and parse its social JSON ({post, replies}). */
export async function writeSocial(
  model: string,
  system: string,
  seed: string,
): Promise<WrittenSocial> {
  const { content, costUsd, toolCalls } = await runAgent(model, system, seed);
  const parsed = parseJsonLoose(content) as { post?: unknown; replies?: unknown };
  const post = String(parsed.post ?? "").trim();
  if (!post) throw new Error("Model response was missing the post text.");
  const replies = Array.isArray(parsed.replies)
    ? parsed.replies.map(normalizeReply).filter((r): r is ReplyDraft => r !== null)
    : [];
  return { post, replies, costUsd: costUsd || null, toolCalls };
}
