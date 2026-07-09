import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/classes";
import { createGame } from "./actions";
import { setSeasonConference } from "@/app/seasons/actions";
import { SaveForm } from "@/components/save-form";
import { SeasonNav } from "@/components/season-nav";
import { ScheduleTable, type GameRow } from "@/components/schedule-table";
import { ScheduleImportMenu } from "@/components/ocr/schedule-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const locationOptions = LOCATION_ORDER.map((l) => ({
  value: l,
  label: LOCATION_LABELS[l],
}));

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { games: true },
  });
  if (!season) notFound();

  const games: GameRow[] = season.games.map((g) => ({
    id: g.id,
    week: g.week,
    date: toDateInput(g.date),
    opponent: g.opponent,
    location: g.location,
    teamPoints: g.teamPoints,
    oppPoints: g.oppPoints,
    isConference: g.isConference,
    note: g.note,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {season.name} Schedule
          </h1>
          <SeasonNav seasonId={seasonId} active="schedule" />
          <SaveForm
            action={setSeasonConference}
            successText="Conference saved"
            className="mt-3 flex items-center gap-2"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <Label htmlFor="conference" className="text-xs text-muted-foreground">
              Conference
            </Label>
            <Input
              id="conference"
              name="conference"
              defaultValue={season.conference ?? ""}
              placeholder="e.g. Sun Belt"
              className="h-8 w-48"
            />
            <Button type="submit" size="sm" variant="secondary">
              Save
            </Button>
          </SaveForm>
        </div>
        <ScheduleImportMenu
          seasonId={seasonId}
          existingWeeks={games.map((g) => g.week).filter((w): w is number => w != null)}
          existingOpponents={games.map((g) => g.opponent)}
        />
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No games scheduled yet. Add one below.
        </p>
      ) : (
        <ScheduleTable seasonId={seasonId} games={games} />
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Add game</CardTitle>
          <CardDescription>
            Schedule an opponent now; fill in the score later to record the result.
            Weeks 0–20 are valid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm
            action={createGame}
            successText="Game added"
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <Field label="Week" className="w-20">
              <Input name="week" type="number" min={0} max={20} placeholder="1" />
            </Field>
            <Field label="Date" className="w-40">
              <Input name="date" type="date" />
            </Field>
            <Field label="Opponent" className="w-52">
              <Input name="opponent" placeholder="UTEP" required />
            </Field>
            <Field label="Where" className="w-28">
              <select name="location" defaultValue="HOME" className={selectClass}>
                {locationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-muted-foreground">
              <input type="checkbox" name="isConference" />
              Conference
            </label>
            <Field label="Note (optional)" className="w-64">
              <Input name="note" placeholder="e.g. CUSA title game, bowl game" />
            </Field>
            <Button type="submit">Add game</Button>
          </SaveForm>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
