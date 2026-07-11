import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { advanceClass, INACTIVE_CLASSES, CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import { RECRUIT_KIND_LABELS } from "@/lib/recruits";
import { STAFF_ROLE_LABELS, STAFF_ROLES } from "@/lib/staff";
import { DepartureList } from "@/components/departure-list";
import { RecruitImportButton } from "@/components/ocr/recruit-import";
import { commitAdvance } from "../../actions";

export const dynamic = "force-dynamic";

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function AdvanceSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const fromSeasonId = Number((await params).id);
  if (!Number.isInteger(fromSeasonId)) notFound();

  const season = await db.season.findUnique({
    where: { id: fromSeasonId },
    include: {
      roster: {
        include: {
          players: {
            orderBy: [{ position: "asc" }, { playerName: "asc" }],
            select: { playerId: true, playerName: true, position: true, class: true },
          },
        },
      },
      staff: { select: { staffId: true, staffName: true, role: true } },
    },
  });
  if (!season) notFound();

  const startYear = season.startYear + 1;
  const nextName = `${startYear}-${season.endYear + 1}`;
  const alreadyAdvanced = await db.season.findFirst({ where: { startYear }, select: { id: true } });

  // Split the roster into who returns (class stepped up) vs. who graduates out.
  const roster = season.roster?.players ?? [];
  const returning = roster
    .map((sp) => ({ ...sp, nextClass: advanceClass(sp.class) }))
    .filter((sp) => !INACTIVE_CLASSES.includes(sp.nextClass));
  const graduating = roster.filter((sp) => INACTIVE_CLASSES.includes(advanceClass(sp.class)));

  // The finishing cycle's committed-but-not-yet-enrolled signees (HS + transfers).
  const signees = await db.recruit.findMany({
    where: { seasonId: fromSeasonId, status: "SIGNED", playerId: null },
    orderBy: [{ kind: "asc" }, { stars: "desc" }, { name: "asc" }],
    select: { id: true, name: true, position: true, kind: true, previousSchool: true, stars: true },
  });

  const staff = [...season.staff].sort(
    (a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/seasons" className="text-sm text-muted-foreground hover:text-foreground">
          ← Seasons
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          Offseason
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Advance <span className="font-semibold">{season.name}</span> →{" "}
          <span className="font-semibold">{nextName}</span>. Review who leaves, who returns, and
          which signees enroll, then build the new roster.
        </p>
      </div>

      {alreadyAdvanced ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          A {nextName} season already exists — {season.name} has been advanced. Manage its roster{" "}
          <Link href={`/seasons/${alreadyAdvanced.id}/roster`} className="font-semibold underline">
            here
          </Link>
          .
        </div>
      ) : (
        <SaveForm action={commitAdvance} loadingText="Building…" successText="New season built" className="space-y-8">
          <input type="hidden" name="fromSeasonId" value={fromSeasonId} />

          {/* Departures */}
          <section className="space-y-3">
            <div>
              <h2 className="eyebrow !text-foreground">Departures</h2>
              <p className="text-xs text-muted-foreground">
                Check anyone leaving via the portal or early. Unchecked players return with their
                class stepped up.
              </p>
            </div>
            {returning.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No returning-eligible players.</p>
            ) : (
              <DepartureList
                players={returning.map((sp) => ({
                  playerId: sp.playerId,
                  name: sp.playerName,
                  position: sp.position,
                  fromClass: CLASS_LABELS[sp.class],
                  toClass: CLASS_LABELS[sp.nextClass],
                }))}
              />
            )}
            {graduating.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Graduating (auto): {graduating.map((g) => g.playerName).join(", ")}
              </p>
            )}
          </section>

          {/* Staff */}
          {staff.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="eyebrow !text-foreground">Staff</h2>
                <p className="text-xs text-muted-foreground">
                  Coaches carry to {nextName} in the same role. Check anyone who&rsquo;s
                  leaving; you can reassign roles on the new season&rsquo;s home page.
                </p>
              </div>
              <ul className="divide-y rounded-md border">
                {staff.map((s) => (
                  <li key={s.staffId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <input type="checkbox" name="departingStaffId" value={s.staffId} id={`staff-${s.staffId}`} />
                    <label htmlFor={`staff-${s.staffId}`} className="flex-1">
                      <span className="font-medium">{s.staffName}</span>{" "}
                      <span className="text-muted-foreground">{STAFF_ROLE_LABELS[s.role]}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Incoming signees */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="eyebrow !text-foreground">Incoming class</h2>
                <p className="text-xs text-muted-foreground">
                  Signed prospects from {season.name}. Check to enroll them onto the {nextName} roster.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RecruitImportButton
                  seasons={[{ id: fromSeasonId, name: season.name }]}
                  defaultSeasonId={fromSeasonId}
                />
                <Link
                  href="/recruits/new"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Add recruit
                </Link>
              </div>
            </div>
            {signees.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No signed prospects waiting to enroll. Add or import signees above (mark
                them Signed), or sign recruits on the{" "}
                <Link href="/recruits" className="underline">
                  recruiting board
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {signees.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <input type="checkbox" name="enrollRecruitId" value={r.id} id={`enr-${r.id}`} defaultChecked />
                    <label htmlFor={`enr-${r.id}`} className="flex-1">
                      <span className="font-medium">{r.name}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.position} · {r.stars}★ · {RECRUIT_KIND_LABELS[r.kind]}
                        {r.kind === "TRANSFER" && r.previousSchool ? ` from ${r.previousSchool}` : ""}
                      </span>
                    </label>
                    <select name={`class_${r.id}`} defaultValue="FRESHMAN" className={selectClass} aria-label="Class">
                      {CLASS_ORDER.filter((c) => !INACTIVE_CLASSES.includes(c)).map((c) => (
                        <option key={c} value={c}>
                          {CLASS_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <Input name={`number_${r.id}`} type="number" placeholder="#" className="h-8 w-16" aria-label="Jersey" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center gap-3 border-t pt-4">
            <Button type="submit">Commit &amp; build {nextName}</Button>
            <Link href="/seasons" className={buttonVariants({ variant: "ghost", size: "default" })}>
              Cancel
            </Link>
          </div>
        </SaveForm>
      )}
    </div>
  );
}
