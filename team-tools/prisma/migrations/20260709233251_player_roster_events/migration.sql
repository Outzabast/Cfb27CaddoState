-- CreateEnum
CREATE TYPE "roster_event_type" AS ENUM ('JOINED_RECRUIT', 'JOINED_TRANSFER', 'NAMED_STARTER', 'LOST_STARTER', 'GRADUATED', 'TRANSFERRED_OUT', 'OTHER');

-- CreateTable
CREATE TABLE "player_roster_events" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "season_id" INTEGER,
    "type" "roster_event_type" NOT NULL,
    "counterparty" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_roster_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_roster_events_player_id_idx" ON "player_roster_events"("player_id");

-- AddForeignKey
ALTER TABLE "player_roster_events" ADD CONSTRAINT "player_roster_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_roster_events" ADD CONSTRAINT "player_roster_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
