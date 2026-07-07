import {
  formatDuration,
  formatPct,
  type DerivedPct,
  type StatGroup,
} from "@/lib/stat-fields";

/**
 * Read-only grouped display of aggregated stats, with auto-calculated
 * percentages appended. Used by the team and player stats pages.
 */
export function StatDisplay({
  groups,
  values,
  pcts,
}: {
  groups: StatGroup[];
  values: Record<string, number>;
  pcts?: DerivedPct[];
}) {
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupPcts = (pcts ?? []).filter((p) => p.group === group.title);
        return (
          <fieldset key={group.title} className="rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </legend>
            <dl className="grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-4 md:grid-cols-6">
              {group.fields.map((f) => (
                <div key={f.name} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {f.format === "duration"
                      ? formatDuration(values[f.name] ?? 0)
                      : (values[f.name] ?? 0)}
                  </dd>
                </div>
              ))}
              {groupPcts.map((p) => (
                <div key={p.label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{p.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatPct(values[p.num] ?? 0, values[p.den] ?? 0)}
                  </dd>
                </div>
              ))}
            </dl>
          </fieldset>
        );
      })}
    </div>
  );
}
