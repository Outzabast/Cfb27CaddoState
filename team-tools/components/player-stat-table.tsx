"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deletePlayerStat } from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { SaveForm } from "@/components/save-form";
import { ConfirmButton } from "@/components/confirm-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type StatLineRow = {
  playerId: number;
  name: string;
  position: string;
  passCmp: number;
  passAtt: number;
  passYds: number;
  rushAtt: number;
  rushYds: number;
  rec: number;
  recYds: number;
  tackles: number;
  sacks: number;
  /** The full recorded line, comma-delimited by category (see formatStatLine). */
  statLine: string;
};

type SortKey = "name" | "position";

export function PlayerStatTable({
  seasonId,
  gameId,
  basePath,
  rows,
}: {
  seasonId: number;
  gameId: number;
  basePath: string;
  rows: StatLineRow[];
}) {
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const positions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.position))).sort(),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sortAsc ? 1 : -1;
    return rows
      .filter(
        (r) =>
          (!q || r.name.toLowerCase().includes(q)) &&
          (!posFilter || r.position === posFilter),
      )
      .sort((a, b) =>
        sortKey === "position"
          ? a.position.localeCompare(b.position) * dir
          : a.name.localeCompare(b.name) * dir,
      );
  }, [rows, query, posFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "position");
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  const cols: [SortKey, string, string][] = [
    ["name", "Player", "w-44"],
    ["position", "Pos", "w-16"],
  ];

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
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Filter by position"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {cols.map(([key, label, cls]) => (
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
            <TableHead>Stat line</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                No stat lines match.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((s) => (
              <TableRow key={s.playerId}>
                <TableCell className="font-medium align-top">
                  <Link href={`/players/${s.playerId}`} className="hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground align-top">{s.position}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.statLine || <span className="text-muted-foreground/60">no stats recorded</span>}
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`${basePath}?mode=edit&player=${s.playerId}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Edit
                    </Link>
                    <SaveForm action={deletePlayerStat} successText={`${s.name}'s line deleted`}>
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="gameId" value={gameId} />
                      <input type="hidden" name="playerId" value={s.playerId} />
                      <ConfirmButton
                        type="submit"
                        variant="ghost"
                        size="sm"
                        message={`Delete ${s.name}'s stat line?`}
                      >
                        Delete
                      </ConfirmButton>
                    </SaveForm>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
