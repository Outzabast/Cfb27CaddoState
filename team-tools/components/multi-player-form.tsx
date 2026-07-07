"use client";

import { useState } from "react";
import { addPlayersToRoster } from "@/app/seasons/[id]/roster/actions";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const gridCols = "grid grid-cols-[1fr_4.5rem_5.5rem_11rem_2rem] gap-2";

export function MultiPlayerForm({ seasonId }: { seasonId: number }) {
  const [rowIds, setRowIds] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  const addRow = () => {
    setRowIds((r) => [...r, nextId]);
    setNextId((n) => n + 1);
  };
  const removeRow = (id: number) =>
    setRowIds((r) => (r.length > 1 ? r.filter((x) => x !== id) : r));

  return (
    <SaveForm
      action={addPlayersToRoster}
      successText="Players added"
      className="space-y-2"
    >
      <input type="hidden" name="seasonId" value={seasonId} />

      <div className={`${gridCols} px-1 text-xs font-medium text-muted-foreground`}>
        <span>Name</span>
        <span>Number</span>
        <span>Position</span>
        <span>Class</span>
        <span />
      </div>

      {rowIds.map((id) => (
        <div key={id} className={gridCols}>
          <Input name="name" placeholder="Bryce Joiner" />
          <Input name="number" type="number" placeholder="#" />
          <Input name="position" maxLength={8} placeholder="QB" />
          <select name="class" defaultValue="FRESHMAN" className={selectClass}>
            {classOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove row"
            onClick={() => removeRow(id)}
          >
            ✕
          </Button>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Add row
        </Button>
        <Button type="submit">Add to roster</Button>
      </div>
    </SaveForm>
  );
}
