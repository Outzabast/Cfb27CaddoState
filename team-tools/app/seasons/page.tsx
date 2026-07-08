import Link from "next/link";
import { db } from "@/lib/db";
import { createSeason, deleteSeason, advanceSeason, setSentimentBaseline } from "./actions";
import { deriveBaseline, sentimentBand, type SentimentBand } from "@/lib/sentiment";
import { ConfirmButton } from "@/components/confirm-button";
import { SaveForm } from "@/components/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

export const dynamic = "force-dynamic";

type Scored = { teamPoints: number; oppPoints: number };
function record(games: Scored[]): string {
  let w = 0, l = 0, t = 0;
  for (const g of games) {
    if (g.teamPoints === 0 && g.oppPoints === 0) continue;
    if (g.teamPoints > g.oppPoints) w++;
    else if (g.teamPoints < g.oppPoints) l++;
    else t++;
  }
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

const BAND_TONE: Record<SentimentBand["tone"], string> = {
  bad: "bg-red-100 text-red-800",
  low: "bg-amber-100 text-amber-800",
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-800",
  great: "bg-emerald-200 text-emerald-900",
};

function SentimentBadge({ value }: { value: number }) {
  const band = sentimentBand(value);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold", BAND_TONE[band.tone])}>
      {band.label}
      <span className="tabular-nums opacity-70">{value}</span>
    </span>
  );
}

export default async function SeasonsHistoryPage() {
  const seasons = await db.season.findMany({
    orderBy: { startYear: "desc" },
    include: {
      _count: { select: { games: true } },
      roster: { include: { _count: { select: { players: true } } } },
      games: { select: { teamPoints: true, oppPoints: true } },
    },
  });

  const current = seasons[0];
  const past = seasons.slice(1);
  // The auto-derived baseline for the current season (shown as the override hint).
  const currentDerived = current ? await deriveBaseline(current.id) : 50;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seasons</h1>
        <p className="text-sm text-muted-foreground">
          The current season is up top; past seasons are the program&rsquo;s history.
        </p>
      </div>

      {current && (
        <Card>
          <div className="h-1 bg-primary" />
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl">{current.name}</CardTitle>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">
                  Current
                </span>
              </div>
              <SaveForm action={advanceSeason} loadingText="Advancing…" successText="Season advanced">
                <input type="hidden" name="fromSeasonId" value={current.id} />
                <ConfirmButton
                  type="submit"
                  size="sm"
                  message={`Start the season after ${current.name}? Every player advances a class, seniors graduate, and the rest carry over.`}
                >
                  Advance from {current.name}
                </ConfirmButton>
              </SaveForm>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Stat label="Record" value={record(current.games)} />
              <div>
                <div className="eyebrow mb-1">Fan Sentiment</div>
                <SentimentBadge value={current.fanSentiment} />
              </div>
              <Stat label="Players" value={current.roster?._count.players ?? 0} />
              <Stat label="Games" value={current._count.games} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/seasons/${current.id}`} className={buttonVariants({ size: "sm" })}>Season home</Link>
              <Link href={`/seasons/${current.id}/roster`} className={buttonVariants({ variant: "outline", size: "sm" })}>Roster</Link>
              <Link href={`/seasons/${current.id}/schedule`} className={buttonVariants({ variant: "outline", size: "sm" })}>Schedule</Link>
              <Link href={`/seasons/${current.id}/stats`} className={buttonVariants({ variant: "outline", size: "sm" })}>Team Stats</Link>
              <Link href={`/seasons/${current.id}/media`} className={buttonVariants({ variant: "outline", size: "sm" })}>Media</Link>
            </div>

            {/* Fan-sentiment baseline override */}
            <SaveForm
              action={setSentimentBaseline}
              successText="Baseline saved"
              className="flex flex-wrap items-end gap-3 border-t pt-4"
            >
              <input type="hidden" name="seasonId" value={current.id} />
              <div className="grid gap-1">
                <Label htmlFor="baseline" className="text-xs text-muted-foreground">
                  Preseason expectation (0–100)
                </Label>
                <Input
                  id="baseline"
                  name="baseline"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={current.sentimentBaselineOverride ?? ""}
                  placeholder={`auto: ${currentDerived}`}
                  className="w-32"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">Save baseline</Button>
              <p className="text-xs text-muted-foreground">
                Blank auto-derives from recent seasons. Sentiment moves from here as the team beats or misses it.
              </p>
            </SaveForm>
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="eyebrow !text-foreground">Past seasons</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Fan Sentiment</TableHead>
                <TableHead className="text-right">Players</TableHead>
                <TableHead className="text-right">Games</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {past.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/seasons/${s.id}`} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{record(s.games)}</TableCell>
                  <TableCell><SentimentBadge value={s.fanSentiment} /></TableCell>
                  <TableCell className="text-right">{s.roster?._count.players ?? 0}</TableCell>
                  <TableCell className="text-right">{s._count.games}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/seasons/${s.id}/roster`} className={buttonVariants({ variant: "outline", size: "sm" })}>Roster</Link>
                      <Link href={`/seasons/${s.id}/schedule`} className={buttonVariants({ variant: "outline", size: "sm" })}>Schedule</Link>
                      <SaveForm action={deleteSeason} successText={`${s.name} deleted`}>
                        <input type="hidden" name="seasonId" value={s.id} />
                        <ConfirmButton
                          type="submit"
                          variant="ghost"
                          size="sm"
                          message={`Delete ${s.name}? This removes its roster and schedule too.`}
                        >
                          Delete
                        </ConfirmButton>
                      </SaveForm>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {seasons.length === 0 && (
        <p className="text-sm text-muted-foreground">No seasons yet. Create the first one below.</p>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>New season</CardTitle>
          <CardDescription>
            Add a season manually. After the first one, use &ldquo;Advance&rdquo; to roll the
            roster forward automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm action={createSeason} successText="Season created" className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="2026-2027" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conference">Conference</Label>
              <Input id="conference" name="conference" placeholder="Sun Belt" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startYear">Start year</Label>
              <Input id="startYear" name="startYear" type="number" placeholder="2026" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endYear">End year</Label>
              <Input id="endYear" name="endYear" type="number" placeholder="2027" required />
            </div>
            <div className="flex items-end">
              <Button type="submit">Create season</Button>
            </div>
          </SaveForm>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
