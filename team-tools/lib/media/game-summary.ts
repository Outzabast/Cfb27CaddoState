// A one-paragraph game summary written from the box-score / play-by-play data in a
// chosen author persona's voice. Distinct from a full recap article — it's the
// quick blurb shown under the score on the box-score page. Uses the same research
// agent as the article generator (read-only tools over the data model) so it can
// pull season context, player history, and prior coverage to stay accurate and
// avoid repeating itself — it just returns one tight paragraph instead of an article.

import { db } from "@/lib/db";
import { runAgent } from "./agent";
import { parseJsonLoose } from "./openrouter";
import { assembleFacts } from "./facts";
import { DEFAULT_MEDIA_MODEL, DEFAULT_VOICE, TEAM_FACTS } from "./constants";
import { describeGame } from "./subject";

/** Generate a tight one-paragraph summary of a game, grounded in its stored data
 *  and whatever the writer researches with the media tools. */
export async function writeGameSummary(gameId: number, personaId: number | null): Promise<string> {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { seasonId: true } });
  if (!game) throw new Error("Game not found.");

  let voice = DEFAULT_VOICE;
  let model = DEFAULT_MEDIA_MODEL;
  if (personaId) {
    const p = await db.authorPersona.findUnique({
      where: { id: personaId },
      select: { voice: true, modelId: true },
    });
    if (p) {
      voice = p.voice;
      if (p.modelId) model = p.modelId;
    }
  }

  const system =
    TEAM_FACTS + " " +
    "You are writing a short game summary for a college-football program's internal media hub. " +
    "You have read-only research tools — use them to ENRICH and FACT-CHECK the summary before you " +
    "write it: pull player dossiers and game history (get_player, list_player_games), the roster " +
    "and coaching staff, the season record (get_season), prior articles about this game or by you " +
    "(list_articles / get_article) so you stay consistent and don't repeat an angle, real quotes " +
    "from published press conferences, and standing background facts (list_facts). Ground every " +
    "claim strictly in that data — never invent scores, names, or stats, and never contradict the " +
    "box score.\n\n" +
    `Write in this author's voice:\n${voice}\n\n` +
    "Produce a SINGLE short paragraph (3–4 sentences) giving a HIGH-LEVEL rundown of the game — NOT " +
    "a play-by-play recap. Cover the final result and score, the overall character of the game (a " +
    "blowout, a nail-biter, a shootout, a comeback, who controlled it), and one or two standout " +
    "individual performances with their key stat totals. Do NOT walk through the game chronologically, " +
    "quarter by quarter, or drive by drive; never cite game-clock times; don't recount individual " +
    'scoring plays in sequence. When done researching, reply with ONLY a JSON object: {"summary": string} ' +
    "— the paragraph only, with no dateline, headline, label, or preamble inside it.";

  const seed = await buildSummarySeed(gameId, game.seasonId, personaId);
  const { content } = await runAgent(model, system, seed);

  const parsed = parseJsonLoose(content) as { summary?: unknown };
  const summary = String(parsed.summary ?? "").trim();
  // Fall back to raw content if the model answered in prose instead of JSON.
  return summary || content.trim();
}

/** The seed message: the game's box-score brief plus the handles the writer can
 *  research (mirrors buildSeed for GAME scope, minus the article scaffolding). */
async function buildSummarySeed(
  gameId: number,
  seasonId: number,
  personaId: number | null,
): Promise<string> {
  const out: string[] = [];
  out.push("Write a short, high-level rundown of the Caddo State game below.");
  out.push("");
  out.push("PRIMARY SUBJECT DATA:");
  out.push(await describeGame(gameId));
  out.push("");
  out.push("Handles you can research with the tools:");
  out.push(`- This game: gameId ${gameId}, seasonId ${seasonId}`);

  const featured = await db.gamePlayerStat.findMany({
    where: { gameId, gameNotoriety: { gt: 0 } },
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
  if (personaId != null) {
    out.push(`- Your byline persona id: ${personaId} (list_articles to see your past pieces)`);
  }

  const facts = await assembleFacts(seasonId);
  if (facts) {
    out.push("");
    out.push(facts);
  }

  out.push("");
  out.push('Research what\'s useful, then respond with ONLY {"summary": string}.');
  return out.join("\n");
}
