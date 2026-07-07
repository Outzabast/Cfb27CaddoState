import { BOX_CATEGORIES, type BoxLine } from "@/lib/box-score";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Build a BoxLine from a flat stat-values map (career/season aggregate or a
 *  game line). Only the numeric stat fields are read by the category columns. */
export function toBoxLine(values: Record<string, number>): BoxLine {
  return { playerId: 0, name: "", number: null, ...values } as unknown as BoxLine;
}

/**
 * Renders one player's stats split into the same categories as the box score
 * (Passing, Rushing, …), one row per category, hiding any category the player
 * has no stats in. Used for career totals, a single season, and a single game.
 */
export function StatCategoryTables({
  line,
  emptyText = "No stats recorded.",
}: {
  line: BoxLine;
  emptyText?: string;
}) {
  const cats = BOX_CATEGORIES.filter((c) => c.eligible(line));
  if (cats.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="space-y-4">
      {cats.map((cat) => (
        <div key={cat.key} className="overflow-hidden rounded-md border bg-card">
          <div className="px-4 py-2.5">
            <h4 className="eyebrow !text-foreground">{cat.title}</h4>
          </div>
          {/* table-fixed => columns divide the full width evenly, so the
              table fills the card and columns are uniformly spaced. */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-t">
                {cat.cols.map((c) => (
                  <TableHead key={c.label} className="text-right">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {cat.cols.map((c) => (
                  <TableCell key={c.label} className="text-right tabular-nums">
                    {c.cell(line)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
