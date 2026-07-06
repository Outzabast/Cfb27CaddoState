-- CreateEnum
CREATE TYPE "player_class" AS ENUM ('FRESHMAN', 'REDSHIRT_FRESHMAN', 'SOPHOMORE', 'REDSHIRT_SOPHOMORE', 'JUNIOR', 'REDSHIRT_JUNIOR', 'SENIOR', 'REDSHIRT_SENIOR', 'GRADUATED', 'TRANSFERRED');

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" VARCHAR(8) NOT NULL,
    "class" "player_class" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_entries" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "number" INTEGER,

    CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seasons_name_key" ON "seasons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roster_entries_season_id_player_id_key" ON "roster_entries"("season_id", "player_id");

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
