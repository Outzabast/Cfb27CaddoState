-- Opponent team totals per game (mirror of game_team_stats; no opponent players).
CREATE TABLE "game_opp_stats" (
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
    CONSTRAINT "game_opp_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "game_opp_stats_game_id_key" ON "game_opp_stats"("game_id");
ALTER TABLE "game_opp_stats" ADD CONSTRAINT "game_opp_stats_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
