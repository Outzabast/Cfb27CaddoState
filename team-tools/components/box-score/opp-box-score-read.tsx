import { BOX_CATEGORIES, type BoxLine } from "@/lib/box-score";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** An opponent player's line. Same stat shape as our own (BoxLine), but the name
 *  isn't a link to a Player and there's a position instead of a jersey number. */
export type OppLine = BoxLine & { position: string | null };

/** The opponent's player stats rendered in the same ESPN-style category tables as
 *  our own box score. Opponent lines aren't tied to Player records, so names are
 *  plain text. Renders nothing if no opponent stats were recorded. */
export function OppBoxScoreRead({ oppName, lines }: { oppName: string; lines: OppLine[] }) {
  const categories = BOX_CATEGORIES.map((cat) => ({
    cat,
    rows: lines.filter((l) => cat.eligible(l)),
  })).filter((c) => c.rows.length > 0);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-4">
      {categories.map(({ cat, rows }) => (
        <div key={cat.key} className="overflow-hidden rounded-md border bg-card">
          <div className="px-4 py-2.5">
            <h3 className="eyebrow !text-foreground">
              {oppName} {cat.title}
            </h3>
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
              {(rows as OppLine[]).map((l) => (
                <TableRow key={l.playerId}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{l.name}</span>
                    {l.position && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{l.position}</span>
                    )}
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
  );
}
