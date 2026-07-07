// Exercises the advance-season logic against the real DB inside a transaction
// that is rolled back at the end, so nothing persists.
//   pnpm tsx scripts/verify-advance.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PlayerClass } from "../generated/prisma/enums";

const ADVANCE: Record<PlayerClass, PlayerClass> = {
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
const INACTIVE = new Set<PlayerClass>(["GRADUATED", "TRANSFERRED"]);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ROLLBACK = "__rollback__";
const carried: { name: string; from: string; to: string }[] = [];
const dropped: { name: string; from: string; to: string }[] = [];

try {
  await prisma.$transaction(async (tx) => {
    // Prior season's roster (players are SeasonPlayer rows, not on Player).
    const prev = await tx.season.findFirstOrThrow({
      where: { name: "2026-2027" },
      include: { roster: { include: { players: true } } },
    });
    if (!prev.roster) throw new Error("Prior season has no roster.");

    const next = await tx.season.create({
      data: {
        name: "TEST-next",
        startYear: prev.startYear + 1,
        endYear: prev.endYear + 1,
        roster: { create: {} },
      },
      include: { roster: true },
    });

    // Add a synthetic senior so we can prove graduation drops a player.
    const senior = await tx.player.create({ data: { name: "Test Senior" } });
    const seniorSp = await tx.seasonPlayer.create({
      data: {
        seasonRosterId: prev.roster.id,
        playerId: senior.id,
        playerName: senior.name,
        position: "K",
        class: "SENIOR",
        number: 99,
      },
    });

    // Advancing creates NEW SeasonPlayer rows on the next roster with a
    // stepped-up class; prior rows are left untouched (history preserved).
    const entries = [...prev.roster.players, seniorSp];
    for (const sp of entries) {
      const to = ADVANCE[sp.class];
      if (!INACTIVE.has(to)) {
        await tx.seasonPlayer.create({
          data: {
            seasonRosterId: next.roster!.id,
            playerId: sp.playerId,
            playerName: sp.playerName,
            position: sp.position,
            class: to,
            number: sp.number,
          },
        });
        carried.push({ name: sp.playerName, from: sp.class, to });
      } else {
        dropped.push({ name: sp.playerName, from: sp.class, to });
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
