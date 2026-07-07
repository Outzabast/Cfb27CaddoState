-- Notoriety columns (unsigned in the app; INTEGER here, guarded >= 0 in code)
ALTER TABLE "players" ADD COLUMN "injury_details" TEXT;
ALTER TABLE "players" ADD COLUMN "overall_notoriety" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "season_players" ADD COLUMN "is_starter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "season_players" ADD COLUMN "season_notoriety" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "game_player_stats" ADD COLUMN "game_notoriety" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- PlayerStatus: ACTIVE/INJURED/OUT/SUSPENDED/INACTIVE  ->  ACTIVE/INJURED/POSTACTIVE
-- Backfill via a text hop, then swap the enum type.
-- ---------------------------------------------------------------------------
CREATE TYPE "player_status_new" AS ENUM ('ACTIVE', 'INJURED', 'POSTACTIVE');

ALTER TABLE "players" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "players" ALTER COLUMN "status" TYPE TEXT USING "status"::text;

-- Keep INJURED; fold the availability variants (OUT/SUSPENDED/INACTIVE) into ACTIVE.
UPDATE "players" SET "status" = 'ACTIVE'
  WHERE "status" IN ('OUT', 'SUSPENDED', 'INACTIVE');

-- A player who has ever graduated/transferred is POSTACTIVE (off the active roster).
UPDATE "players" p SET "status" = 'POSTACTIVE'
  WHERE EXISTS (
    SELECT 1 FROM "season_players" sp
    WHERE sp."player_id" = p."id"
      AND sp."class"::text IN ('GRADUATED', 'TRANSFERRED')
  );

ALTER TABLE "players"
  ALTER COLUMN "status" TYPE "player_status_new" USING "status"::"player_status_new";
ALTER TABLE "players" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "player_status";
ALTER TYPE "player_status_new" RENAME TO "player_status";

-- ---------------------------------------------------------------------------
-- MediaEvent ("mediaSpace" posts) + the Media -> MediaEvent link
-- ---------------------------------------------------------------------------
CREATE TYPE "media_event_type" AS ENUM ('BOX_SCORE', 'PLAYER_UPDATE', 'MANUAL');
CREATE TYPE "media_event_status" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "media_events" (
    "id" SERIAL NOT NULL,
    "type" "media_event_type" NOT NULL,
    "status" "media_event_status" NOT NULL DEFAULT 'PENDING',
    "scope" "media_scope" NOT NULL,
    "player_id" INTEGER,
    "game_id" INTEGER,
    "season_id" INTEGER,
    "context" TEXT,
    "author_persona_id" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_events_status_idx" ON "media_events"("status");
CREATE INDEX "media_events_game_id_idx" ON "media_events"("game_id");

ALTER TABLE "media_events" ADD CONSTRAINT "media_events_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_events" ADD CONSTRAINT "media_events_author_persona_id_fkey"
  FOREIGN KEY ("author_persona_id") REFERENCES "author_personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media" ADD COLUMN "media_event_id" INTEGER;
CREATE INDEX "media_media_event_id_idx" ON "media"("media_event_id");
ALTER TABLE "media" ADD CONSTRAINT "media_media_event_id_fkey"
  FOREIGN KEY ("media_event_id") REFERENCES "media_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
