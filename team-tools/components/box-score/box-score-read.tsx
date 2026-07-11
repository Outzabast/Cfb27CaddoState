import Link from "next/link";
import {
  BOX_CATEGORIES,
  teamCompareRows,
  type BoxLine,
  type TeamTotals,
} from "@/lib/box-score";
import { redZoneByTeam, downEfficiencyByTeam, type PlayLite } from "@/lib/play-by-play";
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

/** The player box-score category tables (Passing … Punting) for one team's lines.
 *  Empty-state message when nothing's recorded. */
export function PlayerBoxTables({ lines }: { lines: BoxLine[] }) {
  const categories = BOX_CATEGORIES.map((cat) => ({
    cat,
    rows: lines.filter((l) => cat.eligible(l)),
  })).filter((c) => c.rows.length > 0);

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No player stats recorded yet. Use <span className="font-medium">Edit box score</span> to add them.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {categories.map(({ cat, rows }) => (
        <CategoryTable key={cat.key} title={cat.title} cols={cat.cols} rows={rows} />
      ))}
    </div>
  );
}

/**
 * Team-stat comparison — us vs the opponent. Countable stats are derived live from
 * each team's player lines, red zone from the play-by-play; only the situational
 * stats come from the stored team-stat record, so nothing has to be imported twice.
 */
export function TeamStatsPanel({
  game,
  teamLines,
  oppLines,
  teamStats,
  oppStats,
  plays,
}: {
  game: Game;
  teamLines: BoxLine[];
  oppLines: BoxLine[];
  teamStats: TeamTotals | null;
  oppStats: TeamTotals | null;
  plays: PlayLite[];
}) {
  const rz = redZoneByTeam(plays);
  const down = downEfficiencyByTeam(plays);
  const teamRows = teamCompareRows(teamStats, oppStats, teamLines, oppLines, rz, down);
  const hasAnything =
    teamLines.length > 0 || oppLines.length > 0 || !!teamStats || !!oppStats || plays.length > 0;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="px-4 py-2.5">
          <h3 className="eyebrow !text-foreground">Team Stats</h3>
        </div>
        {hasAnything ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-t">
                <th className="px-4 py-2 text-left font-bold"></th>
                <th className="px-4 py-2 text-right font-bold">{TEAM}</th>
                <th className="px-4 py-2 text-right font-bold">{game.opponent}</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((r, i) => (
                <tr
                  key={`${r.label}-${i}`}
                  className={`border-t ${r.sub ? "" : "font-semibold"}`}
                >
                  <td className={`px-4 py-2 ${r.sub ? "pl-8 text-muted-foreground" : ""}`}>
                    {r.label}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.us}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {r.them}
                  </td>
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
