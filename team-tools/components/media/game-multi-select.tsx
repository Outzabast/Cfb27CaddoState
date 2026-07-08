"use client";

import { useMemo, useState } from "react";

export type GameOption = { id: number; label: string };

/** A filterable checkbox list of games, emitting a repeated form field (`name`).
 *  Used to pick focus games for a player feature. Default none selected. */
export function GameMultiSelect({
  games,
  name,
  label,
}: {
  games: GameOption[];
  name: string;
  label?: string;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? games.filter((g) => g.label.toLowerCase().includes(q)) : games;
  }, [filter, games]);

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
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter games…"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="max-h-40 overflow-y-auto rounded-md border p-1">
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">No games match.</p>
        ) : (
          shown.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                name={name}
                value={g.id}
                checked={selected.has(g.id)}
                onChange={() => toggle(g.id)}
              />
              {g.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
