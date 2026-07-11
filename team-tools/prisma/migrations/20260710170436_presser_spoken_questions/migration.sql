-- AlterTable
ALTER TABLE "press_conference_questions" ADD COLUMN     "audio" BYTEA,
ADD COLUMN     "audio_mime" TEXT;

-- AlterTable
ALTER TABLE "press_conferences" ADD COLUMN     "speak_questions" BOOLEAN NOT NULL DEFAULT false;
