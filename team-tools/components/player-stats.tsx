"use client";

import { useState } from "react";
import {
  StatCategoryTables,
  toBoxLine,
} from "@/components/box-score/stat-category-tables";

export type SeasonStat = {
  seasonId: number;
  seasonName: string;
  startYear: number;
  position: string;
  className: string;
  number: number | null;
  values: Record<string, number>;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PlayerStats({
  career,
  seasons,
}: {
  career: Record<string, number>;
  seasons: SeasonStat[];
}) {
  // Default the season picker to the player's most recent season.
  const latestId = seasons.at(-1)?.seasonId ?? null;
  const [seasonId, setSeasonId] = useState<number | null>(latestId);
  const selected =
    seasons.find((s) => s.seasonId === seasonId) ?? seasons.at(-1) ?? null;
  const seasonOptions = [...seasons].reverse(); // latest first in the dropdown

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">Career Stats</h2>
        <StatCategoryTables line={toBoxLine(career)} />
      </section>

      <div className="border-t border-border" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow !text-foreground">Season Stats</h2>
          {seasons.length > 0 && (
            <select
              value={seasonId ?? ""}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className={selectClass}
              aria-label="Select season"
            >
              {seasonOptions.map((s) => (
                <option key={s.seasonId} value={s.seasonId}>
                  {s.seasonName}
                </option>
              ))}
            </select>
          )}
        </div>
        {selected ? (
          <>
            <p className="text-sm text-muted-foreground">
              {selected.position} · {selected.className}
              {selected.number != null ? ` · #${selected.number}` : ""}
            </p>
            <StatCategoryTables
              line={toBoxLine(selected.values)}
              emptyText="No stats recorded this season."
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No seasons on record.</p>
        )}
      </section>
    </div>
  );
}
