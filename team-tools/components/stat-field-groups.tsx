"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDuration,
  formatPct,
  type DerivedPct,
  type StatGroup,
} from "@/lib/stat-fields";

/**
 * Grouped number inputs for a set of stat fields, with any derived percentages
 * (Comp %, FG %, 3rd Down %, …) rendered INLINE as read-only cells inside the
 * group they belong to. Percentages recompute live as their attempts/made
 * inputs change. `values` prefills when editing; blank inputs submit as 0.
 */
export function StatFieldGroups({
  groups,
  values,
  idPrefix,
  pcts = [],
}: {
  groups: StatGroup[];
  /** Prefill values keyed by stat-field name. Accepts any record (e.g. a full
   *  Prisma stat row) — only the declared stat fields are read. */
  values?: Record<string, unknown>;
  idPrefix: string;
  pcts?: DerivedPct[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rates, setRates] = useState<Record<string, string>>({});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const compute = () => {
      const val = (name: string) =>
        Number(
          (root.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value || 0,
        );
      const next: Record<string, string> = {};
      for (const p of pcts) next[p.label] = formatPct(val(p.num), val(p.den));
      setRates(next);
    };
    compute();
    root.addEventListener("input", compute);
    return () => root.removeEventListener("input", compute);
  }, [pcts]);

  return (
    <div ref={ref} className="space-y-3">
      {groups.map((group) => {
        const groupPcts = pcts.filter((p) => p.group === group.title);
        return (
          <fieldset key={group.title} className="rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {group.fields.map((f) => {
                const id = `${idPrefix}-${f.name}`;
                const raw = values?.[f.name];
                const v = raw == null ? null : Number(raw);
                const isDuration = f.format === "duration";
                return (
                  <div key={f.name} className="grid gap-1">
                    <Label htmlFor={id} className="text-xs text-muted-foreground">
                      {f.label}
                    </Label>
                    <Input
                      id={id}
                      name={f.name}
                      type={isDuration ? "text" : "number"}
                      inputMode={isDuration ? "numeric" : undefined}
                      step={isDuration ? undefined : f.float ? "0.5" : "1"}
                      defaultValue={
                        isDuration
                          ? v != null
                            ? formatDuration(v)
                            : ""
                          : (v ?? "")
                      }
                      placeholder={isDuration ? "mm:ss" : "0"}
                      className="h-8"
                    />
                  </div>
                );
              })}
              {groupPcts.map((p) => (
                <div key={p.label} className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                  <div className="flex h-8 items-center rounded-md border border-dashed border-input bg-muted/40 px-2 text-sm font-medium tabular-nums text-muted-foreground">
                    {rates[p.label] ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
