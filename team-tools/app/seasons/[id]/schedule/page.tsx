import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/classes";
import { createGame, updateGame, deleteGame } from "./actions";
import { SeasonNav } from "@/components/season-nav";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function result(teamPoints: number, oppPoints: number): string | null {
  if (teamPoints === 0 && oppPoints === 0) return null;
  if (teamPoints > oppPoints) return "W";
  if (teamPoints < oppPoints) return "L";
  return "T";
}

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: {
      games: { orderBy: [{ week: "asc" }, { date: "asc" }, { id: "asc" }] },
    },
  });
  if (!season) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {season.name} Schedule
        </h1>
        <SeasonNav seasonId={seasonId} active="schedule" />
      </div>

      {season.games.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No games scheduled yet. Add one below.
        </p>
      ) : (
        <div className="space-y-2">
          {season.games.map((game) => {
            const r = result(game.teamPoints, game.oppPoints);
            return (
              <div
                key={game.id}
                className="flex flex-wrap items-end gap-2 rounded-md border p-2"
              >
                <form
                  action={updateGame}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="seasonId" value={seasonId} />
                  <input type="hidden" name="gameId" value={game.id} />
                  <Field label="Wk" className="w-14">
                    <Input name="week" type="number" defaultValue={game.week ?? ""} />
                  </Field>
                  <Field label="Date" className="w-40">
                    <Input name="date" type="date" defaultValue={toDateInput(game.date)} />
                  </Field>
                  <Field label="Opponent" className="w-48">
                    <Input name="opponent" defaultValue={game.opponent} required />
                  </Field>
                  <Field label="Where" className="w-28">
                    <select name="location" defaultValue={game.location} className={selectClass}>
                      {locationOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="CS" className="w-16">
                    <Input name="teamPoints" type="number" defaultValue={game.teamPoints} />
                  </Field>
                  <Field label="Opp" className="w-16">
                    <Input name="oppPoints" type="number" defaultValue={game.oppPoints} />
                  </Field>
                  {r && (
                    <Badge
                      variant={r === "W" ? "default" : "secondary"}
                      className="mb-1"
                    >
                      {r}
                    </Badge>
                  )}
                  <Button type="submit" variant="secondary" size="sm" className="mb-0.5">
                    Save
                  </Button>
                </form>
                <form action={deleteGame} className="ml-auto">
                  <input type="hidden" name="seasonId" value={seasonId} />
                  <input type="hidden" name="gameId" value={game.id} />
                  <ConfirmButton
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="mb-0.5"
                    message={`Delete the game vs ${game.opponent}?`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Add game</CardTitle>
          <CardDescription>
            Schedule an opponent now; fill in the score later to record the result.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createGame} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="seasonId" value={seasonId} />
            <Field label="Week" className="w-16">
              <Input name="week" type="number" placeholder="1" />
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
            <Button type="submit">Add game</Button>
          </form>
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
