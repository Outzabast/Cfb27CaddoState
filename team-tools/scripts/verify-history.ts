// Proves advancing a season does NOT rewrite the prior season's classes.
//   pnpm tsx scripts/verify-history.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PlayerClass } from "../generated/prisma/enums";

const ADVANCE: Record<string, PlayerClass> = {
  FRESHMAN: "SOPHOMORE",
  REDSHIRT_FRESHMAN: "REDSHIRT_SOPHOMORE",
  SOPHOMORE: "JUNIOR",
  SENIOR: "GRADUATED",
};
const INACTIVE = new Set<PlayerClass>(["GRADUATED", "TRANSFERRED"]);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ROLLBACK = "__rb__";
let report: { old?: string; new?: string } = {};

try {
  await prisma.$transaction(async (tx) => {
    const s1 = await tx.season.create({
      data: { name: "TST-2026", startYear: 2026, endYear: 2027, roster: { create: {} } },
      include: { roster: true },
    });
    const player = await tx.player.create({ data: { name: "Frosh Test" } });
    await tx.seasonPlayer.create({
      data: { seasonRosterId: s1.roster!.id, playerId: player.id, playerName: player.name, position: "QB", class: "FRESHMAN", number: 12 },
    });

    // --- advance ---
    const s2 = await tx.season.create({
      data: { name: "TST-2027", startYear: 2027, endYear: 2028, roster: { create: {} } },
      include: { roster: true },
    });
    const prev = await tx.seasonRoster.findUniqueOrThrow({
      where: { seasonId: s1.id },
      include: { players: true },
    });
    for (const sp of prev.players) {
      const to = ADVANCE[sp.class];
      if (!INACTIVE.has(to)) {
        await tx.seasonPlayer.create({
          data: { seasonRosterId: s2.roster!.id, playerId: sp.playerId, playerName: sp.playerName, position: sp.position, class: to, number: sp.number },
        });
      }
    }

    const oldRow = await tx.seasonPlayer.findFirstOrThrow({
      where: { seasonRoster: { seasonId: s1.id }, playerId: player.id },
    });
    const newRow = await tx.seasonPlayer.findFirstOrThrow({
      where: { seasonRoster: { seasonId: s2.id }, playerId: player.id },
    });
    report = { old: oldRow.class, new: newRow.class };
    throw new Error(ROLLBACK);
  });
} catch (e) {
  if ((e as Error).message !== ROLLBACK) throw e;
}

console.log(`2026-2027 class (should stay FRESHMAN): ${report.old}`);
console.log(`2027-2028 class (should be SOPHOMORE):  ${report.new}`);
console.log(
  report.old === "FRESHMAN" && report.new === "SOPHOMORE"
    ? "PASS — prior season history preserved"
    : "FAIL",
);
await prisma.$disconnect();
