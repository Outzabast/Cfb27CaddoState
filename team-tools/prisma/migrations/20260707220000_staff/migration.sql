CREATE TYPE "staff_role" AS ENUM ('HEAD_COACH', 'OFFENSIVE_COORDINATOR', 'DEFENSIVE_COORDINATOR');

CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "photo" BYTEA,
    "overall_notoriety" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "season_staff" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "staff_name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "season_notoriety" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "season_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "season_staff_season_id_role_key" ON "season_staff"("season_id", "role");
CREATE INDEX "season_staff_staff_id_idx" ON "season_staff"("staff_id");

ALTER TABLE "season_staff" ADD CONSTRAINT "season_staff_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_staff" ADD CONSTRAINT "season_staff_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
