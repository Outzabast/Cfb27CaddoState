"use client";

import { useMemo, useState } from "react";
import type { PlayerStatus } from "@/generated/prisma/enums";

export type PlayerOption = {
  id: number;
  name: string;
  position?: string | null;
  status?: PlayerStatus;
};

const controlClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A filterable checkbox list of players, emitting a repeated form field (`name`).
 * Defaults to active players only (hides graduated/transferred) and filters by
 * name + position — a roster is 70+ deep, so scanning the whole list is painful.
 * Default none selected.
 */
export function PlayerMultiSelect({
  players,
  name,
  label,
}: {
  players: PlayerOption[];
  name: string;
  label?: string;
}) {
  const [filter, setFilter] = useState("");
  const [position, setPosition] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter((p): p is string => !!p))].sort(),
    [players],
  );

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return players.filter(
      (p) =>
        (!activeOnly || p.status !== "POSTACTIVE") &&
        (!position || p.position === position) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [players, filter, position, activeOnly]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-1.5">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label} {selected.size > 0 && <span className="text-foreground">· {selected.size} selected</span>}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name…"
          className={`${controlClass} min-w-40 flex-1`}
        />
        {positions.length > 0 && (
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={controlClass}
            aria-label="Filter by position"
          >
            <option value="">All positions</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border p-1">
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">No players match.</p>
        ) : (
          shown.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                name={name}
                value={p.id}
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="flex-1">{p.name}</span>
              {p.position && <span className="text-xs text-muted-foreground">{p.position}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
