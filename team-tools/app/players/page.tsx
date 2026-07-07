import Link from "next/link";
import { db } from "@/lib/db";
import { CLASS_LABELS } from "@/lib/classes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pos?: string; season?: string }>;
}) {
  const { q, pos, season } = await searchParams;
  const seasonId = season ? Number(season) : undefined;

  const [players, seasons] = await Promise.all([
    db.player.findMany({
      orderBy: { name: "asc" },
      include: {
        seasonPlayers: {
          include: { seasonRoster: { include: { season: true } } },
        },
      },
    }),
    db.season.findMany({ orderBy: { startYear: "desc" } }),
  ]);

  const allPositions = Array.from(
    new Set(players.flatMap((p) => p.seasonPlayers.map((sp) => sp.position))),
  ).sort();

  const filtered = players.filter((p) => {
    const nameOk = !q || p.name.toLowerCase().includes(q.toLowerCase());
    const posOk = !pos || p.seasonPlayers.some((sp) => sp.position === pos);
    const seasonOk =
      !seasonId || p.seasonPlayers.some((sp) => sp.seasonRoster.seasonId === seasonId);
    return nameOk && posOk && seasonOk;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted-foreground">
          Filter by name, position, or season, then open a player for season &
          career stats.
        </p>
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
        <Button type="submit">Filter</Button>
        {(q || pos || season) && (
          <Link
            href="/players"
            className={buttonVariants({ variant: "ghost", size: "default" })}
          >
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {players.length} players
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players match.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {filtered.map((p) => {
            const spSorted = [...p.seasonPlayers].sort(
              (a, b) => a.seasonRoster.season.startYear - b.seasonRoster.season.startYear,
            );
            const latest = spSorted[spSorted.length - 1];
            const seasonNames = spSorted.map((sp) => sp.seasonRoster.season.name).join(", ");
            return (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {latest
                      ? `${latest.position} · ${CLASS_LABELS[latest.class]} · ${seasonNames}`
                      : "no seasons"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
