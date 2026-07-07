import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import {
  seasonTeamSections,
  type TeamSeasonTotals,
} from "@/lib/season-stats";
import { computeRecord, formatRecord } from "@/lib/season-record";
import type { BoxLine } from "@/lib/box-score";
import { SeasonNav } from "@/components/season-nav";
import { SeasonPicker } from "@/components/season-stats/season-picker";
import { PlayersTab } from "@/components/season-stats/players-tab";
import { TeamTab } from "@/components/season-stats/team-tab";
import { cn } from "@/lib/utils";

export default async function TeamStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const tab = (await searchParams).tab === "team" ? "team" : "players";

  const [season, seasons] = await Promise.all([
    db.season.findUnique({ where: { id: seasonId } }),
    db.season.findMany({
      orderBy: { startYear: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!season) notFound();

  // --- Per-player season aggregates -> BoxLine rows (SUM counting, MAX longs) ---
  const { sum: pSum, max: pMax } = aggregateSelect(PLAYER_STAT_GROUPS);
  const grouped = await db.gamePlayerStat.groupBy({
    by: ["playerId"],
    where: { game: { seasonId } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sum: pSum as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _max: pMax as any,
  });
  const playerIds = grouped.map((g) => g.playerId);
  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    select: { playerId: true, playerName: true, number: true },
  });
  const nameById = new Map(roster.map((r) => [r.playerId, r.playerName]));
  const numberById = new Map(roster.map((r) => [r.playerId, r.number]));
  // Fall back to the stable Player.name for anyone with stats but off the roster.
  const missing = playerIds.filter((id) => !nameById.has(id));
  if (missing.length > 0) {
    const players = await db.player.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true },
    });
    for (const p of players) nameById.set(p.id, p.name);
  }

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

  // --- Season team totals + OPPONENT totals (SUM of per-game rows) ---
  const { sum: tSum } = aggregateSelect(TEAM_STAT_GROUPS);
  const [teamAgg, oppAgg, oppCount] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.gameTeamStat.aggregate({ where: { game: { seasonId } }, _sum: tSum as any }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.gameOppStat.aggregate({ where: { game: { seasonId } }, _sum: tSum as any }),
    db.gameOppStat.count({ where: { game: { seasonId } } }),
  ]);
  const teamTotals = mergeAggregate(teamAgg, TEAM_STAT_GROUPS) as unknown as TeamSeasonTotals;
  const oppTotals = mergeAggregate(oppAgg, TEAM_STAT_GROUPS) as unknown as TeamSeasonTotals;
  const hasOpp = oppCount > 0;

  // --- Record (overall + conference) from the scoreboard ---
  const games = await db.game.findMany({
    where: { seasonId },
    select: { teamPoints: true, oppPoints: true, isConference: true },
  });
  const rec = computeRecord(games);
  const gamesPlayed = rec.gamesPlayed;

  const sections = seasonTeamSections(
    teamTotals,
    lines,
    { gamesPlayed, pointsFor: rec.pointsFor, pointsAgainst: rec.pointsAgainst },
    hasOpp ? oppTotals : null,
  );

  // Headline stat cards: record, our per-game passing/rushing, per-game passing/
  // rushing given up, and our defensive sacks + interceptions.
  const per = (v: number) => (gamesPlayed > 0 ? (v / gamesPlayed).toFixed(1) : "0.0");
  const defInt = lines.reduce((a, l) => a + l.defInt, 0);
  const headline: { label: string; value: string | number }[] = [
    { label: "Record", value: formatRecord(rec) },
    { label: "Pass Yds / G", value: per(teamTotals.passYds) },
    { label: "Rush Yds / G", value: per(teamTotals.rushYds) },
    { label: "Pass Yds Allowed / G", value: hasOpp ? per(oppTotals.passYds) : "—" },
    { label: "Rush Yds Allowed / G", value: hasOpp ? per(oppTotals.rushYds) : "—" },
    {
      label: "Sacks",
      value: Number.isInteger(teamTotals.sacks) ? teamTotals.sacks : teamTotals.sacks.toFixed(1),
    },
    { label: "Interceptions", value: defInt },
  ];

  const subTabs = [
    { key: "players", label: "Players", href: `/seasons/${seasonId}/stats` },
    { key: "team", label: "Team", href: `/seasons/${seasonId}/stats?tab=team` },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {season.name} Team Stats
          </h1>
          <SeasonPicker seasonId={seasonId} tab={tab} seasons={seasons} />
        </div>
        <SeasonNav seasonId={seasonId} active="stats" />
      </div>

      {/* Headline stat cards — visible on both tabs. Record shows overall (conf). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {headline.map((h) => (
          <StatTile key={h.label} label={h.label} value={h.value} />
        ))}
      </div>

      {/* Players / Team sub-tabs */}
      <div>
        <nav className="flex gap-1 border-b text-xs font-bold uppercase tracking-wide">
          {subTabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 border-transparent px-3 pb-2 text-muted-foreground transition-colors hover:text-foreground",
                tab === t.key
                  ? "border-[var(--brand-gold)] text-foreground"
                  : "hover:border-[var(--brand-gold)]",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "team" ? <TeamTab sections={sections} /> : <PlayersTab lines={lines} />}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
