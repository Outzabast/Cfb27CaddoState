"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import type { PlayerClass } from "@/generated/prisma/enums";
import { updateSeasonPlayer, removeFromRoster } from "@/app/seasons/[id]/roster/actions";
import { SaveForm } from "@/components/save-form";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RosterRow = {
  seasonPlayerId: number;
  playerId: number;
  name: string;
  position: string;
  class: PlayerClass;
  number: number | null;
  isStarter: boolean;
};

type SortKey = "number" | "name" | "position" | "class";

const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function RosterTable({
  seasonId,
  rows,
}: {
  seasonId: number;
  rows: RosterRow[];
}) {
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

      <Table>
        <TableHeader>
          <TableRow>
            {(
              [
                ["number", "#", "w-20"],
                ["name", "Name", ""],
                ["position", "Position", "w-28"],
                ["class", "Class", "w-56"],
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
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                No players match.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((r) => (
              <TableRow key={r.seasonPlayerId}>
                <TableCell colSpan={4} className="p-0">
                  <SaveForm
                    action={updateSeasonPlayer}
                    successText={`${r.name} saved`}
                    className="flex items-center gap-2 px-2 py-1"
                  >
                    <input type="hidden" name="seasonId" value={seasonId} />
                    <input type="hidden" name="seasonPlayerId" value={r.seasonPlayerId} />
                    <Input
                      name="number"
                      type="number"
                      defaultValue={r.number ?? ""}
                      placeholder="#"
                      className="w-16"
                      aria-label="Jersey number"
                    />
                    <Link
                      href={`/players/${r.playerId}`}
                      className="min-w-40 flex-1 font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    <Input
                      name="position"
                      defaultValue={r.position}
                      maxLength={8}
                      className="w-24"
                      aria-label="Position"
                    />
                    <AutoSubmitSelect
                      name="class"
                      defaultValue={r.class}
                      options={classOptions}
                      aria-label="Class"
                      className="w-52"
                    />
                    <label className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        name="isStarter"
                        defaultChecked={r.isStarter}
                        aria-label="Starter"
                      />
                      Starter
                    </label>
                    <Button type="submit" variant="secondary" size="sm">
                      Save
                    </Button>
                  </SaveForm>
                </TableCell>
                <TableCell className="text-right align-middle">
                  <SaveForm action={removeFromRoster} successText={`${r.name} removed`}>
                    <input type="hidden" name="seasonId" value={seasonId} />
                    <input type="hidden" name="seasonPlayerId" value={r.seasonPlayerId} />
                    <ConfirmButton
                      type="submit"
                      variant="ghost"
                      size="sm"
                      message={`Remove ${r.name} from this roster?`}
                    >
                      Remove
                    </ConfirmButton>
                  </SaveForm>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
