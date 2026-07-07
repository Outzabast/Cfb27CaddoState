import Link from "next/link";
import { BOX_CATEGORIES, type BoxLine } from "@/lib/box-score";
import { CATEGORY_RANK, teamLeaders } from "@/lib/season-stats";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Players tab: a "Team Leaders" strip plus one leaderboard table per box-score
 * category (Passing, Rushing, …, Punting), each showing every player who
 * recorded something, ranked, with a season Team total row.
 */
export function PlayersTab({ lines }: { lines: BoxLine[] }) {
  const leaders = teamLeaders(lines);

  const categories = BOX_CATEGORIES.map((cat) => {
    const rank = CATEGORY_RANK[cat.key] ?? (() => 0);
    const rows = lines
      .filter((l) => cat.eligible(l))
      .sort((a, b) => rank(b) - rank(a));
    return { cat, rows };
  }).filter((c) => c.rows.length > 0);

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No player stats recorded this season yet. Enter a box score to populate
        the leaderboards.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {leaders.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow !text-foreground">Team Leaders</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {leaders.map((l) => (
              <div key={l.title} className="rounded-md border bg-card p-4">
                <div className="eyebrow">{l.title}</div>
                <Link
                  href={`/players/${l.playerId}`}
                  className="mt-1 block truncate text-sm font-medium hover:text-primary"
                >
                  {l.name}
                  {l.number != null && (
                    <span className="ml-1 text-xs text-muted-foreground">#{l.number}</span>
                  )}
                </Link>
                <div className="mt-1 text-2xl font-bold tabular-nums">{l.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {categories.map(({ cat, rows }) => (
          <div key={cat.key} className="overflow-hidden rounded-md border bg-card">
            <div className="px-4 py-2.5">
              <h3 className="eyebrow !text-foreground">{cat.title}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-t">
                  <TableHead className="pl-4">&nbsp;</TableHead>
                  {cat.cols.map((c) => (
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
                    {cat.cols.map((c) => (
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
                  {cat.cols.map((c) => (
                    <TableCell key={c.label} className="text-right font-semibold tabular-nums">
                      {c.total(rows)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
