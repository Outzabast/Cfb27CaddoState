import Link from "next/link";
import { db } from "@/lib/db";
import { PressSetupForm } from "@/components/press-setup-form";
import { CLASS_LABELS } from "@/lib/classes";
import { STAFF_ROLE_LABELS } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function NewPressConferencePage() {
  const [games, seasons, players, staffRows, personas] = await Promise.all([
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
    db.season.findMany({ orderBy: { startYear: "desc" }, select: { id: true, name: true } }),
    db.player.findMany({
      where: { status: { not: "POSTACTIVE" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        seasonPlayers: {
          select: { position: true, class: true },
          orderBy: { seasonRoster: { season: { startYear: "desc" } } },
          take: 1,
        },
      },
    }),
    db.staff.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        seasonStaff: { select: { role: true }, orderBy: { season: { startYear: "desc" } }, take: 1 },
      },
    }),
    db.authorPersona.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const gameOpts = games.map((g) => ({
    id: g.id,
    label: `${g.season.name} · ${g.location === "AWAY" ? "@ " : "vs "}${g.opponent}${g.week != null ? ` (Wk ${g.week})` : ""}`,
    played: g.teamPoints !== 0 || g.oppPoints !== 0,
  }));
  const playerOpts = players.map((p) => ({
    id: p.id,
    label: `${p.name}${p.seasonPlayers[0] ? ` · ${p.seasonPlayers[0].position} · ${CLASS_LABELS[p.seasonPlayers[0].class]}` : ""}`,
  }));
  const staffOpts = staffRows.map((s) => ({
    id: s.id,
    label: `${s.name}${s.seasonStaff[0] ? ` · ${STAFF_ROLE_LABELS[s.seasonStaff[0].role]}` : ""}`,
  }));
  const personaOpts = personas.map((p) => ({ id: p.id, label: p.name }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/media" className="text-sm text-muted-foreground hover:text-foreground">
          ← Media
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          New Press Conference
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reporters ask; you answer as the player or coach. Each answer draws the next
          question. Publish it as a Q&amp;A transcript when you&rsquo;re done.
        </p>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create a season first.</p>
      ) : (
        <PressSetupForm
          games={gameOpts}
          seasons={seasons.map((s) => ({ id: s.id, label: s.name }))}
          players={playerOpts}
          staff={staffOpts}
          personas={personaOpts}
        />
      )}
    </div>
  );
}
