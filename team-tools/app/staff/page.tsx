import Link from "next/link";
import { db } from "@/lib/db";
import { STAFF_ROLE_LABELS } from "@/lib/staff";
import { winLossRecord } from "@/lib/season-record";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function StaffIndexPage() {
  const staff = await db.staff.findMany({
    orderBy: [{ overallNotoriety: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      overallNotoriety: true,
      seasonStaff: {
        select: {
          role: true,
          season: {
            select: {
              id: true,
              startYear: true,
              endYear: true,
              games: { select: { teamPoints: true, oppPoints: true } },
            },
          },
        },
        orderBy: { season: { startYear: "desc" } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Caddo State</div>
        <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-primary">
          All-Time Staff
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every coach who&rsquo;s held a role at Caddo State, ranked by program notoriety.
        </p>
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No staff yet — assign coaches from a season&rsquo;s home page.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Latest Role</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="text-right">Program Noto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => {
                // seasonStaff is newest-first, so [0] is the latest season and the
                // last entry is the earliest. Tenure spans the first year they were
                // active to the last: earliest.startYear – latest.endYear.
                const latest = s.seasonStaff[0];
                const earliest = s.seasonStaff[s.seasonStaff.length - 1];
                const tenure = latest
                  ? `${earliest!.season.startYear}-${latest.season.endYear}`
                  : "—";
                // Team record over the coach's tenure (dedupe seasons so a coach who
                // held two roles in one year doesn't double-count that year's games).
                const seasonGames = new Map<number, { teamPoints: number; oppPoints: number }[]>();
                for (const ss of s.seasonStaff) seasonGames.set(ss.season.id, ss.season.games);
                const record = winLossRecord([...seasonGames.values()].flat());
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/staff/${s.id}`} className="hover:text-primary hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{latest ? STAFF_ROLE_LABELS[latest.role] : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{tenure}</TableCell>
                    <TableCell className="tabular-nums">{record}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{s.overallNotoriety}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
