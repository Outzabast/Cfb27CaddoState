import Link from "next/link";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "@/lib/staff";
import { addSeasonStaff, removeSeasonStaff } from "@/app/staff/actions";
import type { StaffRole } from "@/generated/prisma/enums";

export type SeasonStaffRow = {
  id: number;
  staffId: number;
  staffName: string;
  role: StaffRole;
  seasonNotoriety: number;
};

/** The season's coaching staff: one slot per role, assign/remove inline. */
export function StaffSection({
  seasonId,
  staff,
}: {
  seasonId: number;
  staff: SeasonStaffRow[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="eyebrow !text-foreground">Staff</h2>
      <div className="overflow-hidden rounded-md border bg-card">
        {STAFF_ROLES.map((role) => {
          const s = staff.find((x) => x.role === role);
          return (
            <div key={role} className="border-b px-4 py-3 last:border-0">
              <div className="eyebrow mb-1">{STAFF_ROLE_LABELS[role]}</div>
              {s ? (
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/staff/${s.staffId}`} className="font-medium hover:text-primary">
                    {s.staffName}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Noto <span className="font-bold tabular-nums text-foreground">{s.seasonNotoriety}</span>
                    </span>
                    <SaveForm action={removeSeasonStaff} successText="Removed">
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="seasonStaffId" value={s.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </SaveForm>
                  </div>
                </div>
              ) : (
                <SaveForm action={addSeasonStaff} successText="Assigned" className="flex items-center gap-2">
                  <input type="hidden" name="seasonId" value={seasonId} />
                  <input type="hidden" name="role" value={role} />
                  <Input name="name" placeholder="Name…" className="h-8 flex-1" />
                  <Button type="submit" size="sm" variant="secondary">
                    Assign
                  </Button>
                </SaveForm>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
