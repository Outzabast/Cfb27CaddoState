import Link from "next/link";
import { db } from "@/lib/db";
import { formatStatLine } from "@/lib/box-score";
import { PLAYER_STAT_GROUPS, PLAYER_PCTS } from "@/lib/stat-fields";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reassignStatLine, deleteStatLine, updateStatLine } from "./actions";

export const dynamic = "force-dynamic";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const latestSeasonPlayer = {
  take: 1,
  orderBy: { seasonRoster: { season: { startYear: "desc" as const } } },
} as const;

function result(t: number, o: number): string {
  if (t === 0 && o === 0) return "—";
  return `${t > o ? "W" : t < o ? "L" : "T"} ${t}-${o}`;
}

/** Build a querystring preserving the current filters plus overrides. */
function href(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/players/reconcile?${s}` : "/players/reconcile";
}

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pos?: string; season?: string; player?: string }>;
}) {
  const { q, pos, season, player } = await searchParams;
  const seasonId = season ? Number(season) : undefined;
  const playerId = player ? Number(player) : undefined;

  const [positionRows, seasons, allPlayers, matches] = await Promise.all([
    db.seasonPlayer.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } }),
    db.season.findMany({ orderBy: { startYear: "desc" } }),
    db.player.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, seasonPlayers: { ...latestSeasonPlayer, select: { position: true } } },
    }),
    db.player.findMany({
      where: {
        AND: [
          q ? { name: { contains: q, mode: "insensitive" as const } } : {},
          pos ? { seasonPlayers: { some: { position: pos } } } : {},
          seasonId ? { seasonPlayers: { some: { seasonRoster: { seasonId } } } } : {},
        ],
      },
      orderBy: { name: "asc" },
      take: 60,
      select: { id: true, name: true, seasonPlayers: { ...latestSeasonPlayer, select: { position: true } } },
    }),
  ]);

  const playerOptions = allPlayers.map((p) => ({
    id: p.id,
    label: `${p.name}${p.seasonPlayers[0]?.position ? ` (${p.seasonPlayers[0].position})` : ""}`,
  }));

  const selected = playerId
    ? await db.player.findUnique({ where: { id: playerId }, select: { id: true, name: true } })
    : null;

  const lines = selected
    ? await db.gamePlayerStat.findMany({
        where: { playerId: selected.id, ...(seasonId ? { game: { seasonId } } : {}) },
        include: { game: { include: { season: true } } },
        orderBy: [{ game: { season: { startYear: "desc" } } }, { game: { week: "desc" } }],
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/players" className="text-sm text-muted-foreground hover:text-foreground">
          ← Players
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reconcile stat lines</h1>
        <p className="text-sm text-muted-foreground">
          Find a player, review their game lines, and move any that OCR mis-attributed
          onto the right player.
        </p>
      </div>

      {/* Find a player */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        {player && <input type="hidden" name="player" value={player} />}
        <div className="grid gap-1">
          <Label htmlFor="q" className="text-xs text-muted-foreground">Name</Label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Search…" className="w-56" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pos" className="text-xs text-muted-foreground">Position</Label>
          <select id="pos" name="pos" defaultValue={pos ?? ""} className={selectClass}>
            <option value="">All</option>
            {positionRows.map((r) => (
              <option key={r.position} value={r.position}>{r.position}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="season" className="text-xs text-muted-foreground">Season</Label>
          <select id="season" name="season" defaultValue={season ?? ""} className={selectClass}>
            <option value="">All</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit">Search</Button>
        {(q || pos || season) && (
          <Link href={href({ player })} className={buttonVariants({ variant: "ghost" })}>Clear</Link>
        )}
      </form>

      {/* Matching players to pick */}
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players match those filters.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border bg-card">
          {matches.map((m) => {
            const isSel = m.id === playerId;
            return (
              <Link
                key={m.id}
                href={href({ q, pos, season, player: String(m.id) })}
                className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-0 hover:bg-accent ${
                  isSel ? "bg-accent font-semibold text-primary" : ""
                }`}
              >
                <span>{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.seasonPlayers[0]?.position ?? "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Selected player's stat lines */}
      {selected && (
        <section className="space-y-3 border-t pt-5">
          <h2 className="text-lg font-semibold">
            {selected.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {lines.length} stat line{lines.length === 1 ? "" : "s"}
              {seasonId ? " this season" : ""}
            </span>
          </h2>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stat lines{seasonId ? " for this season" : ""}.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => {
                const g = l.game;
                const line = formatStatLine(l as unknown as Record<string, number>);
                return (
                  <details key={l.id} open className="group rounded-md border bg-card">
                    <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-3">
                      <span className="text-sm font-medium">
                        {g.season.name} · Wk {g.week ?? "—"} · {g.location === "AWAY" ? "@ " : "vs "}
                        {g.opponent}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {line || "no stats"}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {result(g.teamPoints, g.oppPoints)}
                      </span>
                    </summary>

                    <div className="space-y-4 border-t p-3">
                      {/* Full editable stat set for this line */}
                      <SaveForm action={updateStatLine} successText="Stat line saved" className="space-y-4">
                        <input type="hidden" name="statId" value={l.id} />
                        <StatFieldGroups
                          groups={PLAYER_STAT_GROUPS}
                          values={l as unknown as Record<string, number>}
                          idPrefix={`recon-${l.id}`}
                          pcts={PLAYER_PCTS}
                        />
                        <Button type="submit" size="sm">Save stat line</Button>
                      </SaveForm>

                      {/* Reassign / delete the whole line */}
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <SaveForm
                          action={reassignStatLine}
                          successText="Stat line reassigned"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="statId" value={l.id} />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Move to
                          </span>
                          <select name="targetPlayerId" defaultValue="" className={selectClass} required>
                            <option value="" disabled>Pick player…</option>
                            {playerOptions
                              .filter((o) => o.id !== selected.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))}
                          </select>
                          <Button type="submit" size="sm" variant="secondary">Move</Button>
                        </SaveForm>

                        <SaveForm action={deleteStatLine} successText="Stat line deleted">
                          <input type="hidden" name="statId" value={l.id} />
                          <ConfirmSubmit
                            message="Delete this stat line entirely?"
                            className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                          >
                            Delete
                          </ConfirmSubmit>
                        </SaveForm>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
