-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('ACTIVE', 'INJURED', 'OUT', 'SUSPENDED', 'INACTIVE');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "height_inches" INTEGER,
ADD COLUMN     "hometown" TEXT,
ADD COLUMN     "status" "player_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "weight_lbs" INTEGER;
