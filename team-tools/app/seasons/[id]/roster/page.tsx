import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import {
  addPlayerToRoster,
  updateRosterEntry,
  removeFromRoster,
} from "./actions";
import { SeasonNav } from "@/components/season-nav";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ConfirmButton } from "@/components/confirm-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { rosterEntries: { include: { player: true } } },
  });
  if (!season) notFound();

  const roster = [...season.rosterEntries].sort(
    (a, b) =>
      a.player.position.localeCompare(b.player.position) ||
      (a.number ?? 999) - (b.number ?? 999) ||
      a.player.name.localeCompare(b.player.name),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{season.name} Roster</h1>
        <SeasonNav seasonId={seasonId} active="roster" />
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No players on this roster yet. Add one below.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Position</TableHead>
              <TableHead className="w-56">Class</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell colSpan={4} className="p-0">
                  <form
                    action={updateRosterEntry}
                    className="flex items-center gap-2 px-2 py-1"
                    id={`row-${entry.id}`}
                  >
                    <input type="hidden" name="seasonId" value={seasonId} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="playerId" value={entry.playerId} />
                    <Input
                      name="number"
                      type="number"
                      defaultValue={entry.number ?? ""}
                      placeholder="#"
                      className="w-16"
                      aria-label="Jersey number"
                    />
                    <span className="min-w-40 flex-1 font-medium">
                      {entry.player.name}
                    </span>
                    <Input
                      name="position"
                      defaultValue={entry.player.position}
                      maxLength={8}
                      className="w-24"
                      aria-label="Position"
                    />
                    <AutoSubmitSelect
                      name="class"
                      defaultValue={entry.player.class}
                      options={classOptions}
                      aria-label="Class"
                      className="w-52"
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      Save
                    </Button>
                  </form>
                </TableCell>
                <TableCell className="text-right align-middle">
                  <form action={removeFromRoster}>
                    <input type="hidden" name="seasonId" value={seasonId} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <ConfirmButton
                      type="submit"
                      variant="ghost"
                      size="sm"
                      message={`Remove ${entry.player.name} from the ${season.name} roster?`}
                    >
                      Remove
                    </ConfirmButton>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Add player</CardTitle>
          <CardDescription>
            Creates a new player and adds them to the {season.name} roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={addPlayerToRoster}
            className="grid gap-4 sm:grid-cols-[1fr_6rem_7rem_auto]"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Bryce Joiner" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="number">Number</Label>
              <Input id="number" name="number" type="number" placeholder="7" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">Position</Label>
              <Input id="position" name="position" maxLength={8} placeholder="QB" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class">Class</Label>
              <select
                id="class"
                name="class"
                defaultValue="FRESHMAN"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {classOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">Add to roster</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
