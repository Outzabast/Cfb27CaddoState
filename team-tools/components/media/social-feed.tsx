import { Heart, MessageCircle, Repeat2, BadgeCheck, Trash2, RotateCw } from "lucide-react";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { Button } from "@/components/ui/button";
import { deleteMedia, regenerateMedia } from "@/app/media/actions";
import { MEDIA_STATUS_LABELS } from "@/lib/media/constants";
import type { SocialPost, FeedReply } from "@/lib/media/social-feed";

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary ${className}`}
    >
      {initials(name)}
    </div>
  );
}

function Reply({ r }: { r: FeedReply }) {
  return (
    <div className="flex gap-2 py-2">
      <Avatar name={r.name} className="h-8 w-8 text-[0.7rem]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <span className="font-semibold">{r.name}</span>
          {r.isPersona && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
          <span className="text-muted-foreground">{r.handle}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{r.body}</p>
        {r.likes > 0 && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" /> {r.likes}
          </div>
        )}
      </div>
    </div>
  );
}

export function SocialPostCard({ post }: { post: SocialPost }) {
  return (
    <article className="rounded-md border bg-card p-4">
      <div className="flex gap-3">
        <Avatar name={post.authorName} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-bold">{post.authorName}</span>
            <BadgeCheck className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {post.authorHandle} · {post.createdAt}
            </span>
            <span className="ml-auto">
              <SaveForm action={deleteMedia} successText="Post deleted">
                <input type="hidden" name="id" value={post.id} />
                {post.seasonId != null && <input type="hidden" name="seasonId" value={post.seasonId} />}
                <ConfirmSubmit
                  message="Delete this post and its replies?"
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmSubmit>
              </SaveForm>
            </span>
          </div>

          {post.status === "FAILED" ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm italic text-red-700">{post.genError ?? "Failed to post."}</p>
              <SaveForm action={regenerateMedia} successText="Re-queued">
                <input type="hidden" name="id" value={post.id} />
                <Button type="submit" variant="outline" size="sm">
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </SaveForm>
            </div>
          ) : post.status !== "READY" ? (
            <p className="mt-1 text-sm italic text-muted-foreground">
              {MEDIA_STATUS_LABELS[post.status]}
            </p>
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-[0.95rem]">{post.body}</p>
              {post.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-primary">
                  {post.hashtags.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> {post.replies.length}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 className="h-3.5 w-3.5" />
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                </span>
              </div>
            </>
          )}

          {post.replies.length > 0 && (
            <div className="mt-2 divide-y border-t pt-1">
              {post.replies.map((r) => (
                <Reply key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** The X-style feed of social posts (XPOST media) with hashtags + reply threads.
 *  `scroll` caps the height and scrolls internally (for embeds on other pages). */
export function SocialFeed({ posts, scroll = false }: { posts: SocialPost[]; scroll?: boolean }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        No social posts yet. Use <span className="font-medium">New post</span> and pick the
        <span className="font-medium"> Social</span> media type to generate one.
      </div>
    );
  }
  const list = (
    <div className="space-y-3">
      {posts.map((p) => (
        <SocialPostCard key={p.id} post={p} />
      ))}
    </div>
  );
  if (!scroll) return list;
  return (
    <div className="max-h-[34rem] overflow-y-auto rounded-md border bg-muted/20 p-2">{list}</div>
  );
}
