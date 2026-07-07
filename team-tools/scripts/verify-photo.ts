import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const ROLLBACK = "__rb__";
let out: Record<string, unknown> = {};
const png = new Uint8Array([0x89,0x50,0x4e,0x47,1,2,3,4,5]); // fake PNG-ish bytes
try {
  await prisma.$transaction(async (tx) => {
    const p = await tx.player.create({ data: { name: "Photo Test", bio: "A bio.", awards: null } });
    await tx.player.update({ where: { id: p.id }, data: { photo: png, awards: "Award X" } });
    const back = await tx.player.findUnique({ where: { id: p.id }, select: { bio: true, awards: true, photo: true } });
    out = {
      bio: back?.bio,
      awards: back?.awards,
      photoLen: back?.photo ? new Uint8Array(back.photo).length : 0,
      firstByte: back?.photo ? new Uint8Array(back.photo)[0] : null,
    };
    throw new Error(ROLLBACK);
  });
} catch (e) { if ((e as Error).message !== ROLLBACK) throw e; }
console.log(out);
console.log(out.photoLen === 9 && out.firstByte === 0x89 && out.bio === "A bio." && out.awards === "Award X" ? "PASS" : "FAIL");
await prisma.$disconnect();
