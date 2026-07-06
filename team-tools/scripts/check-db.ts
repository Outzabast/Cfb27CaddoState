// Connectivity smoke test: `pnpm tsx scripts/check-db.ts`
// Uses relative imports (not the @/ alias) so it runs standalone under tsx.
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const seasons = await prisma.season.count();
const players = await prisma.player.count();
console.log(`Connected. seasons=${seasons} players=${players}`);
await prisma.$disconnect();
