-- Weekly availability + per-date overrides.
-- Reverts the date-keyed Availability column and adds AvailabilityOverride.

-- Drop the date-based index from the previous migration
DROP INDEX IF EXISTS "Availability_coachId_date_idx";

-- Wipe existing rows (date-keyed data has no meaning under the weekly model)
TRUNCATE TABLE "Availability";

-- Swap `date` column back to `dayOfWeek`
ALTER TABLE "Availability" DROP COLUMN "date";
ALTER TABLE "Availability" ADD COLUMN "dayOfWeek" INTEGER NOT NULL;

CREATE INDEX "Availability_coachId_dayOfWeek_idx" ON "Availability"("coachId", "dayOfWeek");

-- New override table
CREATE TYPE "AvailabilityOverrideType" AS ENUM ('ADD', 'BLOCK');

CREATE TABLE "AvailabilityOverride" (
    "id"          TEXT NOT NULL,
    "coachId"     TEXT NOT NULL,
    "date"        DATE NOT NULL,
    "type"        "AvailabilityOverrideType" NOT NULL,
    "startMinute" INTEGER,
    "endMinute"   INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvailabilityOverride_coachId_date_idx" ON "AvailabilityOverride"("coachId", "date");

ALTER TABLE "AvailabilityOverride"
  ADD CONSTRAINT "AvailabilityOverride_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
