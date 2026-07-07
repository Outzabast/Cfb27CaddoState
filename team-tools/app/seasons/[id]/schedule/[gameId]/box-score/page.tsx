import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  PLAYER_PCTS,
  TEAM_PCTS,
} from "@/lib/stat-fields";
import {
  upsertTeamStats,
  upsertPlayerStat,
  zeroOutRoster,
} from "./actions";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { BoxScoreImportMenu } from "@/components/ocr/box-score-import";
import { SaveForm } from "@/components/save-form";
import { Scoreboard } from "@/components/scoreboard";
import { PlayerStatTable, type StatLineRow } from "@/components/player-stat-table";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ player?: string }>;
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

  const usedPlayerIds = new Set(game.playerStats.map((s) => s.playerId));
  const availableRoster = roster.filter((e) => !usedPlayerIds.has(e.playerId));

  const { player } = await searchParams;
  const selectedPlayerId = player ? Number(player) : undefined;
  const editingLine = selectedPlayerId
    ? game.playerStats.find((s) => s.playerId === selectedPlayerId)
    : undefined;

  const statRows: StatLineRow[] = game.playerStats.map((s) => ({
    playerId: s.playerId,
    name: s.player.name,
    position: positionByPlayer.get(s.playerId) ?? "",
    passCmp: s.passCmp,
    passAtt: s.passAtt,
    passYds: s.passYds,
    rushAtt: s.rushAtt,
    rushYds: s.rushYds,
    rec: s.rec,
    recYds: s.recYds,
    tackles: s.tacklesSolo + s.tacklesAst,
    sacks: s.sacks,
  }));

  const backHref = `/seasons/${seasonId}/schedule`;
  const basePath = `${backHref}/${gid}/box-score`;

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
          <BoxScoreImportMenu
            seasonId={seasonId}
            gameId={gid}
            roster={roster.map((e) => ({
              playerId: e.playerId,
              name: e.player.name,
              position: e.position,
            }))}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Caddo State {game.teamPoints} – {game.oppPoints} {game.opponent}. Blanks
          count as 0; totals roll up to the season & career automatically.
        </p>
      </div>

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
        {statRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No player lines yet. Add one below, or zero out the whole roster.
          </p>
        ) : (
          <PlayerStatTable
            seasonId={seasonId}
            gameId={gid}
            basePath={basePath}
            rows={statRows}
          />
        )}
      </div>

      {/* ---- Add / edit a player line ---- */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingLine ? `Edit ${editingLine.player.name}` : "Add player line"}
          </CardTitle>
          <CardDescription>
            {editingLine
              ? "Update this player's stats for the game."
              : "Pick a rostered player (only those without a line yet) and enter their stats."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingLine && availableRoster.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every rostered player already has a stat line for this game.
            </p>
          ) : (
            <SaveForm
              action={upsertPlayerStat}
              successText={editingLine ? "Stat line saved" : "Stat line added"}
              className="space-y-4"
            >
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="gameId" value={gid} />
              <div className="flex items-center gap-3">
                <label htmlFor="playerId" className="text-sm font-medium">
                  Player
                </label>
                {editingLine ? (
                  <>
                    <input type="hidden" name="playerId" value={editingLine.playerId} />
                    <span className="font-medium">
                      {editingLine.player.name}{" "}
                      <span className="text-muted-foreground">
                        {positionByPlayer.get(editingLine.playerId) ?? ""}
                      </span>
                    </span>
                    <Link
                      href={basePath}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel edit
                    </Link>
                  </>
                ) : (
                  <select
                    id="playerId"
                    name="playerId"
                    defaultValue={availableRoster[0]?.playerId ?? ""}
                    className={selectClass}
                    required
                  >
                    {availableRoster.map((e) => (
                      <option key={e.playerId} value={e.playerId}>
                        {e.player.name} ({e.position})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <StatFieldGroups
                groups={PLAYER_STAT_GROUPS}
                values={editingLine ?? undefined}
                idPrefix="player"
                pcts={PLAYER_PCTS}
              />
              <Button type="submit">
                {editingLine ? "Save changes" : "Add stat line"}
              </Button>
            </SaveForm>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
