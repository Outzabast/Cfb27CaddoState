// Exercises the stats-page aggregate + percentage path against the DB, rolled
// back so nothing persists.  pnpm tsx scripts/verify-stats.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  TEAM_STAT_GROUPS,
  PLAYER_STAT_GROUPS,
  aggregateSelect,
  mergeAggregate,
  formatPct,
} from "../lib/stat-fields";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ROLLBACK = "__rb__";
let report: Record<string, string | number> = {};

try {
  await prisma.$transaction(async (tx) => {
    const s = await tx.season.create({
      data: { name: "TSTAT", startYear: 2099, endYear: 2100, roster: { create: {} } },
      include: { roster: true },
    });
    const pl = await tx.player.create({ data: { name: "Stat Test" } });
    await tx.seasonPlayer.create({
      data: { seasonRosterId: s.roster!.id, playerId: pl.id, playerName: pl.name, position: "QB", class: "SENIOR", number: 1 },
    });
    const g = await tx.game.create({
      data: { seasonId: s.id, opponent: "X", location: "HOME", teamPoints: 1, oppPoints: 0 },
    });
    await tx.gameTeamStat.create({
      data: { gameId: g.id, thirdDownAtt: 3, thirdDownConv: 1, fgMade: 2, fgAtt: 3, xpMade: 5, xpAtt: 5 },
    });
    // Two games' worth for the player, to also check SUM + MAX(long).
    await tx.gamePlayerStat.create({
      data: { gameId: g.id, playerId: pl.id, passCmp: 22, passAtt: 34, passYds: 305, passLong: 48, fgMade: 1, fgAtt: 2 },
    });

    const tSel = aggregateSelect(TEAM_STAT_GROUPS);
    const tAgg = await tx.gameTeamStat.aggregate({
      where: { game: { seasonId: s.id } },
      _sum: tSel.sum as never,
    });
    const tVals = mergeAggregate(tAgg, TEAM_STAT_GROUPS);

    const pSel = aggregateSelect(PLAYER_STAT_GROUPS);
    const pAgg = await tx.gamePlayerStat.aggregate({
      where: { playerId: pl.id },
      _sum: pSel.sum as never,
      _max: pSel.max as never,
    });
    const pVals = mergeAggregate(pAgg, PLAYER_STAT_GROUPS);

    report = {
      "3rd% (1/3)": formatPct(tVals.thirdDownConv, tVals.thirdDownAtt),
      "FG% (2/3)": formatPct(tVals.fgMade, tVals.fgAtt),
      "XP% (5/5)": formatPct(tVals.xpMade, tVals.xpAtt),
      "Comp% (22/34)": formatPct(pVals.passCmp, pVals.passAtt),
      "passLong (MAX)": pVals.passLong,
    };
    throw new Error(ROLLBACK);
  });
} catch (e) {
  if ((e as Error).message !== ROLLBACK) throw e;
}

console.log(report);
const ok =
  report["3rd% (1/3)"] === "33%" &&
  report["FG% (2/3)"] === "67%" &&
  report["XP% (5/5)"] === "100%" &&
  report["Comp% (22/34)"] === "65%" &&
  report["passLong (MAX)"] === 48;
console.log(ok ? "PASS" : "FAIL");
await prisma.$disconnect();
