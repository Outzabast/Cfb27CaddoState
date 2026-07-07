ALTER TABLE "seasons" ADD COLUMN "conference" TEXT;
ALTER TABLE "games" ADD COLUMN "is_conference" BOOLEAN NOT NULL DEFAULT false;
