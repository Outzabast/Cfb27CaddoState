// Dump the Caddo State database to a gzip-compressed SQL file in ./backups.
//
//   npm run db:dump
//
// Runs pg_dump *inside* the postgres container (its version matches the running
// server; a mismatched local pg_dump would refuse). The dump includes DROP/CREATE
// so it can be restored over an existing database. Output is gzipped (.sql.gz) via
// Node's built-in zlib — no external gzip binary, so it works the same on any OS —
// to stay under Git's file-size limits. See scripts/DB-BACKUP.md.

import "dotenv/config";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

const container = process.env.DB_CONTAINER || "caddo-db";
const user = process.env.POSTGRES_USER;
const dbname = process.env.POSTGRES_DB;
const password = process.env.POSTGRES_PASSWORD ?? "";

if (!user || !dbname) {
  console.error("Missing POSTGRES_USER / POSTGRES_DB in team-tools/.env");
  process.exit(1);
}

const d = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
mkdirSync("backups", { recursive: true });
const outPath = join("backups", `${dbname}-${stamp}.sql.gz`);

const args = [
  "exec", "-e", `PGPASSWORD=${password}`, container,
  "pg_dump", "-U", user, "-d", dbname,
  "--clean", "--if-exists", "--no-owner", "--no-privileges",
];

console.log(`Dumping "${dbname}" from container "${container}" -> ${outPath}`);
const child = spawn("docker", args, { stdio: ["ignore", "pipe", "inherit"] });
child.on("error", (e) => {
  console.error(`Could not run docker: ${e.message}. Is Docker installed and running?`);
  process.exit(1);
});

// pg_dump stdout -> gzip -> file. pipeline resolves once the file is fully flushed.
const exit = new Promise((res) => child.on("close", res));
try {
  await pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(outPath));
} catch (e) {
  try { unlinkSync(outPath); } catch {}
  console.error(`Failed writing backup: ${e.message}`);
  process.exit(1);
}

const code = await exit;
if (code !== 0) {
  try { unlinkSync(outPath); } catch {}
  console.error(
    `pg_dump exited with code ${code}. Is the "${container}" container running? (docker compose up -d)`,
  );
  process.exit(code ?? 1);
}
const kb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✔ Backup written: ${outPath} (${kb} KB, gzip)`);
