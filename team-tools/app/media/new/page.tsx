import Link from "next/link";
import { db } from "@/lib/db";
import { NewEventForm } from "@/components/media/new-event-form";

export const dynamic = "force-dynamic";

export default async function NewMediaEventPage() {
  const [seasons, games, players, personas] = await Promise.all([
    db.season.findMany({ orderBy: { startYear: "desc" }, select: { id: true, name: true } }),
    db.game.findMany({
      orderBy: [{ season: { startYear: "desc" } }, { week: "asc" }],
      select: {
        id: true,
        opponent: true,
        week: true,
        location: true,
        teamPoints: true,
        oppPoints: true,
        season: { select: { name: true } },
      },
    }),
    db.player.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        seasonPlayers: {
          select: { position: true },
          orderBy: { seasonRoster: { season: { startYear: "desc" } } },
          take: 1,
        },
      },
    }),
    db.authorPersona.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const recruitRows = await db.recruit.findMany({
    orderBy: [{ season: { startYear: "desc" } }, { stars: "desc" }, { name: "asc" }],
    select: { id: true, name: true, position: true, stars: true, season: { select: { name: true } } },
  });

  const gameOptions = games.map((g) => ({
    id: g.id,
    label: `${g.season.name} · ${g.location === "AWAY" ? "@ " : "vs "}${g.opponent}${g.week != null ? ` (Wk ${g.week})` : ""}`,
    played: g.teamPoints !== 0 || g.oppPoints !== 0,
  }));

  const playerOptions = players.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    position: p.seasonPlayers[0]?.position ?? null,
  }));

  const recruitOptions = recruitRows.map((r) => ({
    id: r.id,
    label: `${r.season.name} · ${r.name} (${r.position})${r.stars ? ` · ${r.stars}★` : ""}`,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/media" className="text-sm text-muted-foreground hover:text-foreground">
          ← Media
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          New Post
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Post an event to the media space by hand. It generates in the background —
          watch it in the Media Space feed.
        </p>
      </div>

      <NewEventForm
        games={gameOptions}
        seasons={seasons}
        players={playerOptions}
        recruits={recruitOptions}
        personas={personas}
      />
    </div>
  );
}
