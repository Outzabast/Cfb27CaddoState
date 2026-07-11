"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  deleteOppPlayerStatLine,
  upsertOppPlayerStatLine,
} from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { PLAYER_STAT_GROUPS, PLAYER_PCTS } from "@/lib/stat-fields";
import { StatFieldGroups } from "@/components/stat-field-groups";
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

export type OppStatLineRow = {
  id: number;
  playerName: string;
  position: string;
  /** The full recorded line, comma-delimited by category (see formatStatLine). */
  statLine: string;
  /** Full stat values, for prefilling the editor. */
  values: Record<string, number>;
};

type Editing = { kind: "add" } | { kind: "edit"; row: OppStatLineRow } | null;

/** Manual add / edit / delete for the opponent's player stat lines. These aren't
 *  Player records — just named lines on the game — so it's a name + position and
 *  the same stat groups as our own box score. */
export function OppPlayerStatTable({
  seasonId,
  gameId,
  oppName,
  rows,
}: {
  seasonId: number;
  gameId: number;
  oppName: string;
  rows: OppStatLineRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.playerName.toLowerCase().includes(q))
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [rows, query]);

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
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
        <Button type="button" size="sm" onClick={() => setEditing({ kind: "add" })}>
          <Plus className="h-4 w-4" />
          Add {oppName} line
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Player</TableHead>
            <TableHead className="w-16">Pos</TableHead>
            <TableHead>Stat line</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                No opponent stat lines yet. Use “Add {oppName} line” to record one.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="align-top font-medium">{s.playerName}</TableCell>
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
                    <SaveForm action={deleteOppPlayerStatLine} successText={`${s.playerName}'s line deleted`}>
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="gameId" value={gameId} />
                      <input type="hidden" name="oppStatId" value={s.id} />
                      <ConfirmButton type="submit" variant="ghost" size="sm" message={`Delete ${s.playerName}'s stat line?`}>
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

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? `Edit ${editingRow.playerName}` : `Add ${oppName} player line`}
            </DialogTitle>
            <DialogDescription>
              {editingRow
                ? "Update this opponent player's stats for the game. Blank fields save as 0."
                : `Record a stat line for one of ${oppName}'s players. Blank fields save as 0.`}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <SaveForm
              key={editingRow ? `edit-${editingRow.id}` : "add"}
              action={async (formData) => {
                await upsertOppPlayerStatLine(formData);
                setEditing(null);
                router.refresh();
              }}
              successText={editingRow ? "Stat line saved" : "Stat line added"}
              className="contents"
            >
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="gameId" value={gameId} />
              {editingRow && <input type="hidden" name="oppStatId" value={editingRow.id} />}
              <DialogBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Player name</span>
                    <Input name="playerName" defaultValue={editingRow?.playerName ?? ""} required />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Position</span>
                    <Input name="position" defaultValue={editingRow?.position ?? ""} placeholder="QB" maxLength={8} />
                  </label>
                </div>
                <StatFieldGroups
                  groups={PLAYER_STAT_GROUPS}
                  values={editingRow?.values}
                  idPrefix="opp-pl"
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
