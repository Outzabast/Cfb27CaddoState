import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SaveForm } from "@/components/save-form";
import { FactGroup } from "@/components/media/fact-group";
import { factsForScope } from "@/lib/media/facts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSeason } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SeasonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const season = await db.season.findUnique({ where: { id } });
  if (!season) notFound();

  const seasonFacts = await factsForScope("SEASON", id);
  const path = `/seasons/edit/${id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/seasons/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {season.name}
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          Edit Season
        </h1>
      </div>

      {/* Core fields */}
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">Details</h2>
        <SaveForm action={updateSeason} successText="Season saved" className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={season.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="startYear">Start year</Label>
            <Input id="startYear" name="startYear" type="number" defaultValue={season.startYear} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endYear">End year</Label>
            <Input id="endYear" name="endYear" type="number" defaultValue={season.endYear} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="conference">Conference</Label>
            <Input id="conference" name="conference" defaultValue={season.conference ?? ""} placeholder="Sun Belt" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save details</Button>
          </div>
        </SaveForm>
      </section>

      {/* Season facts */}
      <section className="space-y-3">
        <h2 className="eyebrow !text-foreground">Season facts</h2>
        <p className="text-sm text-muted-foreground">
          This season&rsquo;s storylines — the arc every generated piece about{" "}
          {season.name} should reflect.
        </p>
        <FactGroup
          scope="SEASON"
          title="Season"
          blurb="Team-level narrative for the year: expectations, injuries, a rivalry week, a hot streak."
          facts={seasonFacts}
          seasonId={id}
          revalidate={path}
        />
      </section>
    </div>
  );
}
