// The research tools a writer can call while drafting. Read-only accessors over
// the data model — the model decides which to use and builds its own dossiers,
// so articles aren't boxed into a fixed, repetitive context template.

import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import { formatHeight, PLAYER_STATUS_LABELS } from "@/lib/player-profile";
import {
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import {
  compactStatSummary,
  describeGame,
  describeSeason,
} from "./subject";
import type { ToolSchema } from "./openrouter";

const agg = aggregateSelect(PLAYER_STAT_GROUPS);
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const clampLimit = (v: unknown, def: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
};

/** The tool schemas advertised to the model (OpenAI function-calling format). */
export const MEDIA_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "get_player",
      description:
        "Full dossier on one player: bio, awards, notable events, status/injury, notoriety, current position/class/number/starter, and career stat totals.",
      parameters: {
        type: "object",
        properties: { playerId: { type: "integer" } },
        required: ["playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_players",
      description: "Search players by name (substring). Returns id, name, and latest position/class.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_player_games",
      description:
        "A player's game log, most recent first: opponent, week, result, their stat line, and that game's notoriety.",
      parameters: {
        type: "object",
        properties: { playerId: { type: "integer" }, limit: { type: "integer" } },
        required: ["playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_game",
      description:
        "A game's full box score: score by quarter, team totals, every Caddo State player's line, and the notoriety 'story focus'.",
      parameters: {
        type: "object",
        properties: { gameId: { type: "integer" } },
        required: ["gameId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_season",
      description: "A season overview: record and game-by-game results.",
      parameters: {
        type: "object",
        properties: { seasonId: { type: "integer" } },
        required: ["seasonId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_roster",
      description:
        "A season's roster, ordered by notoriety: players with position, class, number, starter flag, and season notoriety.",
      parameters: {
        type: "object",
        properties: { seasonId: { type: "integer" } },
        required: ["seasonId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_articles",
      description:
        "Prior generated articles, filterable by persona, player, game, or season. Returns id, headline, date, excerpt. Use to keep continuity and avoid repeating angles.",
      parameters: {
        type: "object",
        properties: {
          personaId: { type: "integer" },
          playerId: { type: "integer" },
          gameId: { type: "integer" },
          seasonId: { type: "integer" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_article",
      description: "The full text (headline + body) of a prior article by id.",
      parameters: {
        type: "object",
        properties: { mediaId: { type: "integer" } },
        required: ["mediaId"],
      },
    },
  },
];

const MAX_BODY = 4000;

async function getPlayer(playerId: number) {
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      seasonPlayers: {
        include: { seasonRoster: { include: { season: true } } },
        orderBy: { seasonRoster: { season: { startYear: "desc" } } },
      },
    },
    omit: { photo: true },
  });
  if (!player) return { error: "Player not found." };

  const latest = player.seasonPlayers[0];
  const a = await db.gamePlayerStat.aggregate({
    where: { playerId },
    _sum: agg.sum as never,
    _max: agg.max as never,
  });
  const career = mergeAggregate(a, PLAYER_STAT_GROUPS);

  return {
    id: player.id,
    name: player.name,
    status: PLAYER_STATUS_LABELS[player.status],
    injuryDetails: player.status === "INJURED" ? player.injuryDetails ?? null : null,
    overallNotoriety: player.overallNotoriety,
    position: latest?.position ?? null,
    class: latest ? CLASS_LABELS[latest.class] : null,
    number: latest?.number ?? null,
    isStarter: latest?.isStarter ?? false,
    seasonNotoriety: latest?.seasonNotoriety ?? 0,
    height: formatHeight(player.heightInches),
    weightLbs: player.weightLbs ?? null,
    hometown: player.hometown ?? null,
    bio: player.bio ?? null,
    awards: player.awards ?? null,
    notableEvents: player.notableEvents ?? null,
    careerStats: compactStatSummary(career),
    seasonsPlayed: player.seasonPlayers.length,
  };
}

async function findPlayers(query: string) {
  const q = query.trim();
  if (!q) return { players: [] };
  const rows = await db.player.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 10,
    include: {
      seasonPlayers: {
        take: 1,
        orderBy: { seasonRoster: { season: { startYear: "desc" } } },
      },
    },
  });
  return {
    players: rows.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.seasonPlayers[0]?.position ?? null,
      class: p.seasonPlayers[0] ? CLASS_LABELS[p.seasonPlayers[0].class] : null,
    })),
  };
}

const hasStat = (v: Record<string, number>) =>
  PLAYER_STAT_GROUPS.some((g) => g.fields.some((f) => Number(v[f.name]) !== 0));

async function listPlayerGames(playerId: number, limit: number) {
  const lines = await db.gamePlayerStat.findMany({
    where: { playerId },
    include: { game: { include: { season: true } } },
  });
  const played = lines
    .filter((l) => hasStat(l as unknown as Record<string, number>))
    .sort(
      (a, b) =>
        b.game.season.startYear - a.game.season.startYear ||
        (b.game.week ?? 0) - (a.game.week ?? 0),
    )
    .slice(0, limit);

  return {
    games: played.map((l) => {
      const t = l.game.teamPoints, o = l.game.oppPoints;
      const result = t === o ? "T" : t > o ? "W" : "L";
      return {
        season: l.game.season.name,
        week: l.game.week,
        opponent: `${l.game.location === "AWAY" ? "@ " : "vs "}${l.game.opponent}`,
        result: `${result} ${t}-${o}`,
        gameNotoriety: l.gameNotoriety,
        line: compactStatSummary(l as unknown as Record<string, number>),
      };
    }),
  };
}

async function listRoster(seasonId: number) {
  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    include: { player: { select: { status: true } } },
    orderBy: { seasonNotoriety: "desc" },
  });
  return {
    roster: roster.map((sp) => ({
      playerId: sp.playerId,
      name: sp.playerName,
      position: sp.position,
      class: CLASS_LABELS[sp.class],
      number: sp.number,
      isStarter: sp.isStarter,
      seasonNotoriety: sp.seasonNotoriety,
      status: PLAYER_STATUS_LABELS[sp.player.status],
    })),
  };
}

async function listArticles(args: {
  personaId?: unknown;
  playerId?: unknown;
  gameId?: unknown;
  seasonId?: unknown;
  limit?: unknown;
}) {
  const where: Record<string, number> = {};
  const persona = int(args.personaId);
  const player = int(args.playerId);
  const game = int(args.gameId);
  const season = int(args.seasonId);
  if (persona != null) where.authorPersonaId = persona;
  if (player != null) where.playerId = player;
  if (game != null) where.gameId = game;
  if (season != null) where.seasonId = season;

  const rows = await db.media.findMany({
    where: { ...where, status: "READY" },
    orderBy: { createdAt: "desc" },
    take: clampLimit(args.limit, 6, 12),
    select: { id: true, headline: true, body: true, createdAt: true },
  });
  return {
    articles: rows.map((m) => ({
      id: m.id,
      headline: m.headline,
      date: m.createdAt.toISOString().slice(0, 10),
      excerpt: (m.body ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
    })),
  };
}

async function getArticle(mediaId: number) {
  const m = await db.media.findUnique({
    where: { id: mediaId },
    select: { headline: true, body: true, status: true },
  });
  if (!m) return { error: "Article not found." };
  return { headline: m.headline, body: (m.body ?? "").slice(0, MAX_BODY), status: m.status };
}

/** Execute a tool call and return a JSON string result (never throws). */
export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    let result: unknown;
    switch (name) {
      case "get_player": {
        const id = int(args.playerId);
        result = id == null ? { error: "playerId required." } : await getPlayer(id);
        break;
      }
      case "find_players":
        result = await findPlayers(String(args.query ?? ""));
        break;
      case "list_player_games": {
        const id = int(args.playerId);
        result = id == null ? { error: "playerId required." } : await listPlayerGames(id, clampLimit(args.limit, 6, 15));
        break;
      }
      case "get_game": {
        const id = int(args.gameId);
        result = id == null ? { error: "gameId required." } : { boxScore: await describeGame(id) };
        break;
      }
      case "get_season": {
        const id = int(args.seasonId);
        result = id == null ? { error: "seasonId required." } : { overview: await describeSeason(id) };
        break;
      }
      case "list_roster": {
        const id = int(args.seasonId);
        result = id == null ? { error: "seasonId required." } : await listRoster(id);
        break;
      }
      case "list_articles":
        result = await listArticles(args);
        break;
      case "get_article": {
        const id = int(args.mediaId);
        result = id == null ? { error: "mediaId required." } : await getArticle(id);
        break;
      }
      default:
        result = { error: `Unknown tool: ${name}` };
    }
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Tool failed." });
  }
}
