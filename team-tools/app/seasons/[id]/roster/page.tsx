import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeasonNav } from "@/components/season-nav";
import { RosterTable, type RosterRow } from "@/components/roster-table";
import { MultiPlayerForm } from "@/components/multi-player-form";
import { RosterImportMenu } from "@/components/ocr/roster-import";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { roster: { include: { players: { include: { player: true } } } } },
  });
  if (!season) notFound();

  const rows: RosterRow[] = (season.roster?.players ?? []).map((sp) => ({
    seasonPlayerId: sp.id,
    playerId: sp.playerId,
    name: sp.player.name,
    position: sp.position,
    class: sp.class,
    number: sp.number,
  }));

  const existingNames = rows.map((r) => r.name);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{season.name} Roster</h1>
          <SeasonNav seasonId={seasonId} active="roster" />
        </div>
        <RosterImportMenu seasonId={seasonId} existingNames={existingNames} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No players on this roster yet. Add some below.
        </p>
      ) : (
        <RosterTable seasonId={seasonId} rows={rows} />
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Add players</CardTitle>
          <CardDescription>
            Add one or several at once — use “+ Add row” for more. Creates new
            players on the {season.name} roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiPlayerForm seasonId={seasonId} />
        </CardContent>
      </Card>
    </div>
  );
}
