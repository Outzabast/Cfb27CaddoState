"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  deletePlayerStat,
  upsertPlayerStatLine,
} from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { PLAYER_STAT_GROUPS, PLAYER_PCTS } from "@/lib/stat-fields";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { RosterPlayerPicker, type RosterPick } from "@/components/box-score/roster-player-picker";
import { SaveForm } from "@/components/save-form";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

export type StatLineRow = {
  playerId: number;
  name: string;
  position: string;
  /** The full recorded line, comma-delimited by category (see formatStatLine). */
  statLine: string;
  /** Full stat values, for prefilling the editor. */
  values: Record<string, number>;
};

type SortKey = "name" | "position";
type Editing = { kind: "add" } | { kind: "edit"; row: StatLineRow } | null;

export function PlayerStatTable({
  seasonId,
  gameId,
  rows,
  roster,
}: {
  seasonId: number;
  gameId: number;
  /** Rostered players without a line yet (the "add" candidates). */
  roster: RosterPick[];
  rows: StatLineRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

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
      setSortAsc(true);
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  const cols: [SortKey, string, string][] = [
    ["name", "Player", "w-44"],
    ["position", "Pos", "w-16"],
  ];

  const editingRow = editing?.kind === "edit" ? editing.row : null;

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
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => setEditing({ kind: "add" })}
          disabled={roster.length === 0}
          title={roster.length === 0 ? "Every rostered player already has a line" : undefined}
        >
          <Plus className="h-4 w-4" />
          Add player line
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {cols.map(([key, label, cls]) => (
              <TableHead key={key} className={cls}>
                <button type="button" onClick={() => toggleSort(key)} className="font-medium hover:text-foreground">
                  {label}
                  {arrow(key)}
                </button>
              </TableHead>
            ))}
            <TableHead>Stat line</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                No stat lines yet. Use “Add player line” to record one.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((s) => (
              <TableRow key={s.playerId}>
                <TableCell className="align-top font-medium">
                  <Link href={`/players/${s.playerId}`} className="hover:underline">{s.name}</Link>
                </TableCell>
                <TableCell className="align-top text-muted-foreground">{s.position}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.statLine || <span className="text-muted-foreground/60">no stats recorded</span>}
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ kind: "edit", row: s })}
                    >
                      Edit
                    </Button>
                    <SaveForm action={deletePlayerStat} successText={`${s.name}'s line deleted`}>
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="gameId" value={gameId} />
                      <input type="hidden" name="playerId" value={s.playerId} />
                      <ConfirmButton type="submit" variant="ghost" size="sm" message={`Delete ${s.name}'s stat line?`}>
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

      {/* Add / edit a player line — in a dialog so it's never confused with the
          team-stats editor. */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? `Edit ${editingRow.name}` : "Add player line"}
            </DialogTitle>
            <DialogDescription>
              {editingRow
                ? "Update this player's stats for the game. Blank fields save as 0."
                : "Pick a rostered player without a line yet, then enter their stats."}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <SaveForm
              key={editingRow ? `edit-${editingRow.playerId}` : "add"}
              action={async (formData) => {
                await upsertPlayerStatLine(formData);
                setEditing(null);
                router.refresh();
              }}
              successText={editingRow ? "Stat line saved" : "Stat line added"}
              className="contents"
            >
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="gameId" value={gameId} />
              <DialogBody className="space-y-4">
                {editingRow ? (
                  <input type="hidden" name="playerId" value={editingRow.playerId} />
                ) : (
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">Player</span>
                    <RosterPlayerPicker players={roster} />
                  </div>
                )}
                <StatFieldGroups
                  groups={PLAYER_STAT_GROUPS}
                  values={editingRow?.values}
                  idPrefix="pl"
                  pcts={PLAYER_PCTS}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit">{editingRow ? "Save changes" : "Add stat line"}</Button>
              </DialogFooter>
            </SaveForm>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
