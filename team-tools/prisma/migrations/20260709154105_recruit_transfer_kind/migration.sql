-- CreateEnum
CREATE TYPE "recruit_kind" AS ENUM ('HIGH_SCHOOL', 'TRANSFER');

-- AlterTable
ALTER TABLE "recruits" ADD COLUMN     "eligibility_years" INTEGER,
ADD COLUMN     "kind" "recruit_kind" NOT NULL DEFAULT 'HIGH_SCHOOL',
ADD COLUMN     "previous_school" TEXT;
