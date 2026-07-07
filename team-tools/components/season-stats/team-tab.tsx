import type { StatSection } from "@/lib/season-stats";

/**
 * Team tab: the season team totals laid out as ESPN-style labeled sections
 * (Scoring, Passing, Rushing, …) instead of one jumbled grid.
 */
export function TeamTab({ sections }: { sections: StatSection[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="overflow-hidden rounded-md border bg-card">
          <div className="px-4 py-2.5">
            <h3 className="eyebrow !text-foreground">{section.title}</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {section.rows.map((r, i) => (
                <tr key={`${r.label}-${i}`} className="border-t">
                  <td className="px-4 py-2 text-muted-foreground">{r.label}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
