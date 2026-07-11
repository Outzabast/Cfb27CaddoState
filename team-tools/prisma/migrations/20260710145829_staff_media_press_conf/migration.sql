-- CreateEnum
CREATE TYPE "press_conference_type" AS ENUM ('PRE_GAME', 'POST_GAME', 'PRE_SEASON', 'POST_SEASON');

-- CreateEnum
CREATE TYPE "press_conference_status" AS ENUM ('ACTIVE', 'DONE');

-- AlterEnum
ALTER TYPE "media_scope" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "staff_id" INTEGER;

-- AlterTable
ALTER TABLE "media_events" ADD COLUMN     "staff_id" INTEGER;

-- CreateTable
CREATE TABLE "press_conferences" (
    "id" SERIAL NOT NULL,
    "type" "press_conference_type" NOT NULL,
    "status" "press_conference_status" NOT NULL DEFAULT 'ACTIVE',
    "player_id" INTEGER,
    "staff_id" INTEGER,
    "game_id" INTEGER,
    "season_id" INTEGER,
    "persona_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "max_per_persona" INTEGER NOT NULL DEFAULT 2,
    "max_total" INTEGER NOT NULL DEFAULT 10,
    "media_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "press_conferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_conference_questions" (
    "id" SERIAL NOT NULL,
    "conference_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "persona_id" INTEGER,
    "persona_name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "press_conference_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "press_conferences_media_id_key" ON "press_conferences"("media_id");

-- CreateIndex
CREATE INDEX "press_conference_questions_conference_id_idx" ON "press_conference_questions"("conference_id");

-- CreateIndex
CREATE INDEX "media_staff_id_idx" ON "media"("staff_id");

-- AddForeignKey
ALTER TABLE "press_conferences" ADD CONSTRAINT "press_conferences_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_conferences" ADD CONSTRAINT "press_conferences_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_conferences" ADD CONSTRAINT "press_conferences_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_conferences" ADD CONSTRAINT "press_conferences_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_conferences" ADD CONSTRAINT "press_conferences_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_conference_questions" ADD CONSTRAINT "press_conference_questions_conference_id_fkey" FOREIGN KEY ("conference_id") REFERENCES "press_conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
