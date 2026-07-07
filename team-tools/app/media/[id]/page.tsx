import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { MarkViewed } from "@/components/media/mark-viewed";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIA_STATUS_LABELS, MEDIA_SCOPE_LABELS } from "@/lib/media/constants";
import { updateMedia, deleteMedia, regenerateMedia } from "../actions";

const textareaClass =
  "min-h-80 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export const dynamic = "force-dynamic";

export default async function MediaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const isEdit = (await searchParams).mode === "edit";
  const basePath = `/media/${id}`;

  const media = await db.media.findUnique({
    where: { id },
    include: {
      player: { select: { id: true, name: true } },
      game: { select: { id: true, opponent: true, week: true, seasonId: true, season: { select: { name: true } } } },
      season: { select: { id: true, name: true } },
      authorPersona: { select: { name: true } },
    },
    omit: { photo: true },
  });
  if (!media) notFound();

  const [{ has: hasPhoto }] = await db.$queryRaw<{ has: boolean }[]>`
    SELECT photo IS NOT NULL AS has FROM media WHERE id = ${id}`;

  // Subject: where this piece points back to, and the season it belongs to.
  let subjectHref: string | null = null;
  let subjectLabel = "—";
  let seasonId: number | null = null;
  if (media.scope === "PLAYER" && media.player) {
    subjectHref = `/players/${media.player.id}`;
    subjectLabel = media.player.name;
  } else if (media.scope === "GAME" && media.game) {
    seasonId = media.game.seasonId;
    subjectHref = `/seasons/${media.game.seasonId}/schedule/${media.game.id}/box-score`;
    subjectLabel = `Caddo State vs ${media.game.opponent}${media.game.week != null ? ` · Wk ${media.game.week}` : ""} (${media.game.season.name})`;
  } else if (media.scope === "TEAM" && media.season) {
    seasonId = media.season.id;
    subjectHref = `/seasons/${media.season.id}`;
    subjectLabel = media.season.name;
  }

  // "See more" — other ready pieces about the same subject.
  const anchor =
    media.scope === "PLAYER"
      ? { playerId: media.playerId }
      : media.scope === "GAME"
        ? { gameId: media.gameId }
        : { seasonId: media.seasonId };
  const related = media.playerId || media.gameId || media.seasonId
    ? await db.media.findMany({
        where: { ...anchor, status: "READY", id: { not: id } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, headline: true, createdAt: true },
      })
    : [];

  const ready = media.status === "READY";
  const paragraphs = (media.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <MarkViewed id={id} viewed={media.viewed} />

      <div className="flex items-center justify-between">
        <Link href="/media" className="text-sm text-muted-foreground hover:text-foreground">
          ← Media
        </Link>
        {ready && (
          isEdit ? (
            <Link href={basePath} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Done
            </Link>
          ) : (
            <Link href={`${basePath}?mode=edit`} className={buttonVariants({ size: "sm" })}>
              Edit
            </Link>
          )
        )}
      </div>

      {/* Meta line: scope · subject · byline */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-bold uppercase tracking-wide text-primary">
          {MEDIA_SCOPE_LABELS[media.scope]}
        </span>
        <span>·</span>
        {subjectHref ? (
          <Link href={subjectHref} className="hover:text-foreground">
            {subjectLabel}
          </Link>
        ) : (
          <span>{subjectLabel}</span>
        )}
        {media.authorPersona && (
          <>
            <span>·</span>
            <span>By {media.authorPersona.name}</span>
          </>
        )}
      </div>

      {/* Not-yet-ready states */}
      {!ready && (
        <div className="rounded-md border bg-card p-6">
          {media.status === "FAILED" ? (
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-red-700">Generation failed</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {media.genError ?? "The model didn't return an article."}
                </p>
              </div>
              <SaveForm action={regenerateMedia} successText="Re-queued">
                <input type="hidden" name="id" value={id} />
                <Button type="submit" size="sm">Try again</Button>
              </SaveForm>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold">{MEDIA_STATUS_LABELS[media.status]}</div>
              <p className="text-sm text-muted-foreground">
                The article is being written in the background. Refresh in a moment.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Read view: Picture → Headline → Body → See more */}
      {ready && !isEdit && (
        <article className="space-y-5">
          {hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/media/${id}/photo?v=${media.updatedAt.getTime()}`}
              alt=""
              className="w-full rounded-md border object-cover"
            />
          )}
          <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {media.headline}
          </h1>
          <div className="space-y-4 text-[0.95rem] leading-relaxed text-foreground/90">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap">{p}</p>
            ))}
          </div>

          {related.length > 0 && (
            <section className="space-y-3 border-t pt-5">
              <h2 className="eyebrow !text-foreground">See more</h2>
              <div className="overflow-hidden rounded-md border bg-card">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/media/${r.id}`}
                    className="block border-b px-4 py-3 text-sm font-medium last:border-0 hover:bg-accent"
                  >
                    {r.headline}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      )}

      {/* Edit view */}
      {ready && isEdit && (
        <SaveForm action={updateMedia} successText="Article saved" className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-2">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" name="headline" defaultValue={media.headline ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Body</Label>
            <textarea id="body" name="body" defaultValue={media.body ?? ""} className={textareaClass} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="photo">Header image (PNG)</Label>
            <input id="photo" name="photo" type="file" accept="image/png" className="text-sm" />
            {hasPhoto && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="removePhoto" /> Remove current image
              </label>
            )}
          </div>
          <Button type="submit">Save article</Button>
        </SaveForm>
      )}

      {/* Delete (always available) */}
      <div className="border-t pt-5">
        <SaveForm action={deleteMedia} successText="Deleted">
          <input type="hidden" name="id" value={id} />
          {seasonId != null && <input type="hidden" name="seasonId" value={seasonId} />}
          <ConfirmSubmit
            message="Delete this article? This can't be undone."
            className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
          >
            Delete article
          </ConfirmSubmit>
        </SaveForm>
      </div>
    </div>
  );
}
