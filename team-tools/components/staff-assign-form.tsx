"use client";

import { useState } from "react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSeasonStaff } from "@/app/staff/actions";
import type { StaffRole } from "@/generated/prisma/enums";

export type StaffOption = { id: number; name: string };

const selectClass =
  "h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Assign a coach to an open role: either pick an EXISTING staff record from the
 * dropdown (coaches from prior seasons — how you recover a mis-cleared staff) or
 * add a brand-new one by name. Starts on "existing" when any records exist.
 */
export function StaffAssignForm({
  seasonId,
  role,
  existing,
}: {
  seasonId: number;
  role: StaffRole;
  existing: StaffOption[];
}) {
  const [mode, setMode] = useState<"existing" | "new">(existing.length ? "existing" : "new");

  return (
    <SaveForm action={addSeasonStaff} successText="Assigned" className="flex items-center gap-2">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="role" value={role} />

      {mode === "existing" && existing.length > 0 ? (
        <>
          <select name="staffId" className={selectClass} defaultValue={existing[0].id} aria-label="Existing staff">
            {existing.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMode("new")}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            + New
          </button>
        </>
      ) : (
        <>
          <Input name="name" placeholder="New coach name…" className="h-8 flex-1" />
          {existing.length > 0 && (
            <button
              type="button"
              onClick={() => setMode("existing")}
              className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Existing
            </button>
          )}
        </>
      )}

      <Button type="submit" size="sm" variant="secondary">
        Assign
      </Button>
    </SaveForm>
  );
}
