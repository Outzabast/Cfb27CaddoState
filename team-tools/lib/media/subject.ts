// Turns a media piece's subject (a game, a player, or a season) into a compact
// plain-text data block the LLM writes from. Everything here is read straight
// from the same rows the app already displays — the model only ever sees real,
// stored stats (plus whatever extra context the user typed at trigger time).

import { db } from "@/lib/db";
import { BOX_CATEGORIES, teamStatRows, type BoxLine, type TeamTotals } from "@/lib/box-score";
import { CLASS_LABELS } from "@/lib/classes";
import { formatHeight, PLAYER_STATUS_LABELS } from "@/lib/player-profile";
import {
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";

const STAT_FIELDS = PLAYER_STAT_GROUPS.flatMap((g) => g.fields);
function hasAnyStat(line: Record<string, number>): boolean {
  return STAT_FIELDS.some((f) => Number(line[f.name]) !== 0);
}

function resultWord(t: number, o: number): string {
  if (t === o) return "tie";
  return t > o ? "win" : "loss";
}

/** One player's box line rendered as "Passing: C/ATT 20/30, YDS 250, ...". */
function lineToText(l: BoxLine): string {
  const parts: string[] = [];
  for (const cat of BOX_CATEGORIES) {
    if (!cat.eligible(l)) continue;
    const cells = cat.cols.map((c) => `${c.label} ${c.cell(l)}`).join(", ");
    parts.push(`${cat.title}: ${cells}`);
  }
  return parts.join(" | ");
}

/** A game recap's data: scoreboard, team comparison, and every player who did
 *  something for Caddo State. */
export async function describeGame(gameId: number): Promise<string> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      season: true,
      teamStats: true,
      playerStats: { include: { player: { select: { name: true } } } },
    },
  });
  if (!game) throw new Error("Game not found.");

  // Jersey numbers for this season, to label the stat lines.
  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId: game.seasonId } },
    select: { playerId: true, number: true, position: true },
  });
  const meta = new Map(roster.map((r) => [r.playerId, r]));

  const lines: BoxLine[] = game.playerStats
    .filter((s) => hasAnyStat(s as unknown as Record<string, number>))
    .map((s) => ({
      ...(s as unknown as BoxLine),
      playerId: s.playerId,
      name: s.player.name,
      number: meta.get(s.playerId)?.number ?? null,
    }));

  const loc =
    game.location === "AWAY" ? "at " : game.location === "NEUTRAL" ? "vs (neutral) " : "vs ";
  const res = resultWord(game.teamPoints, game.oppPoints);

  // Who to feature: the highest game-notoriety performers (a backup who explodes
  // outranks a starter who didn't, since gameNotoriety is per-game).
  const focus = [...game.playerStats]
    .filter((s) => s.gameNotoriety > 0)
    .sort((a, b) => b.gameNotoriety - a.gameNotoriety)
    .slice(0, 3)
    .map((s) => s.player.name);

  const out: string[] = [];
  out.push(`GAME RECAP — Caddo State ${loc}${game.opponent}`);
  out.push(`Season: ${game.season.name}${game.week != null ? `, Week ${game.week}` : ""}`);
  out.push(
    `Final: Caddo State ${game.teamPoints}, ${game.opponent} ${game.oppPoints} (Caddo State ${res})`,
  );
  out.push(
    `By quarter — Caddo State: ${game.teamQ1}/${game.teamQ2}/${game.teamQ3}/${game.teamQ4}` +
      (game.teamOt ? ` (OT ${game.teamOt})` : "") +
      `; ${game.opponent}: ${game.oppQ1}/${game.oppQ2}/${game.oppQ3}/${game.oppQ4}` +
      (game.oppOt ? ` (OT ${game.oppOt})` : ""),
  );

  if (focus.length) {
    out.push("");
    out.push(`Story focus (most noteworthy performances this game): ${focus.join(", ")}`);
  }

  if (game.teamStats) {
    out.push("");
    out.push("Team totals (Caddo State):");
    for (const row of teamStatRows(game.teamStats as unknown as TeamTotals, lines)) {
      out.push(`  ${row.label}: ${row.value}`);
    }
  }

  out.push("");
  out.push("Caddo State individual stat lines:");
  if (lines.length === 0) {
    out.push("  (no individual stats recorded)");
  } else {
    for (const l of lines) {
      const info = meta.get(l.playerId);
      const tag = [info?.position, l.number != null ? `#${l.number}` : null]
        .filter(Boolean)
        .join(" ");
      out.push(`  ${l.name}${tag ? ` (${tag})` : ""} — ${lineToText(l)}`);
    }
  }
  return out.join("\n");
}

