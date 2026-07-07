import Link from "next/link";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteMediaEvent, reprocessMediaEvent } from "../actions";
import type { MediaEventStatus, MediaEventType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TYPE_LABEL: Record<MediaEventType, string> = {
  BOX_SCORE: "Box score",
  PLAYER_UPDATE: "Player update",
  MANUAL: "Manual",
};

function StatusPill({ status }: { status: MediaEventStatus }) {
  const tone =
    status === "PROCESSED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "FAILED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide", tone)}>
      {status.toLowerCase()}
    </span>
  );
}

export default async function MediaSpacePage() {
  const events = await db.mediaEvent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      player: { select: { name: true } },
      game: { select: { opponent: true, week: true } },
      season: { select: { name: true } },
      _count: { select: { media: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Caddo State</div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
            Media Space
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every post that triggered generation. Deleting an event removes the media
            it produced — the quick fix for an erroneous post.
          </p>
        </div>
        <Link href="/media" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Article inbox
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          No events yet. Posting a box-score recap or a player update shows up here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          {events.map((e) => {
            const subject =
              e.scope === "PLAYER"
                ? e.player?.name ?? "—"
                : e.scope === "GAME"
                  ? `vs ${e.game?.opponent ?? "—"}${e.game?.week != null ? ` · Wk ${e.game.week}` : ""}`
                  : e.season?.name ?? "—";
            return (
              <div key={e.id} className="flex items-start justify-between gap-3 border-b px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {TYPE_LABEL[e.type]}
                    </span>
                    <span className="truncate font-medium">{subject}</span>
                    <StatusPill status={e.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dateFmt.format(e.createdAt)} · {e._count.media} article
                    {e._count.media === 1 ? "" : "s"}
                    {e.context ? ` · “${e.context.slice(0, 80)}${e.context.length > 80 ? "…" : ""}”` : ""}
                  </div>
                  {e.status === "FAILED" && e.error && (
                    <div className="mt-1 text-xs text-red-700">{e.error}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {e.status === "FAILED" && (
                    <SaveForm action={reprocessMediaEvent} successText="Re-queued">
                      <input type="hidden" name="id" value={e.id} />
                      <Button type="submit" variant="outline" size="sm">Retry</Button>
                    </SaveForm>
                  )}
                  <SaveForm action={deleteMediaEvent} successText="Event deleted">
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmSubmit
                      message={`Delete this event and its ${e._count.media} article(s)?`}
                      className="rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
                    >
                      Delete
                    </ConfirmSubmit>
                  </SaveForm>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
