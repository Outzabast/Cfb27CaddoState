import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toBoxLine, StatCategoryTables } from "@/components/box-score/stat-category-tables";
import { ResultBadge } from "@/components/result-badge";

function result(t: number, o: number): "W" | "L" | "T" | null {
  if (t === 0 && o === 0) return null;
  return t > o ? "W" : t < o ? "L" : "T";
}

export default async function PlayerGameStatsPage({
  params,
}: {
  params: Promise<{ id: string; gameId: string; playerId: string }>;
}) {
  const { id, gameId, playerId } = await params;
  const seasonId = Number(id);
  const gid = Number(gameId);
  const pid = Number(playerId);
  if (![seasonId, gid, pid].every(Number.isInteger)) notFound();

  const game = await db.game.findUnique({
    where: { id: gid },
    include: { season: true },
  });
  if (!game || game.seasonId !== seasonId) notFound();

  const [stat, player, sp] = await Promise.all([
    db.gamePlayerStat.findUnique({
      where: { gameId_playerId: { gameId: gid, playerId: pid } },
    }),
    db.player.findUnique({ where: { id: pid }, select: { name: true } }),
    db.seasonPlayer.findFirst({
      where: { playerId: pid, seasonRoster: { seasonId } },
      select: { position: true, number: true },
    }),
  ]);
  if (!player) notFound();

  const r = result(game.teamPoints, game.oppPoints);
  const boxHref = `/seasons/${seasonId}/schedule/${gid}/box-score`;

  return (
    <div className="space-y-8">
      <div>
        <Link href={boxHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← Box score
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-tight text-primary">
            <Link href={`/players/${pid}`} className="hover:underline">
              {player.name}
            </Link>
          </h1>
          <span className="text-sm text-muted-foreground">
            {[sp?.position, sp?.number != null ? `#${sp.number}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {game.season.name} · {game.week != null ? `Week ${game.week} · ` : ""}
            {game.location === "AWAY" ? "@ " : "vs "}
            {game.opponent}
          </span>
          {r && <ResultBadge r={r} score={`${game.teamPoints}-${game.oppPoints}`} />}
        </p>
      </div>

      {stat ? (
        <StatCategoryTables
          line={toBoxLine(stat as unknown as Record<string, number>)}
          emptyText="No stats recorded for this game."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {player.name} has no stat line for this game.
        </p>
      )}
    </div>
  );
}
