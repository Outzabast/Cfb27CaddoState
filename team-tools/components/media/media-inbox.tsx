"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trophy, Users, User, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { bulkDeleteMedia } from "@/app/media/actions";
import { MEDIA_STATUS_LABELS, MEDIA_TYPE_LABELS } from "@/lib/media/constants";
import type { MediaGenStatus, MediaScope, MediaType } from "@/generated/prisma/enums";

export type MediaListItem = {
  id: number;
  headline: string | null;
  status: MediaGenStatus;
  scope: MediaScope;
  mediaType: MediaType;
  viewed: boolean;
  createdAt: string;
  subjectLabel: string;
  authorId: number | null;
  authorName: string | null;
  hasPhoto: boolean;
  excerpt: string | null;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const SCOPE_TAG: Record<MediaScope, string> = {
  PLAYER: "Player",
  GAME: "Game",
  TEAM: "Team",
};

// Section order + icon for the scope groupings on the media page.
const GROUPS: { scope: MediaScope; label: string; Icon: typeof Trophy }[] = [
  { scope: "GAME", label: "Games", Icon: Trophy },
  { scope: "TEAM", label: "Team", Icon: Users },
  { scope: "PLAYER", label: "Players", Icon: User },
];

function StatusPill({ status }: { status: MediaGenStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-100 text-emerald-800"
      : status === "FAILED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide", tone)}>
      {MEDIA_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * The media inbox: a selectable list of generated pieces with unviewed badges
 * and a bulk-delete escape hatch. Shared by the global (/media) and per-season
 * views; `seasonId` scopes the bulk-delete revalidation when present.
 */
export function MediaInbox({
  items,
  seasonId,
}: {
  items: MediaListItem[];
  seasonId?: number;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [authorFilter, setAuthorFilter] = useState(""); // "" = all, "none" = no byline, else persona id
  const [typeFilter, setTypeFilter] = useState("");

  // Filter options drawn from the media present (so only real authors appear).
  const authors = useMemo(() => {
    const m = new Map<number, string>();
    let hasNone = false;
    for (const it of items) {
      if (it.authorId != null && it.authorName) m.set(it.authorId, it.authorName);
      else hasNone = true;
    }
    return {
      list: [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      hasNone,
    };
  }, [items]);
  const types = useMemo(() => [...new Set(items.map((i) => i.mediaType))], [items]);

  const shown = useMemo(
    () =>
      items.filter(
        (it) =>
          (authorFilter === ""
            ? true
            : authorFilter === "none"
              ? it.authorId == null
              : it.authorId === Number(authorFilter)) &&
          (typeFilter === "" || it.mediaType === typeFilter),
      ),
    [items, authorFilter, typeFilter],
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => {
    setSelected(new Set());
    setSelecting(false);
  };

  async function onDelete(formData: FormData) {
    const t = toast.loading("Deleting…");
    try {
      await bulkDeleteMedia(formData);
      toast.success(`Deleted ${selected.size} item${selected.size === 1 ? "" : "s"}`, { id: t });
      clear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { id: t });
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        No media yet. Check &ldquo;Generate media&rdquo; when saving a box score or a
        player to write the first article.
      </div>
    );
  }

  return (
    <form action={onDelete} className="space-y-3">
      {seasonId != null && <input type="hidden" name="seasonId" value={seasonId} />}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by author"
        >
          <option value="">All authors</option>
          {authors.list.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          {authors.hasNone && <option value="none">No byline</option>}
        </select>
        {types.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {MEDIA_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        )}
        {(authorFilter || typeFilter) && (
          <button
            type="button"
            onClick={() => {
              setAuthorFilter("");
              setTypeFilter("");
            }}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {shown.length} of {items.length} item{items.length === 1 ? "" : "s"}
        </span>
        {selecting ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <button
              type="submit"
              disabled={selected.size === 0}
              onClick={(e) => {
                if (!confirm(`Delete ${selected.size} item(s)? This can't be undone.`))
                  e.preventDefault();
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSelecting(true)}
            className="rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Select
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No media matches this filter.
        </div>
      )}

      <div className="space-y-5">
        {GROUPS.map((g) => {
          const rows = shown.filter((m) => m.scope === g.scope);
          if (rows.length === 0) return null;
          return (
            <section key={g.scope} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <g.Icon className="h-3.5 w-3.5" />
                {g.label}
                <span className="font-normal normal-case">({rows.length})</span>
              </h3>
              <div className="overflow-hidden rounded-md border bg-card">
                {rows.map(renderItem)}
              </div>
            </section>
          );
        })}
      </div>
    </form>
  );

  function renderItem(m: MediaListItem) {
    const isSel = selected.has(m.id);
    const row = (
            <div
              className={cn(
                "flex items-start gap-3 border-b px-4 py-3 last:border-0",
                selecting ? "cursor-pointer hover:bg-accent" : "hover:bg-accent",
                isSel && "bg-accent",
              )}
            >
              {selecting && (
                <input
                  type="checkbox"
                  name="id"
                  value={m.id}
                  checked={isSel}
                  onChange={() => toggle(m.id)}
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!m.viewed && m.status === "READY" && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" />
                  )}
                  <span
                    className={cn(
                      "truncate font-medium",
                      !m.viewed && m.status === "READY" && "font-bold",
                    )}
                  >
                    {m.headline || (m.status === "FAILED" ? "Generation failed" : "Writing…")}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wide">{SCOPE_TAG[m.scope]}</span>
                  <span>·</span>
                  <span className="truncate">{m.subjectLabel}</span>
                  {m.authorName && (
                    <>
                      <span>·</span>
                      <span className="truncate">By {m.authorName}</span>
                    </>
                  )}
                </div>
                {m.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.excerpt}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {m.status !== "READY" && <StatusPill status={m.status} />}
                <span className="text-xs text-muted-foreground">{m.createdAt}</span>
              </div>
            </div>
    );

    // In select mode the whole row toggles; otherwise it links to the piece.
    return selecting ? (
      <div key={m.id} onClick={() => toggle(m.id)}>
        {row}
      </div>
    ) : (
      <Link key={m.id} href={`/media/${m.id}`} className="block">
        {row}
      </Link>
    );
  }
}
