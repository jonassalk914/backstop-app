import { prisma } from "./prisma";

export type Slot = { start: Date; end: Date };
export type Range = { startMinute: number; endMinute: number };

/**
 * Compute effective availability ranges for a date, given:
 *   - weekly windows for that day-of-week
 *   - any per-date overrides (ADD or BLOCK; whole-day or partial)
 *
 * Formula: (weekly windows) − BLOCK ranges + ADD ranges, then merge overlaps.
 *
 * Whole-day overrides have null start/end and are normalized to [0, 1440].
 */
export function computeEffectiveRanges(
  weeklyWindows: Range[],
  overrides: Array<{ type: "ADD" | "BLOCK"; startMinute: number | null; endMinute: number | null }>
): Range[] {
  const blocks: Range[] = overrides
    .filter((o) => o.type === "BLOCK")
    .map((o) => normalizeRange(o));
  const adds: Range[] = overrides
    .filter((o) => o.type === "ADD")
    .map((o) => normalizeRange(o));

  // Subtract each BLOCK from the running set of weekly windows
  let running = weeklyWindows.map((w) => ({ ...w }));
  for (const b of blocks) running = subtractRange(running, b);

  // Add the ADD windows on top, then merge any overlaps/adjacencies
  return mergeRanges([...running, ...adds]);
}

function normalizeRange(o: { startMinute: number | null; endMinute: number | null }): Range {
  return {
    startMinute: o.startMinute ?? 0,
    endMinute: o.endMinute ?? 1440,
  };
}

/** Returns ranges where r ∩ blocked is removed. Each input range may split into 0, 1, or 2 outputs. */
function subtractRange(ranges: Range[], blocked: Range): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    // No overlap
    if (blocked.endMinute <= r.startMinute || blocked.startMinute >= r.endMinute) {
      out.push(r);
      continue;
    }
    // Left chunk survives
    if (blocked.startMinute > r.startMinute) {
      out.push({ startMinute: r.startMinute, endMinute: blocked.startMinute });
    }
    // Right chunk survives
    if (blocked.endMinute < r.endMinute) {
      out.push({ startMinute: blocked.endMinute, endMinute: r.endMinute });
    }
    // If blocked fully contains r, both chunks are dropped
  }
  return out;
}

/** Merge overlapping or adjacent ranges into a sorted, non-overlapping set. */
function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startMinute - b.startMinute);
  const out: Range[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const tail = out[out.length - 1];
    const cur = sorted[i];
    if (cur.startMinute <= tail.endMinute) {
      tail.endMinute = Math.max(tail.endMinute, cur.endMinute);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Generate available slots on a specific calendar date (YYYY-MM-DD).
 * Reads weekly availability for that DOW + per-date overrides, applies the
 * effective-ranges formula, slices into service-duration chunks, drops
 * chunks that overlap CONFIRMED bookings or fall inside the lead-time cutoff.
 */
export async function getSlotsForDate(
  coachId: string,
  serviceDurationMinutes: number,
  dateStr: string
): Promise<Slot[]> {
  const day = parseDateString(dateStr);
  if (!day) return [];

  const dayStart = new Date(day.getTime());
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const dow = day.getDay();

  const [weekly, overrides, bookings] = await Promise.all([
    prisma.availability.findMany({
      where: { coachId, dayOfWeek: dow },
      select: { startMinute: true, endMinute: true },
    }),
    prisma.availabilityOverride.findMany({
      where: { coachId, date: { gte: dayStart, lt: dayEnd } },
      select: { type: true, startMinute: true, endMinute: true },
    }),
    prisma.booking.findMany({
      where: {
        coachId,
        status: "CONFIRMED",
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const effective = computeEffectiveRanges(weekly, overrides);
  if (effective.length === 0) return [];

  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000);
  const slots: Slot[] = [];

  for (const range of effective) {
    let cursorMin = range.startMinute;
    while (cursorMin + serviceDurationMinutes <= range.endMinute) {
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

  return slots;
}

/**
 * Returns YYYY-MM-DD strings within [today, today+daysAhead) where the coach
 * has any effective availability. Used to dot/highlight calendar dates.
 *
 * Implementation: precompute weekly DOW set + load overrides in range, then
 * for each candidate day decide if it's effectively non-empty.
 */
export async function getAvailableDates(
  coachId: string,
  daysAhead: number = 60
): Promise<string[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysAhead);

  const [weekly, overrides] = await Promise.all([
    prisma.availability.findMany({
      where: { coachId },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    prisma.availabilityOverride.findMany({
      where: { coachId, date: { gte: start, lt: end } },
      select: { date: true, type: true, startMinute: true, endMinute: true },
    }),
  ]);

  // Group weekly by DOW for quick lookup
  const weeklyByDow = new Map<number, Range[]>();
  for (const w of weekly) {
    const arr = weeklyByDow.get(w.dayOfWeek) ?? [];
    arr.push({ startMinute: w.startMinute, endMinute: w.endMinute });
    weeklyByDow.set(w.dayOfWeek, arr);
  }

  // Group overrides by date
  const overridesByDate = new Map<string, typeof overrides>();
  for (const o of overrides) {
    const k = toDateString(o.date);
    const arr = overridesByDate.get(k) ?? [];
    arr.push(o);
    overridesByDate.set(k, arr);
  }

  const out: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateStr = toDateString(d);
    const weeklyForDow = weeklyByDow.get(d.getDay()) ?? [];
    const dayOverrides = overridesByDate.get(dateStr) ?? [];

    if (weeklyForDow.length === 0 && dayOverrides.length === 0) continue;

    const eff = computeEffectiveRanges(weeklyForDow, dayOverrides);
    if (eff.length > 0) out.push(dateStr);
  }
  return out;
}

/** Returns weekly + override rows for the schedule UI. */
export async function getScheduleData(coachId: string, daysAhead: number = 60) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysAhead);

  const [weekly, overrides] = await Promise.all([
    prisma.availability.findMany({
      where: { coachId },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    prisma.availabilityOverride.findMany({
      where: { coachId, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
  ]);

  return {
    weekly: weekly.map((w) => ({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    })),
    overrides: overrides.map((o) => ({
      id: o.id,
      date: toDateString(o.date),
      type: o.type,
      startMinute: o.startMinute,
      endMinute: o.endMinute,
    })),
  };
}

/** YYYY-MM-DD in local time (NOT UTC — pairs with parseDateString). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local-time midnight. Returns null if invalid. */
export function parseDateString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) {
    return null;
  }
  return date;
}

/**
 * Atomically check + create a booking. Relies on @@unique([coachId, startTime])
 * to prevent the race where two requests pass the overlap check simultaneously.
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
    if (e?.code === "P2002") {
      return { ok: false, reason: "Time slot no longer available." };
    }
    throw e;
  }
}
