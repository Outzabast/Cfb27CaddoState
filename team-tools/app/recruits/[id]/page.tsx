import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { ConfirmSubmit } from "@/components/media/confirm-submit";
import { RecruitForm } from "@/components/recruit-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatHeight } from "@/lib/player-profile";
import { CLASS_ORDER, CLASS_LABELS } from "@/lib/classes";
import { MEDIA_STATUS_LABELS } from "@/lib/media/constants";
import {
  RECRUIT_STATUS_LABELS,
  RECRUIT_KIND_LABELS,
  starString,
  formatRating,
  formatHometown,
} from "@/lib/recruits";
import { updateRecruit, deleteRecruit, signRecruit, generateRecruitMedia } from "../actions";

export const dynamic = "force-dynamic";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textareaClass =
  "min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function RecruitProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [recruit, seasons] = await Promise.all([
    db.recruit.findUnique({
      where: { id },
      include: {
        season: { select: { id: true, name: true } },
        player: { select: { id: true, name: true } },
        media: {
          orderBy: { createdAt: "desc" },
          select: { id: true, headline: true, status: true, mediaType: true, createdAt: true },
        },
      },
    }),
    db.season.findMany({ orderBy: { startYear: "desc" }, select: { id: true, name: true } }),
  ]);
  if (!recruit) notFound();

  const hometown = formatHometown(recruit.hometownCity, recruit.hometownState);
  const rating = formatRating(recruit.rating);
  const height = formatHeight(recruit.heightInches);
  const signed = recruit.player != null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/recruits" className="text-sm text-muted-foreground hover:text-foreground">
          ← Recruiting Board
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {recruit.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/recruits/${recruit.id}/photo`}
            alt={recruit.name}
            className="h-28 w-28 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-md border bg-muted text-3xl text-muted-foreground">
            {recruit.name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <div className="eyebrow">
            {recruit.season.name} class · {RECRUIT_KIND_LABELS[recruit.kind]}
          </div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
            {recruit.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-xl leading-none text-[var(--brand-gold)]">{starString(recruit.stars)}</span>
            <span className="text-sm font-semibold">{recruit.position}</span>
            <span
              className={
                "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                (signed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
              }
            >
              {signed ? "On roster" : RECRUIT_STATUS_LABELS[recruit.status]}
            </span>
            {signed && recruit.player && (
              <Link href={`/players/${recruit.player.id}`} className="text-sm text-primary hover:underline">
                View player →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Scouting tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {rating && <Stat label="Composite" value={rating} />}
        {recruit.nationalRank != null && <Stat label="Natl Rank" value={`#${recruit.nationalRank}`} />}
        {recruit.positionRank != null && <Stat label={`${recruit.position} Rank`} value={`#${recruit.positionRank}`} />}
        {recruit.stateRank != null && <Stat label="State Rank" value={`#${recruit.stateRank}`} />}
        {height && <Stat label="Height" value={height} />}
        {recruit.weightLbs != null && <Stat label="Weight" value={`${recruit.weightLbs} lbs`} />}
      </div>

      {(recruit.highSchool || hometown || recruit.otherOffers || recruit.bio || recruit.notes || recruit.previousSchool) && (
        <div className="space-y-2 text-sm">
          {recruit.kind === "TRANSFER" && (recruit.previousSchool || recruit.eligibilityYears != null) && (
            <p>
              <span className="font-semibold">Transfer:</span>{" "}
              {[
                recruit.previousSchool ? `from ${recruit.previousSchool}` : null,
                recruit.eligibilityYears != null ? `${recruit.eligibilityYears} yr(s) eligibility left` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {(recruit.highSchool || hometown) && (
            <p>
              <span className="font-semibold">From:</span>{" "}
              {[recruit.highSchool, hometown].filter(Boolean).join(" · ")}
            </p>
          )}
          {recruit.otherOffers && (
            <p>
              <span className="font-semibold">Other offers:</span> {recruit.otherOffers}
            </p>
          )}
          {recruit.bio && <p className="whitespace-pre-wrap text-muted-foreground">{recruit.bio}</p>}
          {recruit.notes && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              <span className="font-semibold text-foreground">Staff notes:</span> {recruit.notes}
            </p>
          )}
        </div>
      )}

      {/* Actions: sign + generate */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-1 font-semibold">Sign &amp; add to roster</h2>
          {signed ? (
            <p className="text-sm text-muted-foreground">
              Signed — now on the roster as{" "}
              {recruit.player && (
                <Link href={`/players/${recruit.player.id}`} className="text-primary hover:underline">
                  {recruit.player.name}
                </Link>
              )}
              .
            </p>
          ) : (
            <SaveForm action={signRecruit} successText="Signed to the roster" className="space-y-3">
              <input type="hidden" name="id" value={recruit.id} />
              <p className="text-sm text-muted-foreground">
                Turns this prospect into a player on the chosen season&rsquo;s roster.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="enrollSeasonId" className="text-xs">Season</Label>
                  <select id="enrollSeasonId" name="enrollSeasonId" className={selectClass} defaultValue={seasons[0]?.id}>
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="class" className="text-xs">Class</Label>
                  <select id="class" name="class" className={selectClass} defaultValue="FRESHMAN">
                    {CLASS_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {CLASS_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="number" className="text-xs">Jersey #</Label>
                  <Input id="number" name="number" type="number" />
                </div>
              </div>
              <Button type="submit" size="sm">Sign recruit</Button>
            </SaveForm>
          )}
        </div>

        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-1 font-semibold">Recruiting profile</h2>
          <SaveForm action={generateRecruitMedia} successText="Queued — watch the Media Space" className="space-y-3">
            <input type="hidden" name="id" value={recruit.id} />
            <p className="text-sm text-muted-foreground">Generate an article breaking down this prospect.</p>
            <textarea
              name="mediaContext"
              placeholder="Anything the ratings miss — visit buzz, position switch, film notes…"
              className={textareaClass}
            />
            <Button type="submit" size="sm" variant="secondary">Write profile</Button>
          </SaveForm>
        </div>
      </div>

      {/* Media about this recruit */}
      {recruit.media.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow !text-foreground">Coverage</h2>
          <ul className="divide-y rounded-md border">
            {recruit.media.map((m) => (
              <li key={m.id}>
                <Link href={`/media/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                  <span className="font-medium">{m.headline ?? "Untitled"}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {MEDIA_STATUS_LABELS[m.status]} · {m.createdAt.toISOString().slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Edit */}
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">Edit recruit</h2>
        <RecruitForm
          action={updateRecruit}
          seasons={seasons}
          submitLabel="Save changes"
          values={{
            id: recruit.id,
            seasonId: recruit.season.id,
            name: recruit.name,
            position: recruit.position,
            kind: recruit.kind,
            previousSchool: recruit.previousSchool,
            eligibilityYears: recruit.eligibilityYears,
            height: height ?? "",
            weightLbs: recruit.weightLbs,
            hometownCity: recruit.hometownCity,
            hometownState: recruit.hometownState,
            highSchool: recruit.highSchool,
            stars: recruit.stars,
            rating: rating ?? "",
            nationalRank: recruit.nationalRank,
            positionRank: recruit.positionRank,
            stateRank: recruit.stateRank,
            status: recruit.status,
            otherOffers: recruit.otherOffers,
            bio: recruit.bio,
            notes: recruit.notes,
            hasPhoto: recruit.photo != null,
          }}
        />
        <div className="border-t pt-3">
          <SaveForm action={deleteRecruit} successText="Recruit deleted">
            <input type="hidden" name="id" value={recruit.id} />
            <ConfirmSubmit
              message={`Delete recruit "${recruit.name}"? This also removes their recruiting coverage.`}
              className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700"
            >
              Delete recruit
            </ConfirmSubmit>
          </SaveForm>
        </div>
      </section>
    </div>
  );
}
