"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Season dropdown for the Team Stats page. Navigating swaps the whole page to
 * the chosen season while keeping the active sub-tab (Players / Team).
 */
export function SeasonPicker({
  seasonId,
  tab,
  seasons,
}: {
  seasonId: number;
  tab: "players" | "team";
  seasons: { id: number; name: string }[];
}) {
  const router = useRouter();
  const query = tab === "team" ? "?tab=team" : "";
  return (
    <select
      value={seasonId}
      onChange={(e) => router.push(`/seasons/${e.target.value}/stats${query}`)}
      aria-label="Select season"
      className={cn(
        "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
