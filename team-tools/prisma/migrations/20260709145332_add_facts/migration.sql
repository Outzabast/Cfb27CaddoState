-- CreateEnum
CREATE TYPE "fact_scope" AS ENUM ('TEAM', 'SEASON', 'ROSTER');

-- AlterTable
ALTER TABLE "media_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "staff" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "facts" (
    "id" SERIAL NOT NULL,
    "scope" "fact_scope" NOT NULL,
    "season_id" INTEGER,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facts_scope_season_id_idx" ON "facts"("scope", "season_id");

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
