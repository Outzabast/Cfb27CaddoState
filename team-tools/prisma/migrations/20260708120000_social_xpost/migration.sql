-- Social (X-style) media type + replies.
ALTER TYPE "media_type" ADD VALUE IF NOT EXISTS 'XPOST';

CREATE TABLE "social_replies" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "author_persona_id" INTEGER,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "body" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_replies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "social_replies_media_id_idx" ON "social_replies"("media_id");
ALTER TABLE "social_replies" ADD CONSTRAINT "social_replies_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_replies" ADD CONSTRAINT "social_replies_author_persona_id_fkey"
  FOREIGN KEY ("author_persona_id") REFERENCES "author_personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
