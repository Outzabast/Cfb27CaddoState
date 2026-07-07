// Dump the Caddo State database to a plain-SQL file in ./backups.
//
//   npm run db:dump
//
// Runs pg_dump *inside* the postgres container (its version matches the running
// server; a mismatched local pg_dump would refuse). The dump includes DROP/CREATE
// so it can be restored over an existing database. See scripts/DB-BACKUP.md.

import "dotenv/config";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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
const outPath = join("backups", `${dbname}-${stamp}.sql`);

const args = [
  "exec", "-e", `PGPASSWORD=${password}`, container,
  "pg_dump", "-U", user, "-d", dbname,
  "--clean", "--if-exists", "--no-owner", "--no-privileges",
];

console.log(`Dumping "${dbname}" from container "${container}" -> ${outPath}`);
const out = createWriteStream(outPath);
const child = spawn("docker", args, { stdio: ["ignore", "pipe", "inherit"] });

child.on("error", (e) => {
  console.error(`Could not run docker: ${e.message}. Is Docker installed and running?`);
  process.exit(1);
});
child.stdout.pipe(out);
child.on("close", (code) => {
  out.end(() => {
    if (code !== 0) {
      try { unlinkSync(outPath); } catch {}
      console.error(
        `pg_dump exited with code ${code}. Is the "${container}" container running? (docker compose up -d)`,
      );
      process.exit(code ?? 1);
    }
    const kb = (statSync(outPath).size / 1024).toFixed(1);
    console.log(`✔ Backup written: ${outPath} (${kb} KB)`);
  });
});
