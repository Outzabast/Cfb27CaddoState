import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tabs to switch between a season's Roster and Schedule. */
export function SeasonNav({
  seasonId,
  active,
}: {
  seasonId: number;
  active: "roster" | "schedule";
}) {
  const tabs = [
    { key: "roster", label: "Roster", href: `/seasons/${seasonId}/roster` },
    { key: "schedule", label: "Schedule", href: `/seasons/${seasonId}/schedule` },
  ] as const;

  return (
    <nav className="mt-2 flex gap-4 border-b text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2 text-muted-foreground hover:text-foreground",
            active === t.key && "border-foreground font-medium text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
