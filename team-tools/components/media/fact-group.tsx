import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FACT_AUTOINJECT_THRESHOLD } from "@/lib/media/constants";
import type { FactEditRow } from "@/lib/media/facts";
import type { FactScope } from "@/generated/prisma/enums";
import { createFact, updateFact, deleteFact } from "@/app/facts/actions";

const textareaClass =
  "min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Editor for one standing-fact layer. Reused by the team home, season edit, and
 * roster edit pages. `revalidate` is the calling page's path (so the list
 * refreshes in place); `seasonId` scopes SEASON/ROSTER facts (omit for TEAM).
 */
export function FactGroup({
  scope,
  title,
  blurb,
  facts,
  seasonId,
  revalidate,
  disabled,
  disabledNote,
}: {
  scope: FactScope;
  title: string;
  blurb: string;
  facts: FactEditRow[];
  seasonId?: number | null;
  revalidate: string;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const seasonField =
    seasonId != null ? <input type="hidden" name="seasonId" value={seasonId} /> : null;

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Rated {FACT_AUTOINJECT_THRESHOLD}+ inject into every relevant piece; lower
          stay researchable on demand.
        </p>
      </div>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">{blurb}</p>

      {disabled ? (
        <p className="text-sm text-muted-foreground italic">{disabledNote}</p>
      ) : (
        <div className="space-y-3">
          {facts.map((f) => {
            const injected = f.active && f.importance >= FACT_AUTOINJECT_THRESHOLD;
            return (
              <div key={f.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <SaveForm action={updateFact} successText="Fact saved" className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="sortOrder" value={f.sortOrder} />
                  <input type="hidden" name="_revalidate" value={revalidate} />
                  <textarea name="body" defaultValue={f.body} className={textareaClass + " w-full flex-1"} />
                  <div className="flex w-full flex-row flex-wrap items-center justify-end gap-2 sm:w-36 sm:flex-col sm:items-end">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (injected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                      }
                    >
                      {injected ? "Injected" : "On demand"}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Importance
                      <Input type="number" name="importance" min={0} max={100} defaultValue={f.importance} className="h-8 w-16" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" name="active" defaultChecked={f.active} /> Active
                    </label>
                    <Button type="submit" size="sm" variant="secondary">Save</Button>
                  </div>
                </SaveForm>
                <SaveForm action={deleteFact} successText="Fact deleted" className="pt-1">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="_revalidate" value={revalidate} />
                  <ConfirmSubmit
                    message="Delete this fact?"
                    className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
                  >
                    Delete
                  </ConfirmSubmit>
                </SaveForm>
              </div>
            );
          })}
          {facts.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No {title.toLowerCase()} facts yet.</p>
          )}

          <SaveForm action={createFact} successText="Fact added" className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-start">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="_revalidate" value={revalidate} />
            {seasonField}
            <textarea name="body" placeholder={`Add a ${title.toLowerCase()} fact…`} className={textareaClass + " w-full flex-1"} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Importance
                <Input type="number" name="importance" min={0} max={100} defaultValue={50} className="h-8 w-16" />
              </label>
              <Button type="submit" size="sm">Add</Button>
            </div>
          </SaveForm>
        </div>
      )}
    </div>
  );
}
