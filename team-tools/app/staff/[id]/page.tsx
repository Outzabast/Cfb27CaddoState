import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { STAFF_ROLE_LABELS } from "@/lib/staff";
import { updateStaffProfile } from "../actions";
import { SaveForm } from "@/components/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const staffId = Number((await params).id);
  if (!Number.isInteger(staffId)) notFound();
  const isEdit = (await searchParams).mode === "edit";
  const basePath = `/staff/${staffId}`;

  const staff = await db.staff.findUnique({
    where: { id: staffId },
    include: {
      seasonStaff: {
        include: { season: true },
        orderBy: { season: { startYear: "desc" } },
      },
    },
    omit: { photo: true },
  });
  if (!staff) notFound();

  const [{ has: hasPhoto }] = await db.$queryRaw<{ has: boolean }[]>`
    SELECT photo IS NOT NULL AS has FROM staff WHERE id = ${staffId}`;

  const roles = [...new Set(staff.seasonStaff.map((s) => STAFF_ROLE_LABELS[s.role]))];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/seasons" className="text-sm text-muted-foreground hover:text-foreground">
          ← Seasons
        </Link>
        {isEdit ? (
          <Link href={basePath} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Done
          </Link>
        ) : (
          <Link href={`${basePath}?mode=edit`} className={buttonVariants({ size: "sm" })}>
            Edit profile
          </Link>
        )}
      </div>

      {/* Identity header */}
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="h-1 bg-primary" />
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
          {hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/staff/${staffId}/photo?v=${staff.updatedAt.getTime()}`}
              alt={staff.name}
              className="h-28 w-28 shrink-0 rounded-md border object-cover"
            />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
                {staff.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{roles.join(" · ") || "Staff"}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Info label="Program Notoriety" value={String(staff.overallNotoriety)} />
              <Info label="Seasons" value={String(staff.seasonStaff.length)} />
            </div>
          </div>
        </div>
      </div>

      {!isEdit && (
        <>
          <section className="space-y-3">
            <h2 className="eyebrow !text-foreground">By Season</h2>
            {staff.seasonStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned to any season yet.</p>
            ) : (
              <div className="overflow-hidden rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Notoriety</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.seasonStaff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`/seasons/${s.seasonId}`} className="hover:text-primary">
                            {s.season.name}
                          </Link>
                        </TableCell>
                        <TableCell>{STAFF_ROLE_LABELS[s.role]}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {s.seasonNotoriety}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {staff.bio && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Bio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{staff.bio}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>Bio and a PNG photo.</CardDescription>
          </CardHeader>
          <CardContent>
            <SaveForm action={updateStaffProfile} successText="Profile saved" className="space-y-4">
              <input type="hidden" name="staffId" value={staffId} />
              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea id="bio" name="bio" defaultValue={staff.bio ?? ""} className={textareaClass} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="photo">Photo (PNG)</Label>
                <input id="photo" name="photo" type="file" accept="image/png" className="text-sm" />
                {hasPhoto && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="removePhoto" /> Remove current photo
                  </label>
                )}
              </div>
              <Button type="submit">Save profile</Button>
            </SaveForm>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
