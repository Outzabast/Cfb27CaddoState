// Verifies the "exclude players with a line" set and "zero out rest of roster"
// logic, rolled back.  pnpm tsx scripts/verify-boxscore-ops.ts
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
      data: { name: "TOPS", startYear: 2098, endYear: 2099, roster: { create: {} } },
      include: { roster: true },
    });
    const mk = (name: string) =>
      tx.player.create({ data: { name } }).then((p) =>
        tx.seasonPlayer
          .create({ data: { seasonRosterId: s.roster!.id, playerId: p.id, playerName: name, position: "QB", class: "SENIOR" } })
          .then(() => p.id),
      );
    const [p1, p2, p3] = [await mk("A"), await mk("B"), await mk("C")];
    const g = await tx.game.create({ data: { seasonId: s.id, opponent: "X", location: "HOME" } });

    // p1 records a line.
    await tx.gamePlayerStat.create({ data: { gameId: g.id, playerId: p1, passYds: 100 } });

    // --- exclusion set: roster minus players who already have a line ---
    const roster = await tx.seasonPlayer.findMany({
      where: { seasonRoster: { seasonId: s.id } },
      select: { playerId: true },
    });
    const have = new Set(
      (await tx.gamePlayerStat.findMany({ where: { gameId: g.id }, select: { playerId: true } })).map(
        (e) => e.playerId,
      ),
    );
    const available = roster.filter((r) => !have.has(r.playerId)).map((r) => r.playerId);

    // --- zero out the rest ---
    await tx.gamePlayerStat.createMany({
      data: available.map((playerId) => ({ gameId: g.id, playerId })),
    });

    const lines = await tx.gamePlayerStat.findMany({ where: { gameId: g.id } });
    const p1line = lines.find((l) => l.playerId === p1)!;
    out = {
      excludedP1FromAvailable: !available.includes(p1),
      availableWasP2P3: available.length === 2 && available.includes(p2) && available.includes(p3),
      totalLinesAfterZeroOut: lines.length,
      p1PassYdsUnchanged: p1line.passYds,
      othersAreZero: lines.filter((l) => l.playerId !== p1).every((l) => l.passYds === 0),
    };
    throw new Error(ROLLBACK);
  });
} catch (e) {
  if ((e as Error).message !== ROLLBACK) throw e;
}

console.log(out);
const ok =
  out.excludedP1FromAvailable === true &&
  out.availableWasP2P3 === true &&
  out.totalLinesAfterZeroOut === 3 &&
  out.p1PassYdsUnchanged === 100 &&
  out.othersAreZero === true;
console.log(ok ? "PASS" : "FAIL");
await prisma.$disconnect();
