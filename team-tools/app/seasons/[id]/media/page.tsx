import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeasonNav } from "@/components/season-nav";
import { MediaInbox } from "@/components/media/media-inbox";
import { listSeasonMedia } from "@/lib/media/query";

export const dynamic = "force-dynamic";

export default async function SeasonMediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seasonId = Number((await params).id);
  if (!Number.isInteger(seasonId)) notFound();

  const season = await db.season.findUnique({ where: { id: seasonId } });
  if (!season) notFound();

  const items = await listSeasonMedia(seasonId);

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Caddo State · {season.name}</div>
        <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          Media
        </h1>
        <SeasonNav seasonId={seasonId} active="media" />
      </div>

      <MediaInbox items={items} seasonId={seasonId} />
    </div>
  );
}
