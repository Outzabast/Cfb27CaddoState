-- MediaEvent: replace the single author_persona_id with multi-persona fan-out
-- plus a media type and optional extra player-feature targets.
ALTER TABLE "media_events" DROP CONSTRAINT IF EXISTS "media_events_author_persona_id_fkey";
ALTER TABLE "media_events" DROP COLUMN IF EXISTS "author_persona_id";
ALTER TABLE "media_events" ADD COLUMN "media_type" "media_type" NOT NULL DEFAULT 'ARTICLE';
ALTER TABLE "media_events" ADD COLUMN "persona_ids" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "media_events" ADD COLUMN "player_ids" INTEGER[] NOT NULL DEFAULT '{}';
