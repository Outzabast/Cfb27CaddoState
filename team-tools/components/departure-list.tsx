"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type DepartureRow = {
  playerId: number;
  name: string;
  position: string;
  fromClass: string;
  toClass: string;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The offseason "Departures" list with name + position filters. Rows are HIDDEN
 * (not removed) when filtered out, so a player you've checked stays checked — and
 * still submits with the commit form — even while a filter hides them.
 */
export function DepartureList({ players }: { players: DepartureRow[] }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("");

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position))].sort(),
    [players],
  );

  const term = q.trim().toLowerCase();
  const matches = (p: DepartureRow) =>
    (!pos || p.position === pos) && (!term || p.name.toLowerCase().includes(term));
  const visible = players.filter(matches).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name…"
          className="h-9 w-48"
          aria-label="Search departing players by name"
        />
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          className={selectClass}
          aria-label="Filter by position"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {(q || pos) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setPos("");
            }}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {visible} of {players.length}
        </span>
      </div>

      <ul className="divide-y rounded-md border">
        {players.map((p) => (
          <li
            key={p.playerId}
            hidden={!matches(p)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <input type="checkbox" name="departingPlayerId" value={p.playerId} id={`dep-${p.playerId}`} />
            <label htmlFor={`dep-${p.playerId}`} className="flex-1">
              <span className="font-medium">{p.name}</span>{" "}
              <span className="text-muted-foreground">
                {p.position} · {p.fromClass} → {p.toClass}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {visible === 0 && (
        <p className="text-sm text-muted-foreground italic">No players match this filter.</p>
      )}
    </div>
  );
}
