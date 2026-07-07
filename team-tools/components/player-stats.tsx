"use client";

import { useMemo, useState } from "react";
import {
  PLAYER_STAT_GROUPS,
  PLAYER_PCTS,
  formatDuration,
  formatPct,
} from "@/lib/stat-fields";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SeasonStat = {
  seasonId: number;
  seasonName: string;
  startYear: number;
  position: string;
  className: string;
  number: number | null;
  values: Record<string, number>;
};

type Col = {
  key: string;
  label: string;
  render: (v: Record<string, number>) => string | number;
  sortVal: (v: Record<string, number>) => number;
};

const CATEGORIES = PLAYER_STAT_GROUPS.map((g) => g.title);

function columnsFor(title: string): Col[] {
  const group = PLAYER_STAT_GROUPS.find((g) => g.title === title)!;
  const fieldCols: Col[] = group.fields.map((f) => ({
    key: f.name,
    label: f.label,
    render: (v) =>
      f.format === "duration" ? formatDuration(v[f.name] ?? 0) : (v[f.name] ?? 0),
    sortVal: (v) => v[f.name] ?? 0,
  }));
  const pctCols: Col[] = PLAYER_PCTS.filter((p) => p.group === title).map((p) => ({
    key: p.label,
    label: p.label,
    render: (v) => formatPct(v[p.num] ?? 0, v[p.den] ?? 0),
    sortVal: (v) => (v[p.den] ? v[p.num] / v[p.den] : -1),
  }));
  return [...fieldCols, ...pctCols];
}

export function PlayerStats({
  career,
  seasons,
}: {
  career: Record<string, number>;
  seasons: SeasonStat[];
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [sortKey, setSortKey] = useState<string>("season");
  const [sortAsc, setSortAsc] = useState(true);

  const cols = useMemo(() => columnsFor(category), [category]);

  const sortedSeasons = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const col = cols.find((c) => c.key === sortKey);
    return [...seasons].sort((a, b) => {
      if (sortKey === "season" || !col) return (a.startYear - b.startYear) * dir;
      return (col.sortVal(a.values) - col.sortVal(b.values)) * dir;
    });
  }, [seasons, cols, sortKey, sortAsc]);

  function toggleSort(key: string) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "season");
    }
  }
  const arrow = (key: string) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1 border-b">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2 text-sm text-muted-foreground hover:text-foreground",
              category === c && "border-foreground font-medium text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Career */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Career</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c.key} className="text-right whitespace-nowrap">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {cols.map((c) => (
                  <TableCell key={c.key} className="text-right tabular-nums">
                    {c.render(career)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Season by season */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By season</h2>
        {seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No seasons on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("season")}
                      className="font-medium hover:text-foreground"
                    >
                      Season{arrow("season")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Pos/Cl</TableHead>
                  {cols.map((c) => (
                    <TableHead key={c.key} className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="font-medium hover:text-foreground"
                      >
                        {c.label}
                        {arrow(c.key)}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSeasons.map((s) => (
                  <TableRow key={s.seasonId}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {s.seasonName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.position} · {s.className}
                      {s.number != null ? ` · #${s.number}` : ""}
                    </TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.key} className="text-right tabular-nums">
                        {c.render(s.values)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
