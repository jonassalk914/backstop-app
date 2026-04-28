import { prisma } from "./prisma";

export type Slot = { start: Date; end: Date };

/**
 * Generate available slots for a coach over the next N days.
 * Strategy: walk weekly availability windows, slice into service-duration
 * chunks, drop any that overlap existing CONFIRMED bookings.
 *
 * Times are computed in the server's local TZ. For Vercel, set the project's
 * timezone via TZ env var (e.g. "America/New_York") so all coaches see
 * consistent slot generation. v2 should add per-coach timezones.
 */
export async function getAvailableSlots(
  coachId: string,
  serviceDurationMinutes: number,
  daysAhead: number = 14
): Promise<Slot[]> {
  const [availability, bookings] = await Promise.all([
    prisma.availability.findMany({ where: { coachId } }),
    prisma.booking.findMany({
      where: {
        coachId,
        status: "CONFIRMED",
        startTime: { gte: new Date() },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  if (availability.length === 0) return [];

  const slots: Slot[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000); // 1hr lead time

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    // Build "midnight today + offset" in local time so dayOfWeek matches
    // the time-of-day arithmetic that follows.
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    const dow = day.getDay();
    const windows = availability.filter((a) => a.dayOfWeek === dow);

    for (const w of windows) {
      let cursorMin = w.startMinute;
      while (cursorMin + serviceDurationMinutes <= w.endMinute) {
        const start = new Date(day.getTime() + cursorMin * 60 * 1000);
        const end = new Date(start.getTime() + serviceDurationMinutes * 60 * 1000);

        if (start >= cutoff) {
          const conflicts = bookings.some(
            (b) => start < b.endTime && end > b.startTime
          );
          if (!conflicts) slots.push({ start, end });
        }
        cursorMin += serviceDurationMinutes;
      }
    }
  }

  return slots;
}

/**
 * Atomically check + create a booking. Relies on the unique constraint
 * @@unique([coachId, startTime]) in the schema to prevent the race
 * where two requests pass the overlap check simultaneously.
 *
 * Returns { ok: true, bookingId } or { ok: false, reason }.
 */
export async function createBookingAtomic(args: {
  coachId: string;
  serviceId: string;
  playerId: string;
  startTime: Date;
  endTime: Date;
  priceCents: number;
  paymentMethod?: string;
}): Promise<{ ok: true; bookingId: string } | { ok: false; reason: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Overlap check (different start times that still collide)
      const overlap = await tx.booking.findFirst({
        where: {
          coachId: args.coachId,
          status: "CONFIRMED",
          AND: [
            { startTime: { lt: args.endTime } },
            { endTime: { gt: args.startTime } },
          ],
        },
        select: { id: true },
      });
      if (overlap) {
        return { ok: false as const, reason: "Time slot no longer available." };
      }

      const booking = await tx.booking.create({
        data: {
          coachId: args.coachId,
          serviceId: args.serviceId,
          playerId: args.playerId,
          startTime: args.startTime,
          endTime: args.endTime,
          priceCents: args.priceCents,
          paymentMethod: args.paymentMethod,
        },
      });
      return { ok: true as const, bookingId: booking.id };
    });
  } catch (e: any) {
    // P2002 = unique constraint violation (someone grabbed this exact slot)
    if (e?.code === "P2002") {
      return { ok: false, reason: "Time slot no longer available." };
    }
    throw e;
  }
}
