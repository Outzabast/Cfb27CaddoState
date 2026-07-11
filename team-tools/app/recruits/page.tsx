import Link from "next/link";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RecruitImportButton } from "@/components/ocr/recruit-import";
import {
  RECRUIT_STATUS_LABELS,
  RECRUIT_STATUS_ORDER,
  RECRUIT_KIND_LABELS,
  RECRUIT_KIND_ORDER,
  COMMITTED_STATUSES,
  starString,
  formatRating,
  formatHometown,
} from "@/lib/recruits";
import type { RecruitStatus, RecruitKind } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function parseStatusFilter(raw: string | undefined): RecruitStatus | undefined {
  return raw && (RECRUIT_STATUS_ORDER as string[]).includes(raw) ? (raw as RecruitStatus) : undefined;
}

function parseKindFilter(raw: string | undefined): RecruitKind | undefined {
  return raw && (RECRUIT_KIND_ORDER as string[]).includes(raw) ? (raw as RecruitKind) : undefined;
}

export default async function RecruitsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; status?: string; kind?: string }>;
}) {
  const { season, status, kind } = await searchParams;
  const seasonId = season ? Number(season) : undefined;
  const statusFilter = parseStatusFilter(status);
  const kindFilter = parseKindFilter(kind);

  const [seasons, recruits] = await Promise.all([
    db.season.findMany({ orderBy: { startYear: "desc" }, select: { id: true, name: true } }),
    db.recruit.findMany({
      where: {
        ...(seasonId ? { seasonId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(kindFilter ? { kind: kindFilter } : {}),
      },
      orderBy: [{ stars: "desc" }, { rating: "desc" }, { nationalRank: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        position: true,
        kind: true,
        previousSchool: true,
        stars: true,
        rating: true,
        nationalRank: true,
        status: true,
        hometownCity: true,
        hometownState: true,
        highSchool: true,
        playerId: true,
        season: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Caddo State</div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
            Recruiting Board
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prospects by class, ranked. Sign one to turn them into a roster player.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecruitImportButton seasons={seasons} defaultSeasonId={seasonId ?? seasons[0]?.id} />
          <Link href="/recruits/new" className={buttonVariants({ size: "sm" })}>
            Add recruit
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="season" className="text-xs text-muted-foreground">
            Class
          </Label>
          <select id="season" name="season" defaultValue={season ?? ""} className={selectClass}>
            <option value="">All classes</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClass}>
            <option value="">Any status</option>
            {RECRUIT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {RECRUIT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="kind" className="text-xs text-muted-foreground">
            Type
          </Label>
          <select id="kind" name="kind" defaultValue={kind ?? ""} className={selectClass}>
            <option value="">HS + Transfer</option>
            {RECRUIT_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {RECRUIT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonVariants({ size: "default" })}>
          Filter
        </button>
        {(season || status || kind) && (
          <Link href="/recruits" className={buttonVariants({ variant: "ghost", size: "default" })}>
            Clear
          </Link>
        )}
      </form>

      {recruits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recruits yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {recruits.map((r) => {
            const hometown = formatHometown(r.hometownCity, r.hometownState);
            const committed = COMMITTED_STATUSES.includes(r.status);
            return (
              <li key={r.id}>
                <Link
                  href={`/recruits/${r.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50"
                >
                  <span className="w-24 text-lg leading-none text-[var(--brand-gold)]" title={`${r.stars}-star`}>
                    {starString(r.stars)}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold">{r.name}</span>
                    {r.kind === "TRANSFER" && (
                      <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-600">
                        Transfer
                      </span>
                    )}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {r.position} · {r.season.name}
                      {r.kind === "TRANSFER" && r.previousSchool ? ` · from ${r.previousSchool}` : ""}
                      {[r.highSchool, hometown].filter(Boolean).length && r.kind !== "TRANSFER"
                        ? ` · ${[r.highSchool, hometown].filter(Boolean).join(", ")}`
                        : ""}
                    </span>
                  </span>
                  {formatRating(r.rating) && (
                    <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                      {formatRating(r.rating)}
                      {r.nationalRank != null ? ` · #${r.nationalRank}` : ""}
                    </span>
                  )}
                  <span
                    className={
                      "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (r.playerId
                        ? "bg-primary/10 text-primary"
                        : committed
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.playerId ? "On roster" : RECRUIT_STATUS_LABELS[r.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
