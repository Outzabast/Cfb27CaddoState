-- Manually-attributed notoriety bumps on a player (description + points).
CREATE TABLE "notoriety_events" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notoriety_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notoriety_events_player_id_idx" ON "notoriety_events"("player_id");
ALTER TABLE "notoriety_events" ADD CONSTRAINT "notoriety_events_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
