-- AlterTable
ALTER TABLE "Service" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 1;

-- DropIndex (group lessons need multiple bookings at same coach+startTime)
DROP INDEX "Booking_coachId_startTime_key";

-- CreateIndex (fast group-count lookups in the booking transaction)
CREATE INDEX "Booking_coachId_serviceId_startTime_idx" ON "Booking"("coachId", "serviceId", "startTime");
