import { Radio, Trash2, Clock, RotateCw } from "lucide-react";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button } from "@/components/ui/button";
import { deleteMedia, regenerateMedia } from "@/app/media/actions";
import { MEDIA_STATUS_LABELS } from "@/lib/media/constants";
import type { AudioPost } from "@/lib/media/audio-feed";

function duration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Card({ post }: { post: AudioPost }) {
  return (
    <article className="rounded-md border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Radio className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-bold">{post.headline ?? "Radio segment"}</span>
            {post.seconds != null && post.status === "READY" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {duration(post.seconds)}
              </span>
            )}
            <span className="ml-auto">
              <SaveForm action={deleteMedia} successText="Segment deleted">
                <input type="hidden" name="id" value={post.id} />
                {post.seasonId != null && <input type="hidden" name="seasonId" value={post.seasonId} />}
                <ConfirmSubmit
                  message="Delete this audio segment?"
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmSubmit>
              </SaveForm>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {post.authorName} · {post.createdAt}
          </div>

          {post.status === "FAILED" ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm italic text-red-700">
                {post.genError ?? "Failed to produce audio."}
              </p>
              <SaveForm action={regenerateMedia} successText="Re-queued">
                <input type="hidden" name="id" value={post.id} />
                <Button type="submit" variant="outline" size="sm">
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </SaveForm>
            </div>
          ) : post.status !== "READY" ? (
            <p className="mt-2 text-sm italic text-muted-foreground">
              {MEDIA_STATUS_LABELS[post.status]}
            </p>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                preload="none"
                src={`/media/${post.id}/audio?v=${post.updatedAtMs}`}
                className="mt-3 w-full"
              />
              {post.transcript && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Transcript
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{post.transcript}</p>
                </details>
              )}
              {post.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-primary">
                  {post.hashtags.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** The feed of AUDIO (radio monologue) media, each with a player + transcript. */
export function AudioFeed({ posts }: { posts: AudioPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        No audio yet. Use <span className="font-medium">New post</span> and pick the
        <span className="font-medium"> Audio</span> media type to generate a radio segment.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id} post={p} />
      ))}
    </div>
  );
}
