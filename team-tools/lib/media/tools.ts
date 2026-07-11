// The research tools a writer can call while drafting. Read-only accessors over
// the data model — the model decides which to use and builds its own dossiers,
// so articles aren't boxed into a fixed, repetitive context template.

import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import { formatHeight, PLAYER_STATUS_LABELS } from "@/lib/player-profile";
import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import { computeRecord, formatRecord } from "@/lib/season-record";
import { teamLeaders } from "@/lib/season-stats";
import type { BoxLine } from "@/lib/box-score";
import {
  compactStatSummary,
  describeGame,
  describeRecruit,
  describeSeason,
} from "./subject";
import { researchFacts } from "./facts";
import { PRESS_TYPE_LABELS } from "./press-conference";
import { RECRUIT_STATUS_LABELS } from "@/lib/recruits";
import { STAFF_ROLE_LABELS, STAFF_ROLES } from "@/lib/staff";
import type { ToolSchema } from "./openrouter";
import type { FactScope, RecruitStatus } from "@/generated/prisma/enums";

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
        "Full dossier on one player: bio, awards, notable events, status/injury, program notoriety, " +
        "latest position/class/number/starter, career stat totals, and a per-season roster history " +
        "(seasonId + seasonNotoriety). For a specific year's totals use get_player_season_stats.",
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
        "A player's game log across seasons: opponent, week, result, their stat line, and game notoriety. " +
        "Default sort is most recent first; pass sortBy \"notoriety\" to surface breakout performances " +
        "(highest gameNotoriety first). Optionally filter to one seasonId.",
      parameters: {
        type: "object",
        properties: {
          playerId: { type: "integer" },
          seasonId: { type: "integer" },
          sortBy: { type: "string", enum: ["recent", "notoriety"] },
          limit: { type: "integer" },
        },
        required: ["playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_seasons",
      description:
        "All seasons on file (newest first): id, name, years, conference, and W-L record. " +
        "Use to discover past seasons before calling get_season / list_games / list_roster.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_games",
      description:
        "Browse games across seasons. Filter by seasonId, opponent (substring), week, or played. " +
        "sortBy \"week\" (default) is chronological within each season; sortBy \"notoriety\" ranks by " +
        "the highest player gameNotoriety in that game — useful for finding story-worthy contests. " +
        "Returns gameId + seasonId so you can dig in with get_game.",
      parameters: {
        type: "object",
        properties: {
          seasonId: { type: "integer" },
          opponent: { type: "string" },
          week: { type: "integer" },
          played: { type: "boolean" },
          sortBy: { type: "string", enum: ["week", "notoriety"] },
          limit: { type: "integer" },
        },
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
      name: "get_play_by_play",
      description:
        "A game's full ordered play-by-play: every play with its quarter, clock, possessing team, down & distance, and description. Use for precise sequential recall — key plays, momentum swings, exactly how a drive ended.",
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
      name: "get_season_stats",
      description:
        "Season team headline stats and category leaders (passing/rushing/receiving yards, tackles, INTs). " +
        "Use for season/team stories or to compare eras — works for any seasonId.",
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
      name: "get_player_season_stats",
      description:
        "One player's stats and roster slot for a specific season: position, class, number, starter, " +
        "seasonNotoriety, and that year's aggregated box-score totals (not career). " +
        "Use when writing about a past season rather than relying on get_player's latest/career view.",
      parameters: {
        type: "object",
        properties: {
          playerId: { type: "integer" },
          seasonId: { type: "integer" },
        },
        required: ["playerId", "seasonId"],
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
      name: "list_staff",
      description:
        "The coaching staff for a season (by seasonId): head coach + coordinators, with their role and that season's notoriety. Use to attribute strategy, culture, and results to the people running the program.",
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
      name: "get_staff",
      description:
        "Full dossier on one staff member: bio, program-wide notoriety, and their role season-by-season (tenure/history). Use for a coach feature or to ground how long they've been here.",
      parameters: {
        type: "object",
        properties: { staffId: { type: "integer" } },
        required: ["staffId"],
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
  {
    type: "function",
    function: {
      name: "get_recruit",
      description:
        "Full scouting profile on one recruiting prospect: identity, position, stars/composite rating, national/position/state rankings, measurables, high school/hometown, other offers, funnel status with us, and whether they've signed (become a roster player).",
      parameters: {
        type: "object",
        properties: { recruitId: { type: "integer" } },
        required: ["recruitId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_recruits",
      description: "Search recruits by name (substring). Returns id, name, position, stars, and status.",
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
      name: "list_recruits",
      description:
        "A recruiting class (by seasonId), ordered by rating: prospects with position, stars, composite rating, and funnel status. Optionally filter by status.",
      parameters: {
        type: "object",
        properties: {
          seasonId: { type: "integer" },
          status: {
            type: "string",
            enum: ["TARGET", "OFFERED", "COMMITTED", "SIGNED", "ENROLLED", "DECOMMITTED", "LOST"],
          },
        },
        required: ["seasonId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_press_conferences",
      description:
        "Published press conferences you can QUOTE FROM — real answers a player or coach actually gave. Filter by game, season, player, or staff to find relevant ones for this piece. Returns id, who spoke, the occasion, and how many quotes are available.",
      parameters: {
        type: "object",
        properties: {
          gameId: { type: "integer" },
          seasonId: { type: "integer" },
          playerId: { type: "integer" },
          staffId: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_press_conference",
      description:
        "The full Q&A of one press conference by id: each reporter's question and the subject's verbatim answer. Use these as real, attributable quotes in any piece.",
      parameters: {
        type: "object",
        properties: { pressConferenceId: { type: "integer" } },
        required: ["pressConferenceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_facts",
      description:
        "Additional standing editorial facts about the program and this season that weren't important enough to inject up front — background color the box score won't show (rivalries, off-field storylines, roster notes). The high-importance ones are already in your prompt; call this to dig for more. Optionally filter to one layer.",
      parameters: {
        type: "object",
        properties: {
          seasonId: { type: "integer" },
          scope: { type: "string", enum: ["TEAM", "SEASON", "ROSTER"] },
        },
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
    seasons: player.seasonPlayers.map((sp) => ({
      seasonId: sp.seasonRoster.seasonId,
      season: sp.seasonRoster.season.name,
      position: sp.position,
      class: CLASS_LABELS[sp.class],
      number: sp.number,
      isStarter: sp.isStarter,
      seasonNotoriety: sp.seasonNotoriety,
    })),
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

function gameResultLabel(teamPoints: number, oppPoints: number) {
  const result = teamPoints === oppPoints ? "T" : teamPoints > oppPoints ? "W" : "L";
  return `${result} ${teamPoints}-${oppPoints}`;
}

async function listPlayerGames(
  playerId: number,
  limit: number,
  opts: { seasonId?: number | null; sortBy?: string },
) {
  const lines = await db.gamePlayerStat.findMany({
    where: {
      playerId,
      ...(opts.seasonId != null ? { game: { seasonId: opts.seasonId } } : {}),
    },
    include: { game: { include: { season: true } } },
  });
  const played = lines.filter((l) => hasStat(l as unknown as Record<string, number>));
  const sortBy = opts.sortBy === "notoriety" ? "notoriety" : "recent";
  played.sort((a, b) => {
    if (sortBy === "notoriety") {
      return (
        b.gameNotoriety - a.gameNotoriety ||
        b.game.season.startYear - a.game.season.startYear ||
        (b.game.week ?? 0) - (a.game.week ?? 0)
      );
    }
    return (
      b.game.season.startYear - a.game.season.startYear ||
      (b.game.week ?? 0) - (a.game.week ?? 0)
    );
  });

  return {
    sortBy,
    games: played.slice(0, limit).map((l) => ({
      gameId: l.gameId,
      seasonId: l.game.seasonId,
      season: l.game.season.name,
      week: l.game.week,
      opponent: `${l.game.location === "AWAY" ? "@ " : "vs "}${l.game.opponent}`,
      result: gameResultLabel(l.game.teamPoints, l.game.oppPoints),
      gameNotoriety: l.gameNotoriety,
      line: compactStatSummary(l as unknown as Record<string, number>),
    })),
  };
}

async function listSeasons() {
  const seasons = await db.season.findMany({
    orderBy: { startYear: "desc" },
    include: {
      games: { select: { teamPoints: true, oppPoints: true, isConference: true } },
    },
  });
  return {
    seasons: seasons.map((s) => ({
      seasonId: s.id,
      name: s.name,
      startYear: s.startYear,
      endYear: s.endYear,
      conference: s.conference,
      record: formatRecord(computeRecord(s.games)),
    })),
  };
}

async function listGames(args: {
  seasonId?: unknown;
  opponent?: unknown;
  week?: unknown;
  played?: unknown;
  sortBy?: unknown;
  limit?: unknown;
}) {
  const seasonId = int(args.seasonId);
  const week = int(args.week);
  const opponent = String(args.opponent ?? "").trim();
  const sortBy = String(args.sortBy ?? "") === "notoriety" ? "notoriety" : "week";
  const limit = clampLimit(args.limit, 12, 25);

  const playedFilter =
    typeof args.played === "boolean"
      ? args.played
        ? { OR: [{ teamPoints: { gt: 0 } }, { oppPoints: { gt: 0 } }] }
        : { teamPoints: 0, oppPoints: 0 }
      : undefined;

  const games = await db.game.findMany({
    where: {
      ...(seasonId != null ? { seasonId } : {}),
      ...(week != null ? { week } : {}),
      ...(opponent ? { opponent: { contains: opponent, mode: "insensitive" } } : {}),
      ...(playedFilter ?? {}),
    },
    include: {
      season: { select: { id: true, name: true, startYear: true } },
      playerStats: { select: { gameNotoriety: true }, orderBy: { gameNotoriety: "desc" }, take: 1 },
    },
    orderBy: [{ season: { startYear: "desc" } }, { week: "asc" }, { id: "asc" }],
  });

  const rows = games.map((g) => {
    const played = g.teamPoints !== 0 || g.oppPoints !== 0;
    const topNotoriety = g.playerStats[0]?.gameNotoriety ?? 0;
    return {
      gameId: g.id,
      seasonId: g.season.id,
      season: g.season.name,
      week: g.week,
      opponent: `${g.location === "AWAY" ? "@ " : "vs "}${g.opponent}`,
      note: g.note ?? null,
      played,
      result: played ? gameResultLabel(g.teamPoints, g.oppPoints) : "unplayed",
      topGameNotoriety: topNotoriety,
      startYear: g.season.startYear,
    };
  });

  if (sortBy === "notoriety") {
    rows.sort(
      (a, b) =>
        b.topGameNotoriety - a.topGameNotoriety ||
        b.startYear - a.startYear ||
        (b.week ?? 0) - (a.week ?? 0),
    );
  }

  return {
    sortBy,
    games: rows.slice(0, limit).map(({ startYear: _y, ...g }) => g),
  };
}

async function getPlayerSeasonStats(playerId: number, seasonId: number) {
  const sp = await db.seasonPlayer.findFirst({
    where: { playerId, seasonRoster: { seasonId } },
    include: {
      seasonRoster: { include: { season: { select: { id: true, name: true } } } },
      player: { select: { name: true, overallNotoriety: true } },
    },
  });
  if (!sp) return { error: "Player was not on that season's roster." };

  const a = await db.gamePlayerStat.aggregate({
    where: { playerId, game: { seasonId } },
    _sum: agg.sum as never,
    _max: agg.max as never,
  });
  const seasonStats = mergeAggregate(a, PLAYER_STAT_GROUPS);

  // Top breakout games that season by game notoriety.
  const topGames = await db.gamePlayerStat.findMany({
    where: { playerId, game: { seasonId }, gameNotoriety: { gt: 0 } },
    include: { game: { select: { id: true, week: true, opponent: true, location: true, teamPoints: true, oppPoints: true } } },
    orderBy: { gameNotoriety: "desc" },
    take: 5,
  });

  return {
    playerId,
    name: sp.player.name,
    seasonId: sp.seasonRoster.season.id,
    season: sp.seasonRoster.season.name,
    position: sp.position,
    class: CLASS_LABELS[sp.class],
    number: sp.number,
    isStarter: sp.isStarter,
    seasonNotoriety: sp.seasonNotoriety,
    programNotoriety: sp.player.overallNotoriety,
    seasonStats: compactStatSummary(seasonStats),
    topGamesByNotoriety: topGames.map((l) => ({
      gameId: l.game.id,
      week: l.game.week,
      opponent: `${l.game.location === "AWAY" ? "@ " : "vs "}${l.game.opponent}`,
      result: gameResultLabel(l.game.teamPoints, l.game.oppPoints),
      gameNotoriety: l.gameNotoriety,
      line: compactStatSummary(l as unknown as Record<string, number>),
    })),
  };
}

async function getSeasonStats(seasonId: number) {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true },
  });
  if (!season) return { error: "Season not found." };

  const { sum: pSum, max: pMax } = aggregateSelect(PLAYER_STAT_GROUPS);
  const grouped = await db.gamePlayerStat.groupBy({
    by: ["playerId"],
    where: { game: { seasonId } },
    _sum: pSum as never,
    _max: pMax as never,
  });
  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    select: { playerId: true, playerName: true, number: true, seasonNotoriety: true },
    orderBy: { seasonNotoriety: "desc" },
  });
  const nameById = new Map(roster.map((r) => [r.playerId, r.playerName]));
  const numberById = new Map(roster.map((r) => [r.playerId, r.number]));

  const lines: BoxLine[] = grouped.map((g) => {
    const values = mergeAggregate(
      { _sum: g._sum as Record<string, number | null>, _max: g._max as Record<string, number | null> },
      PLAYER_STAT_GROUPS,
    );
    return {
      playerId: g.playerId,
      name: nameById.get(g.playerId) ?? "Unknown",
      number: numberById.get(g.playerId) ?? null,
      ...values,
    } as BoxLine;
  });

  const { sum: tSum } = aggregateSelect(TEAM_STAT_GROUPS);
  const [teamAgg, games] = await Promise.all([
    db.gameTeamStat.aggregate({ where: { game: { seasonId } }, _sum: tSum as never }),
    db.game.findMany({
      where: { seasonId },
      select: { teamPoints: true, oppPoints: true, isConference: true },
    }),
  ]);
  const team = mergeAggregate(teamAgg, TEAM_STAT_GROUPS);
  const rec = computeRecord(games);
  const per = (v: number) => (rec.gamesPlayed > 0 ? (v / rec.gamesPlayed).toFixed(1) : "0.0");

  return {
    seasonId: season.id,
    season: season.name,
    record: formatRecord(rec),
    headline: {
      passYdsPerGame: per(Number(team.passYds) || 0),
      rushYdsPerGame: per(Number(team.rushYds) || 0),
      pointsFor: rec.pointsFor,
      pointsAgainst: rec.pointsAgainst,
      sacks: team.sacks ?? 0,
      interceptions: lines.reduce((a, l) => a + l.defInt, 0),
    },
    leaders: teamLeaders(lines).map((l) => ({
      category: l.title,
      playerId: l.playerId,
      name: l.name,
      value: l.value,
    })),
    topBySeasonNotoriety: roster.slice(0, 8).map((r) => ({
      playerId: r.playerId,
      name: r.playerName,
      seasonNotoriety: r.seasonNotoriety,
    })),
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

async function getPlayByPlay(gameId: number) {
  const plays = await db.gamePlay.findMany({
    where: { gameId },
    orderBy: { sortOrder: "asc" },
    select: { quarter: true, clock: true, team: true, situation: true, description: true },
  });
  if (!plays.length) return { plays: [] };
  const game = await db.game.findUnique({ where: { id: gameId }, select: { opponent: true } });
  const opp = game?.opponent ?? "Opponent";
  return {
    plays: plays.map((p) => ({
      quarter: p.quarter,
      clock: p.clock,
      offense: p.team === "TEAM" ? "Caddo State" : opp,
      situation: p.situation,
      description: p.description,
    })),
  };
}

async function listStaff(seasonId: number) {
  const rows = await db.seasonStaff.findMany({
    where: { seasonId },
    select: { staffId: true, staffName: true, role: true, seasonNotoriety: true },
  });
  const ordered = [...rows].sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role));
  return {
    staff: ordered.map((s) => ({
      staffId: s.staffId,
      name: s.staffName,
      role: STAFF_ROLE_LABELS[s.role],
      seasonNotoriety: s.seasonNotoriety,
    })),
  };
}

async function getStaff(staffId: number) {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    include: {
      seasonStaff: {
        include: { season: { select: { name: true, startYear: true } } },
        orderBy: { season: { startYear: "desc" } },
      },
    },
    omit: { photo: true },
  });
  if (!staff) return { error: "Staff member not found." };
  return {
    id: staff.id,
    name: staff.name,
    bio: staff.bio ?? null,
    overallNotoriety: staff.overallNotoriety,
    history: staff.seasonStaff.map((ss) => ({
      season: ss.season.name,
      role: STAFF_ROLE_LABELS[ss.role],
      seasonNotoriety: ss.seasonNotoriety,
    })),
  };
}

async function findRecruits(query: string) {
  const q = query.trim();
  if (!q) return { recruits: [] };
  const rows = await db.recruit.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 10,
    orderBy: [{ stars: "desc" }, { rating: "desc" }],
    select: { id: true, name: true, position: true, stars: true, status: true },
  });
  return {
    recruits: rows.map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      stars: r.stars,
      status: RECRUIT_STATUS_LABELS[r.status],
    })),
  };
}

async function listRecruits(seasonId: number, status?: RecruitStatus) {
  const rows = await db.recruit.findMany({
    where: { seasonId, ...(status ? { status } : {}) },
    orderBy: [{ stars: "desc" }, { rating: "desc" }, { nationalRank: "asc" }],
    select: { id: true, name: true, position: true, stars: true, rating: true, status: true },
  });
  return {
    recruits: rows.map((r) => ({
      recruitId: r.id,
      name: r.name,
      position: r.position,
      stars: r.stars,
      rating: r.rating,
      status: RECRUIT_STATUS_LABELS[r.status],
    })),
  };
}

async function listPressConferences(args: {
  gameId?: unknown;
  seasonId?: unknown;
  playerId?: unknown;
  staffId?: unknown;
}) {
  const where: Record<string, number> = {};
  const g = int(args.gameId), s = int(args.seasonId), p = int(args.playerId), st = int(args.staffId);
  if (g != null) where.gameId = g;
  if (s != null) where.seasonId = s;
  if (p != null) where.playerId = p;
  if (st != null) where.staffId = st;

  const rows = await db.pressConference.findMany({
    where: { ...where, status: "DONE" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      player: { select: { name: true } },
      staff: { select: { name: true } },
      game: { select: { opponent: true } },
      season: { select: { name: true } },
      _count: { select: { questions: { where: { answer: { not: null } } } } },
    },
  });
  return {
    pressConferences: rows.map((c) => ({
      id: c.id,
      speaker: c.player?.name ?? c.staff?.name ?? "Caddo State",
      type: PRESS_TYPE_LABELS[c.type],
      occasion: c.game ? `vs ${c.game.opponent}` : c.season ? c.season.name : null,
      quotes: c._count.questions,
    })),
  };
}

async function getPressConference(id: number) {
  const conf = await db.pressConference.findUnique({
    where: { id },
    include: {
      player: { select: { name: true } },
      staff: { select: { name: true } },
      questions: { where: { answer: { not: null } }, orderBy: { order: "asc" } },
    },
  });
  if (!conf) return { error: "Press conference not found." };
  const speaker = conf.player?.name ?? conf.staff?.name ?? "Caddo State";
  return {
    speaker,
    type: PRESS_TYPE_LABELS[conf.type],
    quotes: conf.questions.map((q) => ({ reporter: q.personaName, question: q.question, answer: q.answer })),
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
        result =
          id == null
            ? { error: "playerId required." }
            : await listPlayerGames(id, clampLimit(args.limit, 6, 20), {
                seasonId: int(args.seasonId),
                sortBy: String(args.sortBy ?? ""),
              });
        break;
      }
      case "list_seasons":
        result = await listSeasons();
        break;
      case "list_games":
        result = await listGames(args);
        break;
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
      case "get_season_stats": {
        const id = int(args.seasonId);
        result = id == null ? { error: "seasonId required." } : await getSeasonStats(id);
        break;
      }
      case "get_player_season_stats": {
        const playerId = int(args.playerId);
        const seasonId = int(args.seasonId);
        result =
          playerId == null || seasonId == null
            ? { error: "playerId and seasonId required." }
            : await getPlayerSeasonStats(playerId, seasonId);
        break;
      }
      case "get_play_by_play": {
        const id = int(args.gameId);
        result = id == null ? { error: "gameId required." } : await getPlayByPlay(id);
        break;
      }
      case "list_roster": {
        const id = int(args.seasonId);
        result = id == null ? { error: "seasonId required." } : await listRoster(id);
        break;
      }
      case "list_staff": {
        const id = int(args.seasonId);
        result = id == null ? { error: "seasonId required." } : await listStaff(id);
        break;
      }
      case "get_staff": {
        const id = int(args.staffId);
        result = id == null ? { error: "staffId required." } : await getStaff(id);
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
      case "get_recruit": {
        const id = int(args.recruitId);
        result = id == null ? { error: "recruitId required." } : { profile: await describeRecruit(id) };
        break;
      }
      case "find_recruits":
        result = await findRecruits(String(args.query ?? ""));
        break;
      case "list_recruits": {
        const id = int(args.seasonId);
        const statusRaw = String(args.status ?? "");
        const status = (Object.keys(RECRUIT_STATUS_LABELS) as string[]).includes(statusRaw)
          ? (statusRaw as RecruitStatus)
          : undefined;
        result = id == null ? { error: "seasonId required." } : await listRecruits(id, status);
        break;
      }
      case "list_press_conferences":
        result = await listPressConferences(args);
        break;
      case "get_press_conference": {
        const id = int(args.pressConferenceId);
        result = id == null ? { error: "pressConferenceId required." } : await getPressConference(id);
        break;
      }
      case "list_facts": {
        const scopeRaw = String(args.scope ?? "");
        const scope = (["TEAM", "SEASON", "ROSTER"] as string[]).includes(scopeRaw)
          ? (scopeRaw as FactScope)
          : undefined;
        result = { facts: await researchFacts(int(args.seasonId), scope) };
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
