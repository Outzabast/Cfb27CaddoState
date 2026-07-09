-- CreateEnum
CREATE TYPE "scoring_team" AS ENUM ('TEAM', 'OPP');

-- CreateTable
CREATE TABLE "scoring_plays" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "team" "scoring_team" NOT NULL,
    "clock" TEXT,
    "description" TEXT NOT NULL,
    "points" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scoring_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_plays_game_id_idx" ON "scoring_plays"("game_id");

-- AddForeignKey
ALTER TABLE "scoring_plays" ADD CONSTRAINT "scoring_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
