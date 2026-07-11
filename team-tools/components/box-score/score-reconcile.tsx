import { pointsByQuarter, groupDrives, driveConcluded, type PlayLite } from "@/lib/play-by-play";

type ScoreGame = {
  teamQ1: number; teamQ2: number; teamQ3: number; teamQ4: number; teamOt: number;
  oppQ1: number; oppQ2: number; oppQ3: number; oppQ4: number; oppOt: number;
  teamPoints: number; oppPoints: number;
};

/**
 * Reconcile the score DERIVED from the play-by-play against the authoritative
 * score-by-quarter (the truth). Shows a per-quarter grid with mismatches flagged,
 * plus any drives with no recognizable ending, so a bad OCR import is easy to spot
 * and fix in the editor below (use the quarter filter to jump to the off quarter).
 */
export function ScoreReconcile({
  plays,
  game,
  teamName,
  oppName,
}: {
  plays: PlayLite[];
  game: ScoreGame;
  teamName: string;
  oppName: string;
}) {
  if (plays.length === 0) return null;

  const pbp = new Map(pointsByQuarter(plays).map((q) => [q.quarter, q]));
  const hasOt = game.teamOt > 0 || game.oppOt > 0 || pbp.has(5);

  const rows: { label: string; q: number; tTruth: number; oTruth: number }[] = [
    { label: "Q1", q: 1, tTruth: game.teamQ1, oTruth: game.oppQ1 },
    { label: "Q2", q: 2, tTruth: game.teamQ2, oTruth: game.oppQ2 },
    { label: "Q3", q: 3, tTruth: game.teamQ3, oTruth: game.oppQ3 },
    { label: "Q4", q: 4, tTruth: game.teamQ4, oTruth: game.oppQ4 },
    ...(hasOt ? [{ label: "OT", q: 5, tTruth: game.teamOt, oTruth: game.oppOt }] : []),
  ];

  const pbpTotal = rows.reduce(
    (acc, r) => {
      const p = pbp.get(r.q);
      return { team: acc.team + (p?.team ?? 0), opp: acc.opp + (p?.opp ?? 0) };
    },
    { team: 0, opp: 0 },
  );
  const totalMatch = pbpTotal.team === game.teamPoints && pbpTotal.opp === game.oppPoints;

  const openDrives = groupDrives(plays).filter((d) => !driveConcluded(d.plays));

  const cell = (truth: number, derived: number) => {
    const ok = truth === derived;
    return (
      <td className={"px-3 py-1.5 text-center tabular-nums " + (ok ? "" : "font-bold text-destructive")}>
        {derived}
        {!ok && <span className="ml-1 text-xs">(≠{truth})</span>}
      </td>
    );
  };

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow !text-foreground">Score Check</h2>
        <span className="text-xs text-muted-foreground">
          Play-by-play total vs. the score by quarter (the truth)
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow border-b">
              <th className="px-3 py-2 text-left font-bold"> </th>
              {rows.map((r) => (
                <th key={r.q} className="px-3 py-2 text-center font-bold">{r.label}</th>
              ))}
              <th className="border-l px-3 py-2 text-center font-bold">Final</th>
            </tr>
          </thead>
          <tbody>
            {/* Truth (score by quarter) */}
            <tr className="border-t">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">{teamName} — truth</td>
              {rows.map((r) => (
                <td key={r.q} className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">{r.tTruth}</td>
              ))}
              <td className="border-l px-3 py-1.5 text-center font-semibold tabular-nums">{game.teamPoints}</td>
            </tr>
            {/* Derived from PBP */}
            <tr className="border-t">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">{teamName} — play-by-play</td>
              {rows.map((r) => cell(r.tTruth, pbp.get(r.q)?.team ?? 0))}
              <td className={"border-l px-3 py-1.5 text-center font-semibold tabular-nums " + (pbpTotal.team === game.teamPoints ? "" : "text-destructive")}>
                {pbpTotal.team}
              </td>
            </tr>
            <tr className="border-t">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">{oppName} — truth</td>
              {rows.map((r) => (
                <td key={r.q} className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">{r.oTruth}</td>
              ))}
              <td className="border-l px-3 py-1.5 text-center font-semibold tabular-nums">{game.oppPoints}</td>
            </tr>
            <tr className="border-t">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">{oppName} — play-by-play</td>
              {rows.map((r) => cell(r.oTruth, pbp.get(r.q)?.opp ?? 0))}
              <td className={"border-l px-3 py-1.5 text-center font-semibold tabular-nums " + (pbpTotal.opp === game.oppPoints ? "" : "text-destructive")}>
                {pbpTotal.opp}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="border-t px-3 py-2 text-sm">
          {totalMatch ? (
            <span className="text-muted-foreground">
              ✓ Play-by-play matches the score by quarter.
            </span>
          ) : (
            <span className="text-destructive">
              ✗ Play-by-play doesn&rsquo;t match. Fix the flagged quarter(s) in the editor below —
              a wrong possession, a mis-typed scoring play, or a missing/duplicated play.
            </span>
          )}
        </div>
      </div>

      {openDrives.length > 0 && (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{openDrives.length} drive{openDrives.length === 1 ? "" : "s"} with no clear ending:</span>{" "}
          {openDrives
            .map((d) => {
              const f = d.plays[0];
              const who = d.team === "TEAM" ? teamName : oppName;
              return `${who} Q${f.quarter}${f.clock ? ` ${f.clock}` : ""}`;
            })
            .join(" · ")}
          . Give each a concluding play (touchdown, field goal, punt, turnover, etc.).
        </div>
      )}
    </section>
  );
}
