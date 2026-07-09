"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/classes";
import type { GameLocation } from "@/generated/prisma/enums";
import { updateGame, deleteGame } from "@/app/seasons/[id]/schedule/actions";
import { SaveForm } from "@/components/save-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type GameRow = {
  id: number;
  week: number | null;
  date: string | null; // YYYY-MM-DD
  opponent: string;
  location: GameLocation;
  teamPoints: number;
  oppPoints: number;
  isConference: boolean;
  note: string | null;
};

type SortKey = "week" | "date" | "opponent" | "location";

const locationOptions = LOCATION_ORDER.map((l) => ({ value: l, label: LOCATION_LABELS[l] }));
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function result(t: number, o: number): "W" | "L" | "T" | null {
  if (t === 0 && o === 0) return null;
  if (t > o) return "W";
  if (t < o) return "L";
  return "T";
}

export function ScheduleTable({
  seasonId,
  games,
}: {
  seasonId: number;
  games: GameRow[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("week");
  const [sortAsc, setSortAsc] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const nn = (v: number | null) => (v ?? Number.POSITIVE_INFINITY);
    const ns = (v: string | null) => v ?? "￿";
    return [...games].sort((a, b) => {
      switch (sortKey) {
        case "week":
          return (nn(a.week) - nn(b.week)) * dir;
        case "date":
          return ns(a.date).localeCompare(ns(b.date)) * dir;
        case "opponent":
          return a.opponent.localeCompare(b.opponent) * dir;
        case "location":
          return a.location.localeCompare(b.location) * dir;
      }
    });
  }, [games, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  const headers: [SortKey, string, string][] = [
    ["week", "Wk", "w-14"],
    ["date", "Date", "w-32"],
    ["opponent", "Opponent", ""],
    ["location", "Where", "w-24"],
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map(([key, label, cls]) => (
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
          <TableHead className="w-24 text-right">Score</TableHead>
          <TableHead className="w-14">Result</TableHead>
          <TableHead className="w-56 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((g) => {
          const r = result(g.teamPoints, g.oppPoints);
          const editing = editingId === g.id;
          return (
            <Fragment key={g.id}>
              <TableRow>
                <TableCell>{g.week ?? "—"}</TableCell>
                <TableCell>{g.date ?? "—"}</TableCell>
                <TableCell className="font-medium">
                  {g.opponent}
                  {g.isConference && (
                    <Badge variant="outline" className="ml-2 text-[0.6rem] uppercase">
                      Conf
                    </Badge>
                  )}
                  {g.note && (
                    <span className="block text-xs font-normal text-muted-foreground">{g.note}</span>
                  )}
                </TableCell>
                <TableCell>{LOCATION_LABELS[g.location]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r ? `${g.teamPoints}–${g.oppPoints}` : "—"}
                </TableCell>
                <TableCell>
                  {r && (
                    <Badge variant={r === "W" ? "default" : "secondary"}>{r}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editing ? null : g.id)}
                    >
                      {editing ? "Close" : "Edit"}
                    </Button>
                    <Link
                      href={`/seasons/${seasonId}/schedule/${g.id}/box-score`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Box score
                    </Link>
                    <SaveForm action={deleteGame} successText="Game deleted">
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="gameId" value={g.id} />
                      <ConfirmButton
                        type="submit"
                        variant="ghost"
                        size="sm"
                        message={`Delete the game vs ${g.opponent}?`}
                      >
                        Delete
                      </ConfirmButton>
                    </SaveForm>
                  </div>
                </TableCell>
              </TableRow>
              {editing && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-muted/40">
                    <SaveForm
                      action={updateGame}
                      successText="Game updated"
                      className="flex flex-wrap items-end gap-3 py-1"
                      onSubmit={() => setEditingId(null)}
                    >
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="gameId" value={g.id} />
                      <LabeledField label="Week" className="w-20">
                        <Input
                          name="week"
                          type="number"
                          min={0}
                          max={20}
                          defaultValue={g.week ?? ""}
                        />
                      </LabeledField>
                      <LabeledField label="Date" className="w-40">
                        <Input name="date" type="date" defaultValue={g.date ?? ""} />
                      </LabeledField>
                      <LabeledField label="Opponent" className="w-48">
                        <Input name="opponent" defaultValue={g.opponent} required />
                      </LabeledField>
                      <LabeledField label="Where" className="w-28">
                        <select
                          name="location"
                          defaultValue={g.location}
                          className={selectClass}
                        >
                          {locationOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </LabeledField>
                      <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-muted-foreground">
                        <input
                          type="checkbox"
                          name="isConference"
                          defaultChecked={g.isConference}
                        />
                        Conference game
                      </label>
                      <LabeledField label="Note" className="w-64">
                        <Input
                          name="note"
                          defaultValue={g.note ?? ""}
                          placeholder="e.g. CUSA title game, bowl game"
                        />
                      </LabeledField>
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <span className="pb-1 text-xs text-muted-foreground">
                        Score is entered on the Box score page.
                      </span>
                    </SaveForm>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LabeledField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
