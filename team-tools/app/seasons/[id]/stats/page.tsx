import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  TEAM_STAT_GROUPS,
  TEAM_PCTS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import { SeasonNav } from "@/components/season-nav";
import { StatDisplay } from "@/components/stat-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({ where: { id: seasonId } });
  if (!season) notFound();

  // Team totals = SUM of per-game team stats for this season.
  const { sum } = aggregateSelect(TEAM_STAT_GROUPS);
  const agg = await db.gameTeamStat.aggregate({
    where: { game: { seasonId } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sum: sum as any,
  });
  const values = mergeAggregate(agg, TEAM_STAT_GROUPS);

  // Record + points from the scoreboard (count only games that have been played).
  const games = await db.game.findMany({
    where: { seasonId },
    select: { teamPoints: true, oppPoints: true },
  });
  let wins = 0,
    losses = 0,
    ties = 0,
    pointsFor = 0,
    pointsAgainst = 0;
  for (const g of games) {
    pointsFor += g.teamPoints;
    pointsAgainst += g.oppPoints;
    if (g.teamPoints === 0 && g.oppPoints === 0) continue; // unplayed
    if (g.teamPoints > g.oppPoints) wins++;
    else if (g.teamPoints < g.oppPoints) losses++;
    else ties++;
  }
  const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {season.name} Team Stats
        </h1>
        <SeasonNav seasonId={seasonId} active="stats" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Record" value={record} />
        <StatTile label="Points For" value={pointsFor} />
        <StatTile label="Points Against" value={pointsAgainst} />
      </div>

      <StatDisplay groups={TEAM_STAT_GROUPS} values={values} pcts={TEAM_PCTS} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
