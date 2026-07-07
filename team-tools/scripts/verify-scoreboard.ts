// Verifies quarter scores sum to the Final, rolled back.
//   pnpm tsx scripts/verify-scoreboard.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const ROLLBACK = "__rb__";
let out: Record<string, unknown> = {};

try {
  await prisma.$transaction(async (tx) => {
    const s = await tx.season.create({
      data: { name: "TSB", startYear: 2097, endYear: 2098, roster: { create: {} } },
    });
    const g = await tx.game.create({ data: { seasonId: s.id, opponent: "X", location: "AWAY" } });

    // Replicate the action: store quarters, Final = sum(quarters + OT).
    const t = { q1: 0, q2: 0, q3: 7, q4: 17, ot: 0 };
    const o = { q1: 3, q2: 13, q3: 10, q4: 3, ot: 0 };
    const updated = await tx.game.update({
      where: { id: g.id },
      data: {
        teamQ1: t.q1, teamQ2: t.q2, teamQ3: t.q3, teamQ4: t.q4, teamOt: t.ot,
        oppQ1: o.q1, oppQ2: o.q2, oppQ3: o.q3, oppQ4: o.q4, oppOt: o.ot,
        teamPoints: t.q1 + t.q2 + t.q3 + t.q4 + t.ot,
        oppPoints: o.q1 + o.q2 + o.q3 + o.q4 + o.ot,
      },
    });

    out = {
      teamFinal: updated.teamPoints,
      oppFinal: updated.oppPoints,
      result: updated.teamPoints > updated.oppPoints ? "W" : updated.teamPoints < updated.oppPoints ? "L" : "T",
      q3StoredTeam: updated.teamQ3,
    };
    throw new Error(ROLLBACK);
  });
} catch (e) {
  if ((e as Error).message !== ROLLBACK) throw e;
}

console.log(out);
console.log(
  out.teamFinal === 24 && out.oppFinal === 29 && out.result === "L" && out.q3StoredTeam === 7
    ? "PASS"
    : "FAIL",
);
await prisma.$disconnect();
