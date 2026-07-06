import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 uses a driver adapter instead of a bundled query engine. The pg
// adapter reads the same DATABASE_URL the CLI/migrations use (loaded by Next
// from .env at runtime).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Reuse a single client across hot reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
