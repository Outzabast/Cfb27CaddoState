import Link from "next/link";
import { db } from "@/lib/db";
import { RecruitForm } from "@/components/recruit-form";
import { createRecruit } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRecruitPage() {
  const seasons = await db.season.findMany({
    orderBy: { startYear: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/recruits" className="text-sm text-muted-foreground hover:text-foreground">
          ← Recruits
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          Add Recruit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track a prospect for a recruiting class. Sign them later to make them a
          roster player.
        </p>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a season first — a recruit belongs to a recruiting class.
        </p>
      ) : (
        <RecruitForm action={createRecruit} seasons={seasons} submitLabel="Add recruit" />
      )}
    </div>
  );
}
