// Exercises the advance-season logic against the real DB inside a transaction
// that is rolled back at the end, so nothing persists.
//   pnpm tsx scripts/verify-advance.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ADVANCE: Record<string, string> = {
  FRESHMAN: "SOPHOMORE",
  REDSHIRT_FRESHMAN: "REDSHIRT_SOPHOMORE",
  SOPHOMORE: "JUNIOR",
  REDSHIRT_SOPHOMORE: "REDSHIRT_JUNIOR",
  JUNIOR: "SENIOR",
  REDSHIRT_JUNIOR: "REDSHIRT_SENIOR",
  SENIOR: "GRADUATED",
  REDSHIRT_SENIOR: "GRADUATED",
  GRADUATED: "GRADUATED",
  TRANSFERRED: "TRANSFERRED",
};
const INACTIVE = new Set(["GRADUATED", "TRANSFERRED"]);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ROLLBACK = "__rollback__";
let carried: { name: string; from: string; to: string }[] = [];
let dropped: { name: string; from: string; to: string }[] = [];

try {
  await prisma.$transaction(async (tx) => {
    const prev = await tx.season.findFirstOrThrow({
      where: { name: "2026-2027" },
      include: { rosterEntries: { include: { player: true } } },
    });
    const next = await tx.season.create({
      data: { name: "TEST-next", startYear: prev.startYear + 1, endYear: prev.endYear + 1 },
    });
    // Add a synthetic senior so we can prove graduation drops a player.
    const senior = await tx.player.create({
      data: { name: "Test Senior", position: "K", class: "SENIOR" },
    });
    await tx.rosterEntry.create({ data: { seasonId: prev.id, playerId: senior.id, number: 99 } });

    const entries = [
      ...prev.rosterEntries,
      { playerId: senior.id, number: 99, player: senior },
    ];
    for (const e of entries) {
      const to = ADVANCE[e.player.class];
      await tx.player.update({ where: { id: e.playerId }, data: { class: to } });
      if (!INACTIVE.has(to)) {
        await tx.rosterEntry.create({
          data: { seasonId: next.id, playerId: e.playerId, number: e.number },
        });
        carried.push({ name: e.player.name, from: e.player.class, to });
      } else {
        dropped.push({ name: e.player.name, from: e.player.class, to });
      }
    }
    throw new Error(ROLLBACK);
  });
} catch (err) {
  if ((err as Error).message !== ROLLBACK) throw err;
}

console.log("CARRIED FORWARD (class stepped up):");
carried.forEach((c) => console.log(`  ${c.name}: ${c.from} -> ${c.to}`));
console.log("DROPPED (graduated/transferred):");
dropped.forEach((d) => console.log(`  ${d.name}: ${d.from} -> ${d.to}`));

const leftover = await prisma.season.count({ where: { name: "TEST-next" } });
console.log(`\nRolled back cleanly? ${leftover === 0 ? "YES" : "NO — leftover season!"}`);
await prisma.$disconnect();
