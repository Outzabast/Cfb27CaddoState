"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { loadPlayersPage } from "@/app/players/actions";
import type {
  PlayerFilters,
  PlayerListItem,
  PlayerSort,
  PlayerSortKey,
  SortDir,
} from "@/lib/players-query";

const PAGE_SIZES = [25, 50, 100];
const STORAGE_KEY = "players.columns.v1";

type Column = {
  key: PlayerSortKey;
  label: string;
  align?: "right";
  defaultVisible: boolean;
  render: (p: PlayerListItem) => React.ReactNode;
};

// Name is always shown (it's the row link) and lives outside this list.
const COLUMNS: Column[] = [
  { key: "current", label: "Current", align: "right", defaultVisible: true, render: (p) => p.current ?? "—" },
  { key: "program", label: "Program", align: "right", defaultVisible: true, render: (p) => p.program },
  { key: "position", label: "Pos", defaultVisible: false, render: (p) => p.position ?? "—" },
  { key: "class", label: "Class", defaultVisible: false, render: (p) => p.class ?? "—" },
  { key: "number", label: "#", align: "right", defaultVisible: false, render: (p) => p.number ?? "—" },
  { key: "starter", label: "Starter", defaultVisible: false, render: (p) => (p.starter ? "Yes" : "—") },
  { key: "status", label: "Status", defaultVisible: false, render: (p) => p.status },
];

// Text columns read best ascending; numeric/notoriety columns descending.
const DEFAULT_DIR: Record<PlayerSortKey, SortDir> = {
  name: "asc",
  program: "desc",
  current: "desc",
  position: "asc",
  class: "asc",
  number: "asc",
  starter: "desc",
  status: "asc",
};

const defaultVisible = () => new Set<PlayerSortKey>(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

/** Paginated, sortable player table. Filters come from the page's GET form and
 *  are echoed on each fetch; sorting + paging happen server-side. */
export function PlayerList({
  filters,
  initialItems,
  initialOffset,
  initialSort,
}: {
  filters: PlayerFilters;
  initialItems: PlayerListItem[];
  initialOffset: number | null;
  initialSort: PlayerSort;
}) {
  const [items, setItems] = useState(initialItems);
  const [offset, setOffset] = useState(initialOffset);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<PlayerSort>(initialSort);
  const [visible, setVisible] = useState<Set<PlayerSortKey>>(defaultVisible);
  const [colsOpen, setColsOpen] = useState(false);

  // Restore saved column choices after mount. Reading localStorage must happen
  // post-mount (not in a lazy initializer) or SSR/client hydration would mismatch,
  // so a one-time setState in this effect is the intended pattern here.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const keys = JSON.parse(raw) as string[];
      const valid = keys.filter((k) => COLUMNS.some((c) => c.key === k)) as PlayerSortKey[];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (valid.length) setVisible(new Set(valid));
    } catch {
      /* ignore bad/absent storage */
    }
  }, []);

  const persist = (next: Set<PlayerSortKey>) => {
    setVisible(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const shownColumns = COLUMNS.filter((c) => visible.has(c.key));

  // Re-fetch from the top whenever the sort changes.
  async function applySort(key: PlayerSortKey) {
    const next: PlayerSort =
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DEFAULT_DIR[key] };
    setSort(next);
    setLoading(true);
    try {
      const page = await loadPlayersPage(filters, next, 0, pageSize);
      setItems(page.items);
      setOffset(page.nextOffset);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sort.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (offset == null) return;
    setLoading(true);
    try {
      const page = await loadPlayersPage(filters, sort, offset, pageSize);
      setItems((prev) => [...prev, ...page.items]);
      setOffset(page.nextOffset);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  }

  const arrow = (key: PlayerSortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ColumnMenu open={colsOpen} setOpen={setColsOpen} visible={visible} onToggle={persist} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players match.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <SortHeader label={`Name${arrow("name")}`} onClick={() => applySort("name")} />
                {shownColumns.map((c) => (
                  <SortHeader
                    key={c.key}
                    label={`${c.label}${arrow(c.key)}`}
                    align={c.align}
                    onClick={() => applySort(c.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  {shownColumns.map((c) => (
                    <td
                      key={c.key}
                      className={
                        "px-4 py-2.5 text-muted-foreground" + (c.align === "right" ? " text-right tabular-nums" : "")
                      }
                    >
                      {c.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {offset != null && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm shadow-xs outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  align,
  onClick,
}: {
  label: string;
  align?: "right";
  onClick: () => void;
}) {
  return (
    <th className={"px-4 py-2.5" + (align === "right" ? " text-right" : "")}>
      <button
        type="button"
        onClick={onClick}
        className="text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {label}
      </button>
    </th>
  );
}

function ColumnMenu({
  open,
  setOpen,
  visible,
  onToggle,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  visible: Set<PlayerSortKey>;
  onToggle: (next: Set<PlayerSortKey>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, setOpen]);

  const toggle = (key: PlayerSortKey) => {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onToggle(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        Columns ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-popover p-2 shadow-md">
          {COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input type="checkbox" checked={visible.has(c.key)} onChange={() => toggle(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
