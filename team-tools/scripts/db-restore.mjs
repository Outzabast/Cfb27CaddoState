// Restore the Caddo State database from a plain-SQL dump made by db-dump.
//
//   npm run db:restore -- backups/caddo-YYYYMMDD-HHMMSS.sql
//   npm run db:restore -- backups/<file>.sql --yes   (skip the confirmation)
//
// Runs psql inside the postgres container in a SINGLE TRANSACTION with
// ON_ERROR_STOP, so a failed restore rolls back and leaves the DB unchanged.
// The dump's DROP/CREATE statements overwrite existing objects. Stop the dev
// server first so it isn't holding locks. See scripts/DB-BACKUP.md.

import "dotenv/config";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";

const container = process.env.DB_CONTAINER || "caddo-db";
const user = process.env.POSTGRES_USER;
const dbname = process.env.POSTGRES_DB;
const password = process.env.POSTGRES_PASSWORD ?? "";

if (!user || !dbname) {
  console.error("Missing POSTGRES_USER / POSTGRES_DB in team-tools/.env");
  process.exit(1);
}

const argv = process.argv.slice(2);
const skipConfirm = argv.includes("--yes") || argv.includes("-y");
const file = argv.find((a) => !a.startsWith("-"));

function listBackups() {
  if (!existsSync("backups")) return;
  const files = readdirSync("backups").filter((f) => f.endsWith(".sql")).sort().reverse();
  if (files.length) {
    console.error("\nAvailable backups (newest first):");
    for (const f of files) console.error(`  backups/${f}`);
  }
}

if (!file) {
  console.error("Usage: npm run db:restore -- <path-to-dump.sql> [--yes]");
  listBackups();
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  listBackups();
  process.exit(1);
}

async function confirmed() {
  if (skipConfirm) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) =>
    rl.question(
      `This OVERWRITES database "${dbname}" with ${file}.\nType the database name ("${dbname}") to confirm: `,
      res,
    ),
  );
  rl.close();
  return answer.trim() === dbname;
}

if (!(await confirmed())) {
  console.error("Aborted — database left unchanged.");
  process.exit(1);
}

const args = [
  "exec", "-i", "-e", `PGPASSWORD=${password}`, container,
  "psql", "-U", user, "-d", dbname,
  "-v", "ON_ERROR_STOP=1", "--single-transaction",
];

console.log(`Restoring ${file} into "${dbname}" (container "${container}")…`);
const child = spawn("docker", args, { stdio: ["pipe", "inherit", "inherit"] });
child.on("error", (e) => {
  console.error(`Could not run docker: ${e.message}. Is Docker installed and running?`);
  process.exit(1);
});
createReadStream(file).pipe(child.stdin);
child.on("close", (code) => {
  if (code !== 0) {
    console.error(`Restore failed (psql exit ${code}). The DB was rolled back / left unchanged.`);
    process.exit(code ?? 1);
  }
  console.log(`✔ Restored ${file} into "${dbname}".`);
});
