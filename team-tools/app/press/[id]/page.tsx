import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { PressAnswerForm } from "@/components/press-answer-form";
import { PRESS_TYPE_LABELS } from "@/lib/media/press-conference";
import { finishPressConference } from "../actions";

export const dynamic = "force-dynamic";

export default async function PressConferenceRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const conf = await db.pressConference.findUnique({
    where: { id },
    include: {
      // Exclude the audio bytes from the page payload; presence is fetched below.
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, personaName: true, question: true, answer: true, isFollowUp: true },
      },
      player: { select: { name: true } },
      staff: { select: { name: true } },
      game: { select: { opponent: true, week: true } },
      season: { select: { name: true } },
    },
  });
  if (!conf) notFound();

  // Which questions have spoken audio (ids only — no bytes).
  const audioIds = conf.speakQuestions
    ? new Set(
        (
          await db.pressConferenceQuestion.findMany({
            where: { conferenceId: id, NOT: { audio: null } },
            select: { id: true },
          })
        ).map((q) => q.id),
      )
    : new Set<number>();

  const subjectName = conf.player?.name ?? conf.staff?.name ?? "Caddo State";
  const occasion = conf.game
    ? `vs ${conf.game.opponent}${conf.game.week != null ? ` (Wk ${conf.game.week})` : ""}`
    : conf.season
      ? conf.season.name
      : "";
  const answered = conf.questions.filter((q) => q.answer != null);
  const pending = conf.questions.find((q) => q.answer == null);
  const done = conf.status === "DONE";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/media" className="text-sm text-muted-foreground hover:text-foreground">
          ← Media
        </Link>
        <div className="eyebrow mt-1">
          {PRESS_TYPE_LABELS[conf.type]} press conference · {occasion}
        </div>
        <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          {subjectName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {answered.length} of up to {conf.maxTotal} questions answered.
        </p>
      </div>

      {/* Transcript so far */}
      {answered.length > 0 && (
        <div className="space-y-4">
          {answered.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-sm">
                <span className="font-semibold text-primary">{q.personaName}:</span>{" "}
                {q.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up) </span>}
                {q.question}
              </p>
              {audioIds.has(q.id) && (
                <audio controls src={`/press/question/${q.id}/audio`} className="h-8 w-full max-w-sm" />
              )}
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="font-semibold">{subjectName}:</span> {q.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {done ? (
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            This press conference has been published.
          </p>
          {conf.mediaId && (
            <Link href={`/media/${conf.mediaId}`} className={buttonVariants({ size: "sm" }) + " mt-3"}>
              View transcript →
            </Link>
          )}
        </div>
      ) : pending ? (
        <div className="rounded-md border bg-card p-4">
          <p className="mb-2 text-sm">
            <span className="font-semibold text-primary">{pending.personaName}:</span>{" "}
            {pending.isFollowUp && <span className="text-xs text-muted-foreground">(follow-up) </span>}
            {pending.question}
          </p>
          {audioIds.has(pending.id) && (
            <audio controls autoPlay src={`/press/question/${pending.id}/audio`} className="mb-3 h-8 w-full max-w-sm" />
          )}
          <PressAnswerForm key={pending.id} conferenceId={conf.id} questionId={pending.id} subjectName={subjectName} />
          {answered.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <FinishButton confId={conf.id} variant="ghost" label="Finish here & publish" />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {answered.length > 0
              ? "That's a wrap — no more questions. Publish the transcript?"
              : "No questions were generated. You can retry from a new press conference."}
          </p>
          {answered.length > 0 && <FinishButton confId={conf.id} label="Finish & publish" />}
        </div>
      )}
    </div>
  );
}

function FinishButton({
  confId,
  label,
  variant,
}: {
  confId: number;
  label: string;
  variant?: "ghost";
}) {
  return (
    <SaveForm action={finishPressConference} loadingText="Publishing…" successText="Published">
      <input type="hidden" name="conferenceId" value={confId} />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </SaveForm>
  );
}
