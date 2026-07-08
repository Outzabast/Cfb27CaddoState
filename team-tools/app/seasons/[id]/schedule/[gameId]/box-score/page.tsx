import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TEAM_STAT_GROUPS, TEAM_PCTS } from "@/lib/stat-fields";
import { formatStatLine, type BoxLine } from "@/lib/box-score";
import {
  upsertTeamStats,
  upsertOppStats,
  zeroOutRoster,
  generateGameArticle,
} from "./actions";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { BoxScoreImportMenu } from "@/components/ocr/box-score-import";
import { BoxScoreRead } from "@/components/box-score/box-score-read";
import { PersonaSelect } from "@/components/media/persona-select";
import { PlayerMultiSelect } from "@/components/media/player-multi-select";
import { SaveForm } from "@/components/save-form";
import { Scoreboard } from "@/components/scoreboard";
import { PlayerStatTable, type StatLineRow } from "@/components/player-stat-table";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function BoxScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; gameId: string }>;
  searchParams: Promise<{ player?: string; mode?: string }>;
}) {
  const { id, gameId } = await params;
  const seasonId = Number(id);
  const gid = Number(gameId);
  if (!Number.isInteger(seasonId) || !Number.isInteger(gid)) notFound();

  const game = await db.game.findUnique({
    where: { id: gid },
    include: {
      season: true,
      teamStats: true,
      oppStats: true,
      playerStats: { include: { player: true } },
    },
  });
  if (!game || game.seasonId !== seasonId) notFound();

  const roster = await db.seasonPlayer.findMany({
    where: { seasonRoster: { seasonId } },
    include: { player: true },
    orderBy: { player: { name: "asc" } },
  });
  const positionByPlayer = new Map(roster.map((e) => [e.playerId, e.position]));
  const numberByPlayer = new Map(roster.map((e) => [e.playerId, e.number]));

  const usedPlayerIds = new Set(game.playerStats.map((s) => s.playerId));
  const availableRoster = roster.filter((e) => !usedPlayerIds.has(e.playerId));

  const personas = await db.authorPersona.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const rosterPlayers = roster.map((e) => ({
    id: e.playerId,
    name: e.player.name,
    position: e.position,
    status: e.player.status,
  }));

  const { mode } = await searchParams;
  const isEdit = mode === "edit";

  const backHref = `/seasons/${seasonId}/schedule`;
  const basePath = `${backHref}/${gid}/box-score`;

  // Players ranked by this game's notoriety (system-computed on box-score save).
  const notoRanked = [...game.playerStats]
    .filter((s) => s.gameNotoriety > 0)
    .sort((a, b) => b.gameNotoriety - a.gameNotoriety);

  // ---- Read-mode data (ESPN-style tables) ----
  const lines: BoxLine[] = game.playerStats.map((s) => ({
    ...s,
    name: s.player.name,
    number: numberByPlayer.get(s.playerId) ?? null,
  }));

  // ---- Edit-mode data (table + dialog editor) ----
  const statRows: StatLineRow[] = game.playerStats.map((s) => ({
    playerId: s.playerId,
    name: s.player.name,
    position: positionByPlayer.get(s.playerId) ?? "",
    statLine: formatStatLine(s as unknown as Record<string, number>),
    values: s as unknown as Record<string, number>,
  }));
  const addCandidates = availableRoster.map((e) => ({
    playerId: e.playerId,
    name: e.player.name,
    position: e.position,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {game.season.name} schedule
        </Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Box Score — {game.location === "AWAY" ? "@ " : ""}
            {game.opponent}
            {game.week != null ? ` (Week ${game.week})` : ""}
          </h1>
          <div className="flex items-center gap-2">
            {isEdit && (
              <BoxScoreImportMenu
                seasonId={seasonId}
                gameId={gid}
                roster={roster.map((e) => ({
                  playerId: e.playerId,
                  name: e.player.name,
                  position: e.position,
                }))}
              />
            )}
            {isEdit ? (
              <Link href={basePath} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Done
              </Link>
            ) : (
              <Link href={`${basePath}?mode=edit`} className={buttonVariants({ size: "sm" })}>
                Edit box score
              </Link>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Caddo State {game.teamPoints} – {game.oppPoints} {game.opponent}
          {isEdit ? ". Blanks count as 0; totals roll up to the season & career automatically." : ""}
        </p>
      </div>

      {notoRanked.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow !text-foreground">Game Notoriety</h2>
          <div className="flex flex-wrap gap-2">
            {notoRanked.map((s) => (
              <Link
                key={s.playerId}
                href={`/players/${s.playerId}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-sm hover:bg-accent"
              >
                <span className="font-medium">{s.player.name}</span>
                <span className="tabular-nums font-bold text-primary">{s.gameNotoriety}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!isEdit ? (
        <BoxScoreRead
          game={game}
          lines={lines}
          teamStats={game.teamStats}
          oppStats={game.oppStats}
        />
      ) : (
        <>
          {/* ---- Scoreboard (score by quarter) ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Score by quarter</CardTitle>
              <CardDescription>
                Final is calculated from the quarters. Add OT only if the game went to
                overtime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Scoreboard
                // Key on the stored score so an OCR import (which refreshes the
                // router) remounts the component and re-seeds its state instead of
                // keeping the stale useState value.
                key={`sb-${game.teamQ1}-${game.teamQ2}-${game.teamQ3}-${game.teamQ4}-${game.teamOt}-${game.oppQ1}-${game.oppQ2}-${game.oppQ3}-${game.oppQ4}-${game.oppOt}`}
                seasonId={seasonId}
                gameId={gid}
                teamName="Caddo State"
                oppName={game.opponent}
                values={{
                  teamQ1: game.teamQ1, teamQ2: game.teamQ2, teamQ3: game.teamQ3,
                  teamQ4: game.teamQ4, teamOt: game.teamOt,
                  oppQ1: game.oppQ1, oppQ2: game.oppQ2, oppQ3: game.oppQ3,
                  oppQ4: game.oppQ4, oppOt: game.oppOt,
                }}
              />
            </CardContent>
          </Card>

          {/* ---- Team stats ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Team stats</CardTitle>
              <CardDescription>Caddo State team totals for this game.</CardDescription>
            </CardHeader>
            <CardContent>
              <SaveForm
                action={upsertTeamStats}
                successText="Team stats saved"
                className="space-y-4"
              >
                <input type="hidden" name="seasonId" value={seasonId} />
                <input type="hidden" name="gameId" value={gid} />
                <StatFieldGroups
                  groups={TEAM_STAT_GROUPS}
                  values={game.teamStats ?? undefined}
                  idPrefix="team"
                  pcts={TEAM_PCTS}
                />
                <Button type="submit">Save team stats</Button>
              </SaveForm>
            </CardContent>
          </Card>

          {/* ---- Opposing team stats ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Opposing team stats</CardTitle>
              <CardDescription>
                {game.opponent}&rsquo;s team totals — what our defense gave up (yards,
                first downs, etc.). We don&rsquo;t track opposing player stats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SaveForm
                action={upsertOppStats}
                successText="Opponent stats saved"
                className="space-y-4"
              >
                <input type="hidden" name="seasonId" value={seasonId} />
                <input type="hidden" name="gameId" value={gid} />
                <StatFieldGroups
                  groups={TEAM_STAT_GROUPS}
                  values={game.oppStats ?? undefined}
                  idPrefix="opp"
                  pcts={TEAM_PCTS}
                />
                <Button type="submit">Save opponent stats</Button>
              </SaveForm>
            </CardContent>
          </Card>

          {/* ---- Existing player lines ---- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Player stat lines</h2>
              {availableRoster.length > 0 && game.playerStats.length > 0 && (
                <SaveForm action={zeroOutRoster} successText="Rest of roster zeroed out">
                  <input type="hidden" name="seasonId" value={seasonId} />
                  <input type="hidden" name="gameId" value={gid} />
                  <Button type="submit" variant="outline" size="sm">
                    Zero out rest of roster ({availableRoster.length})
                  </Button>
                </SaveForm>
              )}
            </div>
            <PlayerStatTable
              seasonId={seasonId}
              gameId={gid}
              rows={statRows}
              roster={addCandidates}
            />
          </div>

          {/* ---- Generate a recap ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Generate recap</CardTitle>
              <CardDescription>
                Done editing? Write a news recap of this game from the box score. It
                generates in the background and lands in the Media tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SaveForm
                action={generateGameArticle}
                loadingText="Queuing recap…"
                successText="Recap queued"
                className="space-y-4"
              >
                <input type="hidden" name="seasonId" value={seasonId} />
                <input type="hidden" name="gameId" value={gid} />
                <div className="grid gap-1.5">
                  <label
                    htmlFor="mediaContext"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Context the stats don&rsquo;t show (optional)
                  </label>
                  <textarea
                    id="mediaContext"
                    name="mediaContext"
                    placeholder="e.g. Caught the winning TD on the final play · backup QB started with the starter injured"
                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Written by
                  </span>
                  <PersonaSelect personas={personas} />
                </div>
                <PlayerMultiSelect
                  players={rosterPlayers}
                  name="mediaPlayerId"
                  label="Also write player features for (default none)"
                />
                <Button type="submit">Generate recap</Button>
              </SaveForm>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
