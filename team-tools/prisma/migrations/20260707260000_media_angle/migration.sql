ALTER TABLE "media" ADD COLUMN "angle" TEXT;
ALTER TABLE "media_events" ADD COLUMN "angle" TEXT;
ALTER TABLE "media_events" ADD COLUMN "game_ids" INTEGER[] NOT NULL DEFAULT '{}';
