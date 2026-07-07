import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import {
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
} from "@/lib/stat-fields";
import {
  formatHeight,
  headlineTiles,
  PLAYER_STATUS_LABELS,
  PLAYER_STATUS_OPTIONS,
} from "@/lib/player-profile";
import { updatePlayerProfile } from "./actions";
import { PlayerStats, type SeasonStat } from "@/components/player-stats";
import { NewsTeaser } from "@/components/media/news-teaser";
import { MediaTriggerFields } from "@/components/media/media-trigger-fields";
import { SaveForm } from "@/components/save-form";
import { ResultBadge } from "@/components/result-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId)) notFound();
  const isEdit = (await searchParams).mode === "edit";
  const basePath = `/players/${playerId}`;

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

  // Recent generated articles about this player.
  const news = await db.media.findMany({
    where: { playerId, status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, headline: true, viewed: true },
  });
  const personas = await db.authorPersona.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Games played = games with a non-zero stat line.
  const allLines = await db.gamePlayerStat.findMany({
    where: { playerId },
    include: { game: { include: { season: true } } },
  });
  const played = allLines
    .filter((l) => hasAnyStat(l as unknown as StatLine))
    .sort(
      (a, b) =>
        b.game.season.startYear - a.game.season.startYear ||
        (b.game.week ?? 0) - (a.game.week ?? 0),
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

  // Latest season drives the header's class/number and the summary tiles.
  const latestEntry = seasonEntries.at(-1);
  const latestSeason = seasons.at(-1);
  const latestClass = latestEntry ? CLASS_LABELS[latestEntry.class] : null;
  const latestNumber = latestEntry?.number ?? null;
  const tiles = latestSeason ? headlineTiles(latestSeason.values) : [];

  const height = formatHeight(player.heightInches);
  const htwt =
    [height, player.weightLbs ? `${player.weightLbs} lbs` : null]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/players"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Players
        </Link>
        {isEdit ? (
          <Link href={basePath} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Done
          </Link>
        ) : (
          <Link href={`${basePath}?mode=edit`} className={buttonVariants({ size: "sm" })}>
            Edit profile
          </Link>
        )}
      </div>

      {/* ESPN-style identity header */}
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="h-1 bg-primary" />
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
          {hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/players/${playerId}/photo?v=${player.updatedAt.getTime()}`}
              alt={player.name}
              className="h-28 w-28 shrink-0 rounded-md border object-cover"
            />
          )}
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
                {player.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {positions.length > 0 ? positions.join(" / ") : "—"}
                {latestClass ? ` · ${latestClass}` : ""}
                {latestNumber != null ? ` · #${latestNumber}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Info label="Class" value={latestClass ?? "—"} />
              <Info label="HT/WT" value={htwt} />
              <Info label="Hometown" value={player.hometown ?? "—"} />
              <Info
                label="Status"
                value={
                  player.status === "INJURED" && player.injuryDetails
                    ? `${PLAYER_STATUS_LABELS[player.status]} — ${player.injuryDetails}`
                    : PLAYER_STATUS_LABELS[player.status]
                }
              />
              <Info label="Notoriety · Season" value={String(latestEntry?.seasonNotoriety ?? 0)} />
              <Info label="Notoriety · Program" value={String(player.overallNotoriety)} />
            </div>
          </div>
          {tiles.length > 0 && latestSeason && (
            <div className="shrink-0 rounded-md border bg-secondary/40 p-3">
              <div className="eyebrow mb-2 text-center">
                {latestSeason.seasonName} Season
              </div>
              <div className="flex gap-5">
                {tiles.map((t) => (
                  <div key={t.label} className="text-center">
                    <div className="text-xl font-bold tabular-nums">{t.value}</div>
                    <div className="eyebrow">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isEdit && (
        <>
      {/* Career + season-by-season stat tables */}
      <PlayerStats career={careerValues} seasons={seasons} />

      {/* Recent games */}
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">
          Recent Games{" "}
          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
            ({played.length})
          </span>
        </h2>
        {played.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No games with recorded stats yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Season</TableHead>
                  <TableHead className="w-14">Wk</TableHead>
                  <TableHead>Opponent</TableHead>
                  <TableHead className="w-24">Result</TableHead>
                  <TableHead className="w-28 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {played.map((l) => {
                  const r = result(l.game.teamPoints, l.game.oppPoints);
                  const statsHref = `/seasons/${l.game.seasonId}/schedule/${l.gameId}/box-score/${playerId}`;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">
                        {l.game.season.name}
                      </TableCell>
                      <TableCell>{l.game.week ?? "—"}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link href={statsHref} className="hover:text-primary">
                          {l.game.location === "AWAY" ? "@ " : ""}
                          {l.game.opponent}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {r ? (
                          <ResultBadge
                            r={r}
                            score={`${l.game.teamPoints}-${l.game.oppPoints}`}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={statsHref}
                          className="text-sm text-muted-foreground hover:text-primary"
                        >
                          Game stats →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Latest news — player features generated from box scores */}
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">Latest News</h2>
        <NewsTeaser items={news} viewAllHref="/media" />
      </section>

      {/* Bio / awards / notable events (free text) */}
      {(player.bio || player.awards || player.notableEvents) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {player.bio && <InfoBlock title="Bio" text={player.bio} />}
          {player.awards && <InfoBlock title="Awards" text={player.awards} />}
          {player.notableEvents && (
            <InfoBlock title="Notable Events" text={player.notableEvents} />
          )}
        </div>
      )}
        </>
      )}

      {/* Edit profile */}
      {isEdit && (
      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
          <CardDescription>
            Header details, bio, and a PNG photo. None of this affects the roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm
            action={updatePlayerProfile}
            successText="Profile saved"
            className="space-y-4"
          >
            <input type="hidden" name="playerId" value={playerId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Height</Label>
                <div className="flex items-center gap-2">
                  <Input
                    name="heightFeet"
                    type="number"
                    min={0}
                    defaultValue={
                      player.heightInches != null
                        ? Math.floor(player.heightInches / 12)
                        : ""
                    }
                    className="h-8 w-20"
                    aria-label="Height feet"
                  />
                  <span className="text-sm text-muted-foreground">ft</span>
                  <Input
                    name="heightInch"
                    type="number"
                    min={0}
                    max={11}
                    defaultValue={
                      player.heightInches != null ? player.heightInches % 12 : ""
                    }
                    className="h-8 w-20"
                    aria-label="Height inches"
                  />
                  <span className="text-sm text-muted-foreground">in</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weightLbs">Weight (lbs)</Label>
                <Input
                  id="weightLbs"
                  name="weightLbs"
                  type="number"
                  min={0}
                  defaultValue={player.weightLbs ?? ""}
                  className="h-8 w-28"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hometown">Hometown</Label>
                <Input
                  id="hometown"
                  name="hometown"
                  defaultValue={player.hometown ?? ""}
                  placeholder="City, ST"
                  className="h-8"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={player.status}
                  className={selectClass}
                >
                  {PLAYER_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="injuryDetails">Injury details (when injured)</Label>
              <Input
                id="injuryDetails"
                name="injuryDetails"
                defaultValue={player.injuryDetails ?? ""}
                placeholder="e.g. High ankle sprain, out 3–4 weeks"
                className="h-8"
              />
            </div>

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

            <MediaTriggerFields
              personas={personas}
              label="Generate a player feature from this"
            />

            <Button type="submit">Save profile</Button>
          </SaveForm>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="text-sm font-medium">{value}</div>
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
