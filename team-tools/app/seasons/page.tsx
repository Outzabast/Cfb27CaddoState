import Link from "next/link";
import { db } from "@/lib/db";
import { createSeason, deleteSeason, advanceSeason } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { SaveForm } from "@/components/save-form";
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

export default async function SeasonsPage() {
  const seasons = await db.season.findMany({
    orderBy: { startYear: "desc" },
    include: {
      _count: { select: { games: true } },
      roster: { include: { _count: { select: { players: true } } } },
    },
  });

  const latest = seasons[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seasons</h1>
          <p className="text-sm text-muted-foreground">
            Each season has its own roster and schedule.
          </p>
        </div>
        {latest && (
          <SaveForm
            action={advanceSeason}
            loadingText="Advancing season…"
            successText="Season advanced"
          >
            <input type="hidden" name="fromSeasonId" value={latest.id} />
            <ConfirmButton
              type="submit"
              message={`Start the season after ${latest.name}? Every player advances a class, seniors graduate, and the rest carry over to the new roster.`}
            >
              Advance from {latest.name}
            </ConfirmButton>
          </SaveForm>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No seasons yet. Create the first one below.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead className="text-right">Players</TableHead>
              <TableHead className="text-right">Games</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right">{s.roster?._count.players ?? 0}</TableCell>
                <TableCell className="text-right">{s._count.games}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/seasons/${s.id}/roster`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Roster
                    </Link>
                    <Link
                      href={`/seasons/${s.id}/schedule`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Schedule
                    </Link>
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
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>New season</CardTitle>
          <CardDescription>
            Add a season manually. After the first one, use “Advance” to roll the
            roster forward automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaveForm
            action={createSeason}
            successText="Season created"
            className="grid gap-4 sm:grid-cols-3"
          >
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="2026-2027" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startYear">Start year</Label>
              <Input
                id="startYear"
                name="startYear"
                type="number"
                placeholder="2026"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endYear">End year</Label>
              <Input
                id="endYear"
                name="endYear"
                type="number"
                placeholder="2027"
                required
              />
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
