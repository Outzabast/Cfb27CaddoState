import Link from "next/link";
import { db } from "@/lib/db";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerList } from "@/components/player-list";
import { countPlayers, fetchPlayersPage, DEFAULT_SORT } from "@/lib/players-query";

export const dynamic = "force-dynamic";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pos?: string; season?: string; active?: string }>;
}) {
  const { q, pos, season, active } = await searchParams;
  const filters = { q, pos, season, active };

  // Positions/seasons for the filter dropdowns; the list itself is paginated.
  const [positionRows, seasons, total, firstPage] = await Promise.all([
    db.seasonPlayer.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } }),
    db.season.findMany({ orderBy: { startYear: "desc" } }),
    countPlayers(filters),
    fetchPlayersPage(filters, DEFAULT_SORT, 0),
  ]);
  const allPositions = positionRows.map((r) => r.position);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
          <p className="text-sm text-muted-foreground">
            Filter, then click a column to sort or pick which columns show. Open a
            player for season & career stats.
          </p>
        </div>
        <Link
          href="/players/reconcile"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Reconcile stat lines
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="q" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Search…" className="w-56" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pos" className="text-xs text-muted-foreground">
            Position
          </Label>
          <select id="pos" name="pos" defaultValue={pos ?? ""} className={selectClass}>
            <option value="">All</option>
            {allPositions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="season" className="text-xs text-muted-foreground">
            Season
          </Label>
          <select id="season" name="season" defaultValue={season ?? ""} className={selectClass}>
            <option value="">All</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="active" className="text-xs text-muted-foreground">
            Status
          </Label>
          <select id="active" name="active" defaultValue={active ?? ""} className={selectClass}>
            <option value="">Active only</option>
            <option value="0">All (incl. graduated/transferred)</option>
          </select>
        </div>
        <Button type="submit">Filter</Button>
        {(q || pos || season || active) && (
          <Link
            href="/players"
            className={buttonVariants({ variant: "ghost", size: "default" })}
          >
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {total} player{total === 1 ? "" : "s"}
        {(q || pos || season || active) ? " match" : ""}
      </p>

      <PlayerList
        filters={filters}
        initialItems={firstPage.items}
        initialOffset={firstPage.nextOffset}
        initialSort={DEFAULT_SORT}
      />
    </div>
  );
}
