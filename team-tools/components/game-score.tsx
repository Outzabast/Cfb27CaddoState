type ScoreGame = {
  teamQ1: number; teamQ2: number; teamQ3: number; teamQ4: number; teamOt: number;
  oppQ1: number; oppQ2: number; oppQ3: number; oppQ4: number; oppOt: number;
  teamPoints: number; oppPoints: number;
};

/** A short scoreboard code from a team name ("Northern Illinois" → "NORT"). */
function code(name: string): string {
  const clean = name.replace(/[^A-Za-z ]/g, "").trim();
  if (clean.length <= 4) return clean.toUpperCase();
  const initials = clean.split(/\s+/).map((w) => w[0]).join("");
  return (initials.length >= 2 ? initials : clean.slice(0, 4)).toUpperCase();
}

/** ESPN-style final-score header: team names + records flanking a quarter-by-quarter
 *  grid, with the big finals. Centered. */
export function GameScore({
  teamName,
  teamRecord,
  oppName,
  oppRecord,
  game,
}: {
  teamName: string;
  teamRecord: string | null;
  oppName: string;
  oppRecord?: string | null;
  game: ScoreGame;
}) {
  const hasOt = game.teamOt > 0 || game.oppOt > 0;
  const cols: { label: string; team: number; opp: number }[] = [
    { label: "1", team: game.teamQ1, opp: game.oppQ1 },
    { label: "2", team: game.teamQ2, opp: game.oppQ2 },
    { label: "3", team: game.teamQ3, opp: game.oppQ3 },
    { label: "4", team: game.teamQ4, opp: game.oppQ4 },
    ...(hasOt ? [{ label: "OT", team: game.teamOt, opp: game.oppOt }] : []),
  ];
  const played = game.teamPoints !== 0 || game.oppPoints !== 0;
  const teamWon = played && game.teamPoints > game.oppPoints;
  const oppWon = played && game.oppPoints > game.teamPoints;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      {/* Home team (us) */}
      <div className="min-w-28 text-right">
        <div className="font-semibold leading-tight">{teamName}</div>
        {teamRecord && <div className="text-xs text-muted-foreground">{teamRecord}</div>}
      </div>
      <div className={"text-4xl font-extrabold tabular-nums " + (teamWon ? "" : "text-muted-foreground")}>
        {game.teamPoints}
      </div>

      {/* Quarter grid */}
      <div className="text-center">
        <div className="eyebrow mb-1">{played ? "Final" : "Scheduled"}</div>
        <table className="text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="w-12" />
              {cols.map((c) => (
                <th key={c.label} className="w-7 font-medium">{c.label}</th>
              ))}
              <th className="w-8 font-bold text-foreground">T</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">{code(teamName)}</td>
              {cols.map((c) => (
                <td key={c.label} className="text-center">{c.team}</td>
              ))}
              <td className="text-center font-bold">{game.teamPoints}</td>
            </tr>
            <tr>
              <td className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">{code(oppName)}</td>
              {cols.map((c) => (
                <td key={c.label} className="text-center">{c.opp}</td>
              ))}
              <td className="text-center font-bold">{game.oppPoints}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={"text-4xl font-extrabold tabular-nums " + (oppWon ? "" : "text-muted-foreground")}>
        {game.oppPoints}
      </div>
      {/* Opponent */}
      <div className="min-w-28 text-left">
        <div className="font-semibold leading-tight">{oppName}</div>
        {oppRecord && <div className="text-xs text-muted-foreground">{oppRecord}</div>}
      </div>
    </div>
  );
}
