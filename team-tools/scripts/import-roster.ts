// Bulk-import a roster CSV into a season from the command line:
//   pnpm tsx scripts/import-roster.ts <csv-path> "<season name>"
// CSV format per line: Position, Name, Class, Number   (Number optional)
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseRosterRows } from "../lib/roster-import";

const [, , csvPath, seasonName] = process.argv;
if (!csvPath || !seasonName) {
  console.error('Usage: pnpm tsx scripts/import-roster.ts <csv-path> "<season name>"');
  process.exit(1);
}

const rows = parseRosterRows(readFileSync(csvPath, "utf8"));

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const season = await prisma.season.findUnique({ where: { name: seasonName } });
if (!season) {
  console.error(`Season "${seasonName}" not found.`);
  process.exit(1);
}

const roster = await prisma.seasonRoster.upsert({
  where: { seasonId: season.id },
  create: { seasonId: season.id },
  update: {},
});
const existing = await prisma.seasonPlayer.findMany({
  where: { seasonRosterId: roster.id },
  include: { player: { select: { name: true } } },
});
const existingNames = new Set(existing.map((e) => e.player.name.toLowerCase()));
const toAdd = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));

for (const r of toAdd) {
  await prisma.player.create({
    data: {
      name: r.name,
      seasonPlayers: {
        create: {
          seasonRosterId: roster.id,
          position: r.position,
          class: r.class,
          number: r.number,
        },
      },
    },
  });
}

console.log(
  `Imported ${toAdd.length} players into "${seasonName}" ` +
    `(${rows.length - toAdd.length} skipped as duplicates).`,
);
await prisma.$disconnect();
