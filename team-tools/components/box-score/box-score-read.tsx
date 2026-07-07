import Link from "next/link";
import {
  BOX_CATEGORIES,
  teamStatRows,
  type BoxLine,
  type TeamTotals,
} from "@/lib/box-score";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Game = {
  opponent: string;
  location: string;
  week: number | null;
  teamPoints: number;
  oppPoints: number;
  teamQ1: number; teamQ2: number; teamQ3: number; teamQ4: number; teamOt: number;
  oppQ1: number; oppQ2: number; oppQ3: number; oppQ4: number; oppOt: number;
};

const TEAM = "Caddo State";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/caddo-cs-mark.png" alt="" className="h-5 w-auto" />
      <h3 className="eyebrow !text-foreground">
        {TEAM} {title}
      </h3>
    </div>
  );
}

function Linescore({ game }: { game: Game }) {
  const hasOt = game.teamOt > 0 || game.oppOt > 0;
  const cols: { label: string; team: number; opp: number }[] = [
    { label: "1", team: game.teamQ1, opp: game.oppQ1 },
    { label: "2", team: game.teamQ2, opp: game.oppQ2 },
    { label: "3", team: game.teamQ3, opp: game.oppQ3 },
    { label: "4", team: game.teamQ4, opp: game.oppQ4 },
    ...(hasOt ? [{ label: "OT", team: game.teamOt, opp: game.oppOt }] : []),
  ];
  const rows = [
    { name: TEAM, cells: cols.map((c) => c.team), final: game.teamPoints, win: game.teamPoints > game.oppPoints },
    { name: game.opponent, cells: cols.map((c) => c.opp), final: game.oppPoints, win: game.oppPoints > game.teamPoints },
  ];

  return (
    <div className="w-fit overflow-x-auto rounded-md border">
      <table className="border-collapse">
        <thead>
          <tr className="eyebrow border-b">
            <th className="px-3 py-2 text-left font-bold"></th>
            {cols.map((c) => (
              <th key={c.label} className="w-12 px-2 py-2 text-center font-bold">
                {c.label}
              </th>
            ))}
            <th className="border-l px-3 py-2 text-center font-bold">T</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.name}</td>
              {r.cells.map((v, i) => (
                <td key={i} className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                  {v}
                </td>
              ))}
              <td
                className={`border-l px-3 py-2 text-center text-lg font-bold tabular-nums ${
                  r.win ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {r.final}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({
  title,
  cols,
  rows,
}: {
  title: string;
  cols: (typeof BOX_CATEGORIES)[number]["cols"];
  rows: BoxLine[];
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <SectionHeader title={title} />
      <Table>
        <TableHeader>
          <TableRow className="border-t">
            <TableHead className="pl-4">&nbsp;</TableHead>
            {cols.map((c) => (
              <TableHead key={c.label} className="text-right">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((l) => (
            <TableRow key={l.playerId}>
              <TableCell className="pl-4">
                <Link href={`/players/${l.playerId}`} className="hover:text-primary">
                  <span className="font-medium">{l.name}</span>
                  {l.number != null && (
                    <span className="ml-1.5 text-xs text-muted-foreground">#{l.number}</span>
                  )}
                </Link>
              </TableCell>
              {cols.map((c) => (
                <TableCell key={c.label} className="text-right tabular-nums">
                  {c.cell(l)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Team
            </TableCell>
            {cols.map((c) => (
              <TableCell key={c.label} className="text-right font-semibold tabular-nums">
                {c.total(rows)}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function BoxScoreRead({
  game,
  lines,
  teamStats,
}: {
  game: Game;
  lines: BoxLine[];
  teamStats: TeamTotals | null;
}) {
  const categories = BOX_CATEGORIES.map((cat) => ({
    cat,
    rows: lines.filter((l) => cat.eligible(l)),
  })).filter((c) => c.rows.length > 0);

  const teamRows = teamStats ? teamStatRows(teamStats, lines) : [];

  return (
    <div className="space-y-6">
      <Linescore game={game} />

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No player stats recorded yet. Use <span className="font-medium">Edit box score</span> to add them.
        </p>
      ) : (
        <div className="space-y-4">
          {categories.map(({ cat, rows }) => (
            <CategoryTable key={cat.key} title={cat.title} cols={cat.cols} rows={rows} />
          ))}
        </div>
      )}

      {/* Team stats */}
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="px-4 py-2.5">
          <h3 className="eyebrow !text-foreground">Team Stats</h3>
        </div>
        {teamStats ? (
          <table className="w-full text-sm">
            <tbody>
              {teamRows.map((r, i) => (
                <tr
                  key={`${r.label}-${i}`}
                  className={`border-t ${r.sub ? "" : "font-semibold"}`}
                >
                  <td className={`px-4 py-2 ${r.sub ? "pl-8 text-muted-foreground" : ""}`}>
                    {r.label}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No team stats recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
