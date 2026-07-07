-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('ARTICLE');

-- CreateEnum
CREATE TYPE "media_scope" AS ENUM ('PLAYER', 'GAME', 'TEAM');

-- CreateEnum
CREATE TYPE "media_gen_status" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "media" (
    "id" SERIAL NOT NULL,
    "media_type" "media_type" NOT NULL DEFAULT 'ARTICLE',
    "scope" "media_scope" NOT NULL,
    "status" "media_gen_status" NOT NULL DEFAULT 'PENDING',
    "headline" TEXT,
    "body" TEXT,
    "photo" BYTEA,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "prompt_context" TEXT,
    "model_id" TEXT,
    "cost_usd" DOUBLE PRECISION,
    "gen_error" TEXT,
    "author_persona_id" INTEGER,
    "player_id" INTEGER,
    "game_id" INTEGER,
    "season_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tags" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "player_id" INTEGER,
    "game_id" INTEGER,
    "season_id" INTEGER,
    "game_player_stat_id" INTEGER,

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_personas" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_settings" (
    "id" SERIAL NOT NULL,
    "media_type" "media_type" NOT NULL,
    "model_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_scope_idx" ON "media"("scope");

-- CreateIndex
CREATE INDEX "media_viewed_idx" ON "media"("viewed");

-- CreateIndex
CREATE INDEX "media_player_id_idx" ON "media"("player_id");

-- CreateIndex
CREATE INDEX "media_game_id_idx" ON "media"("game_id");

-- CreateIndex
CREATE INDEX "media_season_id_idx" ON "media"("season_id");

-- CreateIndex
CREATE INDEX "media_tags_media_id_idx" ON "media_tags"("media_id");

-- CreateIndex
CREATE INDEX "media_tags_player_id_idx" ON "media_tags"("player_id");

-- CreateIndex
CREATE INDEX "media_tags_game_id_idx" ON "media_tags"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "author_personas_name_key" ON "author_personas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "model_settings_media_type_key" ON "model_settings"("media_type");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_author_persona_id_fkey" FOREIGN KEY ("author_persona_id") REFERENCES "author_personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_game_player_stat_id_fkey" FOREIGN KEY ("game_player_stat_id") REFERENCES "game_player_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
