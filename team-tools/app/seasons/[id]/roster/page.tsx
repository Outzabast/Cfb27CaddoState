import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeasonNav } from "@/components/season-nav";
import { RosterTable, type RosterRow } from "@/components/roster-table";
import { RosterReadTable, type RosterReadRow } from "@/components/roster-read-table";
import { MultiPlayerForm } from "@/components/multi-player-form";
import { RosterImportMenu } from "@/components/ocr/roster-import";
import { FactGroup } from "@/components/media/fact-group";
import { factsForScope } from "@/lib/media/facts";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { roster: { include: { players: { include: { player: true } } } } },
  });
  if (!season) notFound();

  const isEdit = (await searchParams).mode === "edit";
  const players = season.roster?.players ?? [];
  const basePath = `/seasons/${seasonId}/roster`;
  const rosterFacts = isEdit ? await factsForScope("ROSTER", seasonId) : [];

  const editRows: RosterRow[] = players.map((sp) => ({
    seasonPlayerId: sp.id,
    playerId: sp.playerId,
    name: sp.player.name,
    position: sp.position,
    class: sp.class,
    number: sp.number,
    isStarter: sp.isStarter,
  }));

  const readRows: RosterReadRow[] = players.map((sp) => ({
    playerId: sp.playerId,
    name: sp.player.name,
    position: sp.position,
    class: sp.class,
    number: sp.number,
    heightInches: sp.player.heightInches,
    weightLbs: sp.player.weightLbs,
    hometown: sp.player.hometown,
  }));

  const existingNames = editRows.map((r) => r.name);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{season.name} Roster</h1>
          <SeasonNav seasonId={seasonId} active="roster" />
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <RosterImportMenu seasonId={seasonId} existingNames={existingNames} />
          )}
          {isEdit ? (
            <Link href={basePath} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Done
            </Link>
          ) : (
            <Link href={`${basePath}?mode=edit`} className={buttonVariants({ size: "sm" })}>
              Edit roster
            </Link>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No players on this roster yet.{" "}
          {isEdit ? (
            "Add some below."
          ) : (
            <Link href={`${basePath}?mode=edit`} className="font-medium text-primary hover:underline">
              Add some
            </Link>
          )}
        </p>
      ) : isEdit ? (
        <RosterTable seasonId={seasonId} rows={editRows} />
      ) : (
        <RosterReadTable rows={readRows} />
      )}

      {isEdit && (
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
      )}

      {isEdit && (
        <section className="max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold">Roster facts</h2>
          <p className="text-sm text-muted-foreground">
            Context about this roster the box score doesn&rsquo;t show — depth,
            position battles, a converted position, who&rsquo;s stepping up. Feeds
            media about {season.name}.
          </p>
          <FactGroup
            scope="ROSTER"
            title="Roster"
            blurb="This season's roster context — depth, injuries reshaping a unit, a freshman starting."
            facts={rosterFacts}
            seasonId={seasonId}
            revalidate={basePath}
          />
        </section>
      )}
    </div>
  );
}
