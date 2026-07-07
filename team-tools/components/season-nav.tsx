import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tabs to switch between a season's Home, Roster, Schedule, and Team Stats. */
export function SeasonNav({
  seasonId,
  active,
}: {
  seasonId: number;
  active: "home" | "roster" | "schedule" | "stats" | "media";
}) {
  const tabs = [
    { key: "home", label: "Home", href: `/seasons/${seasonId}` },
    { key: "roster", label: "Roster", href: `/seasons/${seasonId}/roster` },
    { key: "schedule", label: "Schedule", href: `/seasons/${seasonId}/schedule` },
    { key: "stats", label: "Team Stats", href: `/seasons/${seasonId}/stats` },
    { key: "media", label: "Media", href: `/seasons/${seasonId}/media` },
  ] as const;

  return (
    <nav className="mt-2 flex gap-1 border-b text-xs font-bold uppercase tracking-wide">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 pb-2 text-muted-foreground transition-colors hover:text-foreground",
            active === t.key
              ? "border-[var(--brand-gold)] text-foreground"
              : "hover:border-[var(--brand-gold)]",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
