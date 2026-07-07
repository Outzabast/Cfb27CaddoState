"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import { formatHeight } from "@/lib/player-profile";
import type { PlayerClass } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RosterReadRow = {
  playerId: number;
  name: string;
  position: string;
  class: PlayerClass;
  number: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  hometown: string | null;
};

type SortKey = "number" | "name" | "position" | "class";

const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function RosterReadTable({ rows }: { rows: RosterReadRow[] }) {
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortAsc, setSortAsc] = useState(true);

  const positions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.position))).sort(),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (!posFilter || r.position === posFilter) &&
        (!classFilter || r.class === classFilter),
    );
    const dir = sortAsc ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "number":
          return ((a.number ?? Infinity) - (b.number ?? Infinity)) * dir;
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "position":
          return a.position.localeCompare(b.position) * dir;
        case "class":
          return (CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class)) * dir;
      }
    });
  }, [rows, query, posFilter, classFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by position"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by class"
        >
          <option value="">All classes</option>
          {classOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ["number", "#", "w-14"],
                  ["name", "Name", ""],
                  ["position", "Pos", "w-20"],
                  ["class", "Class", "w-40"],
                ] as [SortKey, string, string][]
              ).map(([key, label, cls]) => (
                <TableHead key={key} className={cls}>
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="font-medium hover:text-foreground"
                  >
                    {label}
                    {arrow(key)}
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-24">HT/WT</TableHead>
              <TableHead>Hometown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No players match.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => {
                const ht = formatHeight(r.heightInches);
                const htwt =
                  [ht, r.weightLbs ? `${r.weightLbs}` : null].filter(Boolean).join(" · ") ||
                  "—";
                return (
                  <TableRow key={r.playerId}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.number ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/players/${r.playerId}`} className="hover:text-primary">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.position}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {CLASS_LABELS[r.class]}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{htwt}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.hometown ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
