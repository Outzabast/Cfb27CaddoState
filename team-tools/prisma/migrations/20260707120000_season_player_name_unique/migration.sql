-- Denormalized player name on the roster row, so a season roster can enforce
-- unique player names (backstop against duplicate Player rows for one person).

-- 1. Add the column nullable so existing rows can be backfilled.
ALTER TABLE "season_players" ADD COLUMN "player_name" TEXT;

-- 2. Backfill from the linked player's name.
UPDATE "season_players" sp
   SET "player_name" = p."name"
  FROM "players" p
 WHERE p."id" = sp."player_id";

-- 3. Now that every row has a value, make it required.
ALTER TABLE "season_players" ALTER COLUMN "player_name" SET NOT NULL;

-- 4. Enforce unique player name per season roster.
CREATE UNIQUE INDEX "season_players_season_roster_id_player_name_key"
    ON "season_players"("season_roster_id", "player_name");