/** A player feature's data: identity, career + latest-season totals, recent games. */
export async function describePlayer(playerId: number): Promise<string> {
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      seasonPlayers: { include: { seasonRoster: { include: { season: true } } } },
    },
    omit: { photo: true },
  });
  if (!player) throw new Error("Player not found.");

  const entries = [...player.seasonPlayers].sort(
    (a, b) => a.seasonRoster.season.startYear - b.seasonRoster.season.startYear,
  );
  const latest = entries.at(-1);
  const positions = [...new Set(entries.map((e) => e.position))];

  const { sum, max } = aggregateSelect(PLAYER_STAT_GROUPS);
  const careerAgg = await db.gamePlayerStat.aggregate({
    where: { playerId },
    _sum: sum as never,
    _max: max as never,
  });
  const career = mergeAggregate(careerAgg, PLAYER_STAT_GROUPS);

  let latestValues: Record<string, number> | null = null;
  if (latest) {
    const agg = await db.gamePlayerStat.aggregate({
      where: { playerId, game: { seasonId: latest.seasonRoster.seasonId } },
      _sum: sum as never,
      _max: max as never,
    });
    latestValues = mergeAggregate(agg, PLAYER_STAT_GROUPS);
  }

  const recent = await db.gamePlayerStat.findMany({
    where: { playerId },
    include: { game: { include: { season: true } } },
  });
  const played = recent
    .filter((l) => hasAnyStat(l as unknown as Record<string, number>))
    .sort(
      (a, b) =>
        b.game.season.startYear - a.game.season.startYear ||
        (b.game.week ?? 0) - (a.game.week ?? 0),
    )
    .slice(0, 8);

  const height = formatHeight(player.heightInches);
  const out: string[] = [];
  out.push(`PLAYER FEATURE — ${player.name}`);
  out.push(
    `Position(s): ${positions.join(" / ") || "—"}` +
      (latest ? ` | Class: ${CLASS_LABELS[latest.class]}` : "") +
      (latest?.number != null ? ` | #${latest.number}` : ""),
  );
  out.push(
    `Bio: ${[height, player.weightLbs ? `${player.weightLbs} lbs` : null, player.hometown]
      .filter(Boolean)
      .join(", ") || "—"} | Status: ${PLAYER_STATUS_LABELS[player.status]}`,
  );
  if (player.bio) out.push(`Notes: ${player.bio}`);
  if (player.awards) out.push(`Awards: ${player.awards}`);
  if (player.notableEvents) out.push(`Notable: ${player.notableEvents}`);

  const statSummary = (v: Record<string, number>) => compactStatSummary(v);
  if (latestValues && latest) {
    out.push("");
    out.push(`Latest season (${latest.seasonRoster.season.name}) totals: ${statSummary(latestValues)}`);
  }
  out.push(`Career totals: ${statSummary(career)}`);

  if (played.length) {
    out.push("");
    out.push("Recent games:");
    for (const l of played) {
      const r = resultWord(l.game.teamPoints, l.game.oppPoints);
      out.push(
        `  ${l.game.season.name} Wk ${l.game.week ?? "—"} ${l.game.location === "AWAY" ? "@ " : "vs "}` +
          `${l.game.opponent} (${r} ${l.game.teamPoints}-${l.game.oppPoints}) — ` +
          lineToText(l as unknown as BoxLine),
      );
    }
  }
  return out.join("\n");
}

/** A season/team story's data: record and game-by-game results. */
export async function describeSeason(seasonId: number): Promise<string> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { games: { orderBy: [{ week: "asc" }, { date: "asc" }] } },
  });
  if (!season) throw new Error("Season not found.");

  let w = 0,
    l = 0,
    t = 0;
  for (const g of season.games) {
    if (g.teamPoints === 0 && g.oppPoints === 0) continue;
    if (g.teamPoints > g.oppPoints) w++;
    else if (g.teamPoints < g.oppPoints) l++;
    else t++;
  }

  const out: string[] = [];
  out.push(`TEAM / SEASON STORY — Caddo State, ${season.name}`);
  out.push(`Record: ${w}-${l}${t ? `-${t}` : ""}`);
  out.push("");
  out.push("Results:");
  for (const g of season.games) {
    const played = g.teamPoints !== 0 || g.oppPoints !== 0;
    const r = played ? resultWord(g.teamPoints, g.oppPoints) : "unplayed";
    out.push(
      `  Wk ${g.week ?? "—"} ${g.location === "AWAY" ? "@ " : "vs "}${g.opponent}: ` +
        (played ? `${r} ${g.teamPoints}-${g.oppPoints}` : "not yet played"),
    );
  }
  return out.join("\n");
}

/** A one-line "cmp/att, X pass yds, Y rush yds, ..." summary of an aggregate. */
export function compactStatSummary(v: Record<string, number>): string {
  const bits: [string, number][] = [
    ["pass yds", v.passYds],
    ["pass TD", v.passTd],
    ["INT", v.passInt],
    ["rush yds", v.rushYds],
    ["rush TD", v.rushTd],
    ["rec", v.rec],
    ["rec yds", v.recYds],
    ["rec TD", v.recTd],
    ["tackles", (v.tacklesSolo ?? 0) + (v.tacklesAst ?? 0)],
    ["sacks", v.sacks],
    ["def INT", v.defInt],
    ["FG", v.fgMade],
  ];
  const nonzero = bits.filter(([, n]) => n && n !== 0).map(([k, n]) => `${n} ${k}`);
  return nonzero.length ? nonzero.join(", ") : "no counting stats";
}
