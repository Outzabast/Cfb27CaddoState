import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeasonNav } from "@/components/season-nav";
import { ResultBadge } from "@/components/result-badge";
import { NewsTeaser } from "@/components/media/news-teaser";
import { SocialFeed } from "@/components/media/social-feed";
import { fetchSocialFeed } from "@/lib/media/social-feed";
import { StaffSection } from "@/components/staff-section";
import { FactGroup } from "@/components/media/fact-group";
import { factsForScope } from "@/lib/media/facts";
import { buttonVariants } from "@/components/ui/button";

function result(t: number, o: number): "W" | "L" | "T" | null {
  if (t === 0 && o === 0) return null;
  return t > o ? "W" : t < o ? "L" : "T";
}

export default async function SeasonHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();
  const isEdit = (await searchParams).mode === "edit";

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: {
      games: { orderBy: [{ week: "asc" }, { date: "asc" }, { id: "asc" }] },
      roster: { include: { _count: { select: { players: true } } } },
      staff: { orderBy: { role: "asc" } },
    },
  });
  if (!season) notFound();

  // Recent generated articles for this season (recaps + team stories).
  const news = await db.media.findMany({
    where: { mediaType: "ARTICLE", status: "READY", OR: [{ seasonId }, { game: { seasonId } }] },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, headline: true, viewed: true },
  });
  const socialPosts = await fetchSocialFeed({ seasonId, limit: 6, readyOnly: true });

  let wins = 0,
    losses = 0,
    ties = 0,
    pointsFor = 0,
    pointsAgainst = 0;
  for (const g of season.games) {
    pointsFor += g.teamPoints;
    pointsAgainst += g.oppPoints;
    if (g.teamPoints === 0 && g.oppPoints === 0) continue; // unplayed
    if (g.teamPoints > g.oppPoints) wins++;
    else if (g.teamPoints < g.oppPoints) losses++;
    else ties++;
  }
  const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  const playerCount = season.roster?._count.players ?? 0;

  // TEAM facts are program-wide (global); editable here on the team home page.
  const teamFacts = isEdit ? await factsForScope("TEAM", null) : [];
  const basePath = `/seasons/${seasonId}`;

  return (
    <div className="space-y-8">
      {/* Team / season hero */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/caddo-cs-mark.png" alt="Caddo State" className="h-12 w-auto" />
            <div>
              <div className="eyebrow">Caddo State · {season.name}</div>
              <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
                Lumberjacks
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <HeaderStat label="Record" value={record} />
            <HeaderStat label="PF" value={pointsFor} />
            <HeaderStat label="PA" value={pointsAgainst} />
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/seasons/edit/${seasonId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit season
              </Link>
              <Link
                href={isEdit ? basePath : `${basePath}?mode=edit`}
                className={buttonVariants({ variant: isEdit ? "outline" : "default", size: "sm" })}
              >
                {isEdit ? "Done" : "Edit team"}
              </Link>
            </div>
          </div>
        </div>
        <SeasonNav seasonId={seasonId} active="home" />
      </div>

      {isEdit && (
        <section className="space-y-3">
          <h2 className="eyebrow !text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground">
            Program-wide canon for the Lumberjacks — applies to every season&rsquo;s
            media. (Uniforms and other team assets will live here too.)
          </p>
          <FactGroup
            scope="TEAM"
            title="Team facts"
            blurb="Program canon: identity, culture, rivalries, home-field lore — the things always true of Caddo State."
            facts={teamFacts}
            revalidate={basePath}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Schedule */}
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow !text-foreground">{season.name} Schedule</h2>
            <Link
              href={`/seasons/${seasonId}/schedule`}
              className="text-xs font-medium text-muted-foreground hover:text-primary"
            >
              Manage →
            </Link>
          </div>
          {season.games.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
              No games scheduled yet.{" "}
              <Link
                href={`/seasons/${seasonId}/schedule`}
                className="font-medium text-primary hover:underline"
              >
                Add the schedule
              </Link>
              .
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border bg-card">
              {season.games.map((g) => {
                const r = result(g.teamPoints, g.oppPoints);
                return (
                  <Link
                    key={g.id}
                    href={`/seasons/${seasonId}/schedule/${g.id}/box-score`}
                    className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {g.week != null
                          ? `Wk ${g.week}`
                          : g.date
                            ? g.date.toISOString().slice(5, 10)
                            : "—"}
                      </span>
                      <span className="font-medium">
                        <span className="text-muted-foreground">
                          {g.location === "AWAY" ? "@ " : g.location === "NEUTRAL" ? "vs " : "vs "}
                        </span>
                        {g.opponent}
                      </span>
                    </div>
                    {r ? (
                      <ResultBadge r={r} score={`${g.teamPoints}-${g.oppPoints}`} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {g.date ? g.date.toISOString().slice(5, 10) : "TBD"}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Sidebar: quick links + news */}
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="eyebrow !text-foreground">Team</h2>
            <div className="overflow-hidden rounded-md border bg-card">
              <QuickLink href={`/seasons/${seasonId}/roster`} label="Roster" note={`${playerCount} players`} />
              <QuickLink href={`/seasons/${seasonId}/stats`} label="Team Stats" note="Season totals" />
              <QuickLink href={`/seasons/${seasonId}/schedule`} label="Schedule" note={`${season.games.length} games`} />
            </div>
          </section>

          <StaffSection seasonId={seasonId} staff={season.staff} />

          <section className="space-y-3">
            <h2 className="eyebrow !text-foreground">Latest News</h2>
            <NewsTeaser items={news} viewAllHref={`/seasons/${seasonId}/media`} />
          </section>
        </div>
      </div>

      {socialPosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow !text-foreground">Recent Social Media Posts</h2>
          <SocialFeed posts={socialPosts} scroll />
        </section>
      )}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  note,
}: {
  href: string;
  label: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b px-4 py-3 last:border-0 hover:bg-accent"
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{note} →</span>
    </Link>
  );
}
