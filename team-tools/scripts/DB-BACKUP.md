# Database backup & restore

Two CLI utilities to snapshot the Caddo State Postgres database to a
gzip-compressed SQL file and load one back. Both run `pg_dump` / `psql` **inside
the `caddo-db` container**, so their version always matches the running Postgres
18 server (a local `pg_dump` of a different major version would refuse to run).
Compression uses Node's built-in `zlib` (no external `gzip`/`gunzip` binary), so
it behaves identically on Windows, macOS, and Linux.

Run them from the `team-tools/` directory. Connection details come from
`team-tools/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
The container name defaults to `caddo-db` (override with `DB_CONTAINER`).

## Prerequisites

- Docker running with the db container up: `docker compose up -d` (from the repo
  root, where `docker-compose.yaml` lives). Check: `docker ps` shows `caddo-db`.

## Back up (dump)

```bash
npm run db:dump
```

Writes `backups/caddo-YYYYMMDD-HHMMSS.sql.gz` (timestamped, gzip-compressed —
roughly 5–10× smaller than raw SQL, to stay under Git's file-size limits). The
dump includes `DROP ... IF EXISTS` + `CREATE` for every object plus all data, so
it can be restored over an existing database. The `backups/` folder is
git-ignored; to snapshot a specific dump into version control:

```bash
git add -f backups/caddo-YYYYMMDD-HHMMSS.sql.gz
```

## Restore (load)

> Restoring **overwrites** the current database with the dump's contents.
> Stop the dev server first (`Ctrl-C` on `npm run dev`) so it isn't holding
> locks, then restart it afterward so Prisma reconnects.

```bash
npm run db:restore -- backups/caddo-YYYYMMDD-HHMMSS.sql.gz
```

It prints the available backups if you don't pass a file. `.sql.gz` files are
gunzipped automatically; older plain `.sql` dumps still restore as-is. You'll be
asked to type the database name to confirm. To skip the prompt (e.g. in a script):

```bash
npm run db:restore -- backups/caddo-YYYYMMDD-HHMMSS.sql.gz --yes
```

The restore runs in a **single transaction** with `ON_ERROR_STOP`, so if
anything fails it rolls back and the database is left exactly as it was.

## Notes

- These operate on the whole database (schema + data + Prisma migration history),
  so a restored dump also restores the migration state — no `prisma migrate`
  needed afterward.
- A safe upgrade/experiment flow: `npm run db:dump` first, make changes, and if
  they go wrong, `npm run db:restore -- <that dump>`.
