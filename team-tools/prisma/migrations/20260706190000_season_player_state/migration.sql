-- Move per-season player state (class, position, number) off Player and onto a
-- new SeasonRoster / SeasonPlayer pair, preserving existing roster data. This
-- fixes the bug where advancing a season retroactively changed a player's class
-- in past seasons (because class was a single mutable field on Player).

-- 1. New tables --------------------------------------------------------------
CREATE TABLE "season_rosters" (
    "id"        SERIAL PRIMARY KEY,
    "season_id" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "season_rosters_season_id_key" ON "season_rosters" ("season_id");
ALTER TABLE "season_rosters"
    ADD CONSTRAINT "season_rosters_season_id_fkey"
    FOREIGN KEY ("season_id") REFERENCES "seasons" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "season_players" (
    "id"               SERIAL PRIMARY KEY,
    "season_roster_id" INTEGER NOT NULL,
    "player_id"        INTEGER NOT NULL,
    "position"         VARCHAR(8) NOT NULL,
    "class"            "player_class" NOT NULL,
    "number"           INTEGER
);
CREATE UNIQUE INDEX "season_players_season_roster_id_player_id_key"
    ON "season_players" ("season_roster_id", "player_id");
ALTER TABLE "season_players"
    ADD CONSTRAINT "season_players_season_roster_id_fkey"
    FOREIGN KEY ("season_roster_id") REFERENCES "season_rosters" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_players"
    ADD CONSTRAINT "season_players_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill: one roster per existing season --------------------------------
INSERT INTO "season_rosters" ("season_id")
SELECT "id" FROM "seasons";

-- 3. Backfill season_players from the old roster_entries + players state ------
INSERT INTO "season_players" ("season_roster_id", "player_id", "position", "class", "number")
SELECT sr."id", re."player_id", p."position", p."class", re."number"
FROM "roster_entries" re
JOIN "season_rosters" sr ON sr."season_id" = re."season_id"
JOIN "players" p ON p."id" = re."player_id";

-- 4. Drop the old roster table and the now-moved player columns --------------
DROP TABLE "roster_entries";
ALTER TABLE "players" DROP COLUMN "position";
ALTER TABLE "players" DROP COLUMN "class";
