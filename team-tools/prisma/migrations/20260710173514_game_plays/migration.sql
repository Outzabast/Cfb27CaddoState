-- CreateTable
CREATE TABLE "game_plays" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "clock" TEXT,
    "team" "scoring_team" NOT NULL,
    "situation" TEXT,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_plays_game_id_idx" ON "game_plays"("game_id");

-- AddForeignKey
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
