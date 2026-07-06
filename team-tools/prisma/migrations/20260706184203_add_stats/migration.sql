-- CreateEnum
CREATE TYPE "game_location" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "week" INTEGER,
    "date" DATE,
    "opponent" TEXT NOT NULL,
    "location" "game_location" NOT NULL DEFAULT 'HOME',
    "team_points" INTEGER NOT NULL DEFAULT 0,
    "opp_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_player_stats" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "pass_cmp" INTEGER NOT NULL DEFAULT 0,
    "pass_att" INTEGER NOT NULL DEFAULT 0,
    "pass_yds" INTEGER NOT NULL DEFAULT 0,
    "pass_td" INTEGER NOT NULL DEFAULT 0,
    "pass_int" INTEGER NOT NULL DEFAULT 0,
    "pass_long" INTEGER NOT NULL DEFAULT 0,
    "sacked" INTEGER NOT NULL DEFAULT 0,
    "rush_att" INTEGER NOT NULL DEFAULT 0,
    "rush_yds" INTEGER NOT NULL DEFAULT 0,
    "rush_td" INTEGER NOT NULL DEFAULT 0,
    "rush_long" INTEGER NOT NULL DEFAULT 0,
    "targets" INTEGER NOT NULL DEFAULT 0,
    "rec" INTEGER NOT NULL DEFAULT 0,
    "rec_yds" INTEGER NOT NULL DEFAULT 0,
    "rec_td" INTEGER NOT NULL DEFAULT 0,
    "rec_long" INTEGER NOT NULL DEFAULT 0,
    "tackles_solo" INTEGER NOT NULL DEFAULT 0,
    "tackles_ast" INTEGER NOT NULL DEFAULT 0,
    "tackles_for_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sacks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qb_hurries" INTEGER NOT NULL DEFAULT 0,
    "def_int" INTEGER NOT NULL DEFAULT 0,
    "int_yds" INTEGER NOT NULL DEFAULT 0,
    "passes_defended" INTEGER NOT NULL DEFAULT 0,
    "forced_fumbles" INTEGER NOT NULL DEFAULT 0,
    "fumbles_recovered" INTEGER NOT NULL DEFAULT 0,
    "def_td" INTEGER NOT NULL DEFAULT 0,
    "fg_made" INTEGER NOT NULL DEFAULT 0,
    "fg_att" INTEGER NOT NULL DEFAULT 0,
    "fg_long" INTEGER NOT NULL DEFAULT 0,
    "xp_made" INTEGER NOT NULL DEFAULT 0,
    "xp_att" INTEGER NOT NULL DEFAULT 0,
    "punts" INTEGER NOT NULL DEFAULT 0,
    "punt_yds" INTEGER NOT NULL DEFAULT 0,
    "punt_long" INTEGER NOT NULL DEFAULT 0,
    "kr_ret" INTEGER NOT NULL DEFAULT 0,
    "kr_yds" INTEGER NOT NULL DEFAULT 0,
    "kr_td" INTEGER NOT NULL DEFAULT 0,
    "pr_ret" INTEGER NOT NULL DEFAULT 0,
    "pr_yds" INTEGER NOT NULL DEFAULT 0,
    "pr_td" INTEGER NOT NULL DEFAULT 0,
    "fumbles" INTEGER NOT NULL DEFAULT 0,
    "fumbles_lost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_team_stats" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "first_downs" INTEGER NOT NULL DEFAULT 0,
    "total_plays" INTEGER NOT NULL DEFAULT 0,
    "total_yards" INTEGER NOT NULL DEFAULT 0,
    "pass_yds" INTEGER NOT NULL DEFAULT 0,
    "rush_yds" INTEGER NOT NULL DEFAULT 0,
    "third_down_conv" INTEGER NOT NULL DEFAULT 0,
    "third_down_att" INTEGER NOT NULL DEFAULT 0,
    "fourth_down_conv" INTEGER NOT NULL DEFAULT 0,
    "fourth_down_att" INTEGER NOT NULL DEFAULT 0,
    "penalties" INTEGER NOT NULL DEFAULT 0,
    "penalty_yds" INTEGER NOT NULL DEFAULT 0,
    "turnovers" INTEGER NOT NULL DEFAULT 0,
    "time_of_possession_sec" INTEGER NOT NULL DEFAULT 0,
    "sacks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tackles_for_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "takeaways" INTEGER NOT NULL DEFAULT 0,
    "def_td" INTEGER NOT NULL DEFAULT 0,
    "fg_made" INTEGER NOT NULL DEFAULT 0,
    "fg_att" INTEGER NOT NULL DEFAULT 0,
    "xp_made" INTEGER NOT NULL DEFAULT 0,
    "xp_att" INTEGER NOT NULL DEFAULT 0,
    "punts" INTEGER NOT NULL DEFAULT 0,
    "punt_yds" INTEGER NOT NULL DEFAULT 0,
    "return_yds" INTEGER NOT NULL DEFAULT 0,
    "return_td" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_team_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_season_id_week_key" ON "games"("season_id", "week");

-- CreateIndex
CREATE UNIQUE INDEX "game_player_stats_game_id_player_id_key" ON "game_player_stats"("game_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_team_stats_game_id_key" ON "game_team_stats"("game_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player_stats" ADD CONSTRAINT "game_player_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player_stats" ADD CONSTRAINT "game_player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_team_stats" ADD CONSTRAINT "game_team_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
