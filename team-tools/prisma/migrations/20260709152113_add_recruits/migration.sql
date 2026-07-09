-- CreateEnum
CREATE TYPE "recruit_status" AS ENUM ('TARGET', 'OFFERED', 'COMMITTED', 'SIGNED', 'ENROLLED', 'DECOMMITTED', 'LOST');

-- AlterEnum
ALTER TYPE "media_scope" ADD VALUE 'RECRUIT';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "recruit_id" INTEGER;

-- AlterTable
ALTER TABLE "media_events" ADD COLUMN     "recruit_id" INTEGER;

-- CreateTable
CREATE TABLE "recruits" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" VARCHAR(8) NOT NULL,
    "height_inches" INTEGER,
    "weight_lbs" INTEGER,
    "hometown_city" TEXT,
    "hometown_state" TEXT,
    "high_school" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "national_rank" INTEGER,
    "position_rank" INTEGER,
    "state_rank" INTEGER,
    "status" "recruit_status" NOT NULL DEFAULT 'TARGET',
    "committed_at" TIMESTAMP(3),
    "other_offers" TEXT,
    "bio" TEXT,
    "notes" TEXT,
    "photo" BYTEA,
    "player_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recruits_player_id_key" ON "recruits"("player_id");

-- CreateIndex
CREATE INDEX "recruits_season_id_idx" ON "recruits"("season_id");

-- CreateIndex
CREATE INDEX "recruits_status_idx" ON "recruits"("status");

-- CreateIndex
CREATE INDEX "media_recruit_id_idx" ON "media"("recruit_id");

-- AddForeignKey
ALTER TABLE "recruits" ADD CONSTRAINT "recruits_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruits" ADD CONSTRAINT "recruits_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_recruit_id_fkey" FOREIGN KEY ("recruit_id") REFERENCES "recruits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_recruit_id_fkey" FOREIGN KEY ("recruit_id") REFERENCES "recruits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
