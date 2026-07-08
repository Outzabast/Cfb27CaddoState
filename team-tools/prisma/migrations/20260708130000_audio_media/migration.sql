-- Audio (radio monologue) media type: synthesized WAV + per-persona TTS voice.
ALTER TYPE "media_type" ADD VALUE IF NOT EXISTS 'AUDIO';

ALTER TABLE "media" ADD COLUMN "audio" BYTEA;
ALTER TABLE "media" ADD COLUMN "audio_mime" TEXT;
ALTER TABLE "media" ADD COLUMN "audio_seconds" INTEGER;

ALTER TABLE "author_personas" ADD COLUMN "tts_voice" TEXT;
