import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import {
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import { updatePlayerProfile } from "./actions";
import { PlayerStats, type SeasonStat } from "@/components/player-stats";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STAT_FIELDS = PLAYER_STAT_GROUPS.flatMap((g) => g.fields);
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

type StatLine = Record<string, number>;
function hasAnyStat(line: StatLine): boolean {
  return STAT_FIELDS.some((f) => Number(line[f.name]) !== 0);
}
function result(t: number, o: number): "W" | "L" | "T" | null {
  if (t === 0 && o === 0) return null;
  return t > o ? "W" : t < o ? "L" : "T";
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId)) notFound();

  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      seasonPlayers: { include: { seasonRoster: { include: { season: true } } } },
    },
    omit: { photo: true },
  });
  if (!player) notFound();

  const [{ has: hasPhoto }] = await db.$queryRaw<{ has: boolean }[]>`
    SELECT photo IS NOT NULL AS has FROM players WHERE id = ${playerId}`;

  // Games played = games with a non-zero stat line.
  const allLines = await db.gamePlayerStat.findMany({
    where: { playerId },
    include: { game: { include: { season: true } } },
  });
  const played = allLines
    .filter((l) => hasAnyStat(l as unknown as StatLine))
    .sort(
      (a, b) =>
        a.game.season.startYear - b.game.season.startYear ||
        (a.game.week ?? 0) - (b.game.week ?? 0),
    );

  // Aggregates for the stat tables.
  const { sum, max } = aggregateSelect(PLAYER_STAT_GROUPS);
  const seasonEntries = [...player.seasonPlayers].sort(
    (a, b) => a.seasonRoster.season.startYear - b.seasonRoster.season.startYear,
  );
  const seasons: SeasonStat[] = await Promise.all(
    seasonEntries.map(async (sp) => {
      const agg = await db.gamePlayerStat.aggregate({
        where: { playerId, game: { seasonId: sp.seasonRoster.seasonId } },
        _sum: sum as never,
        _max: max as never,
      });
      return {
        seasonId: sp.seasonRoster.seasonId,
        seasonName: sp.seasonRoster.season.name,
        startYear: sp.seasonRoster.season.startYear,
        position: sp.position,
        className: CLASS_LABELS[sp.class],
        number: sp.number,
        values: mergeAggregate(agg, PLAYER_STAT_GROUPS),
      };
    }),
  );
  const careerAgg = await db.gamePlayerStat.aggregate({
    where: { playerId },
    _sum: sum as never,
    _max: max as never,
  });
  const careerValues = mergeAggregate(careerAgg, PLAYER_STAT_GROUPS);

  const positions = [...new Set(seasonEntries.map((sp) => sp.position))];
  const seasonNames = seasonEntries.map((sp) => sp.seasonRoster.season.name).join(", ");

  return (
    <div className="space-y-8">
      <Link
        href="/players"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Players
      </Link>

      {/* Identity header */}
      <div className="flex items-center gap-5">
        {hasPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/players/${playerId}/photo?v=${player.updatedAt.getTime()}`}
            alt={player.name}
            className="h-28 w-28 rounded-md border object-cover"
          />
        )}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{player.name}</h1>
          <p className="text-muted-foreground">
            {positions.length > 0 ? positions.join(" / ") : "—"}
            {seasonNames && (
              <>
                {" · "}
                {seasonNames}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Profile info (only when present) */}
      {(player.bio || player.awards || player.notableEvents) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {player.bio && <InfoBlock title="Bio" text={player.bio} />}
          {player.awards && <InfoBlock title="Awards" text={player.awards} />}
          {player.notableEvents && (
            <InfoBlock title="Notable Events" text={player.notableEvents} />
          )}
        </div>
      )}

      {/* Career + season-by-season stat tables */}
      <PlayerStats career={careerValues} seasons={seasons} />

      {/* Games played */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Games played{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({played.length})
          </span>
        </h2>
        {played.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No games with recorded stats yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead className="w-14">Wk</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead className="w-24">Result</TableHead>
                <TableHead className="text-right">Line</TableHead>
                <TableHead className="w-24 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {played.map((l) => {
                const r = result(l.game.teamPoints, l.game.oppPoints);
                const bits = [
                  l.passAtt ? `${l.passCmp}/${l.passAtt} ${l.passYds}pass` : "",
                  l.rushAtt ? `${l.rushAtt}-${l.rushYds}rush` : "",
                  l.rec ? `${l.rec}-${l.recYds}rec` : "",
                  l.tacklesSolo + l.tacklesAst ? `${l.tacklesSolo + l.tacklesAst}tkl` : "",
                  l.sacks ? `${l.sacks}sk` : "",
                ].filter(Boolean);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.game.season.name}</TableCell>
                    <TableCell>{l.game.week ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {l.game.location === "AWAY" ? "@ " : ""}
                      {l.game.opponent}
                    </TableCell>
                    <TableCell>
                      {r ? `${r} ${l.game.teamPoints}-${l.game.oppPoints}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {bits.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/seasons/${l.game.seasonId}/schedule/${l.gameId}/box-score`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Box score
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit profile */}
      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
          <CardDescription>
            Bio, awards, notable events, and a PNG photo. None of this affects the
            roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm
            action={updatePlayerProfile}
            successText="Profile saved"
            encType="multipart/form-data"
            className="space-y-4"
          >
            <input type="hidden" name="playerId" value={playerId} />
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea id="bio" name="bio" defaultValue={player.bio ?? ""} className={textareaClass} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="awards">Awards</Label>
              <textarea id="awards" name="awards" defaultValue={player.awards ?? ""} className={textareaClass} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notableEvents">Notable events</Label>
              <textarea
                id="notableEvents"
                name="notableEvents"
                defaultValue={player.notableEvents ?? ""}
                className={textareaClass}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="photo">Photo (PNG)</Label>
              <input id="photo" name="photo" type="file" accept="image/png" className="text-sm" />
              {hasPhoto && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="removePhoto" /> Remove current photo
                </label>
              )}
            </div>
            <Button type="submit">Save profile</Button>
          </SaveForm>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
