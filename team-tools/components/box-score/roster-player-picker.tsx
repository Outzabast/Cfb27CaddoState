"use client";

import { useMemo, useState } from "react";

export type RosterPick = { playerId: number; name: string; position: string };

const controlClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const listClass =
  "w-full rounded-md border border-input bg-transparent p-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Filterable single-player picker for the box-score "Add player line" form.
 * Search by name + filter by position, then select one. Submits `name`
 * (default "playerId"); required, so a player must be chosen.
 */
export function RosterPlayerPicker({
  players,
  name = "playerId",
}: {
  players: RosterPick[];
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("");
  const [selected, setSelected] = useState("");

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter(Boolean))].sort(),
    [players],
  );

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return players.filter(
      (p) => (!pos || p.position === pos) && (!query || p.name.toLowerCase().includes(query)),
    );
  }, [players, q, pos]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name…"
          className={`${controlClass} min-w-40 flex-1`}
        />
        {positions.length > 0 && (
          <select
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            className={controlClass}
            aria-label="Filter by position"
          >
            <option value="">All positions</option>
            {positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>
      <select
        name={name}
        required
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        size={8}
        className={listClass}
      >
        <option value="" disabled>Pick a player…</option>
        {shown.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.name} ({p.position})
          </option>
        ))}
      </select>
      {shown.length === 0 && (
        <p className="text-xs text-muted-foreground">No available players match.</p>
      )}
    </div>
  );
}
