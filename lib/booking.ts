import { prisma } from "./prisma";
import {
  DEFAULT_TIMEZONE,
  zonedDateMinutesToUtc,
  zonedDayOfWeek,
  zonedDateString,
} from "./timezone";

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
 *
 * `tz` defaults to America/New_York and represents the wall-clock the coach
 * uses for their weekly windows. The returned Slot start/end are absolute
 * UTC instants whose wall-clock in `tz` matches the configured minutes.
 */
export async function getSlotsForDate(
  coachId: string,
  serviceDurationMinutes: number,
  dateStr: string,
  tz: string = DEFAULT_TIMEZONE
): Promise<Slot[]> {
  if (!parseDateString(dateStr)) return [];

  // The day boundaries we query against the DB are absolute UTC instants
  // anchored to midnight in the coach's tz, NOT server-local midnight.
  const dayStart = zonedDateMinutesToUtc(dateStr, 0, tz);
  const dayEnd = zonedDateMinutesToUtc(dateStr, 24 * 60, tz);
  const dow = zonedDayOfWeek(dayStart, tz);

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

  // Step granularity: 30 min for typical lessons, smaller for short services.
  // E.g. a 60-min service in a 4-7pm window yields [4:00, 4:30, 5:00, 5:30, 6:00]
  // rather than [4:00, 5:00, 6:00] — gives players more flexibility, Calendly-style.
  const stepMin = Math.min(30, serviceDurationMinutes);

  for (const range of effective) {
    let cursorMin = range.startMinute;
    while (cursorMin + serviceDurationMinutes <= range.endMinute) {
      const start = zonedDateMinutesToUtc(dateStr, cursorMin, tz);
      const end = new Date(start.getTime() + serviceDurationMinutes * 60 * 1000);

      if (start >= cutoff) {
        const conflicts = bookings.some(
          (b) => start < b.endTime && end > b.startTime
        );
        if (!conflicts) slots.push({ start, end });
      }
      cursorMin += stepMin;
    }
  }

  return slots;
}

/**
 * Returns YYYY-MM-DD strings within [today, today+daysAhead) where the coach
 * has any effective availability. Used to dot/highlight calendar dates.
 *
 * Implementation: precompute weekly DOW set + load overrides in range, then
 * for each candidate day decide if it's effectively non-empty. Day boundaries
 * are anchored to the coach's tz so the dot lights up on the right calendar
 * cell regardless of where the server lives.
 */
export async function getAvailableDates(
  coachId: string,
  daysAhead: number = 60,
  tz: string = DEFAULT_TIMEZONE
): Promise<string[]> {
  const todayStr = zonedDateString(new Date(), tz);
  const start = zonedDateMinutesToUtc(todayStr, 0, tz);
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);

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

  // Override `date` is a @db.Date so its UTC value is the date at 00:00 UTC;
  // its YYYY-MM-DD label is independent of tz.
  const overridesByDate = new Map<string, typeof overrides>();
  for (const o of overrides) {
    const k = toDateString(o.date);
    const arr = overridesByDate.get(k) ?? [];
    arr.push(o);
    overridesByDate.set(k, arr);
  }

  const out: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const dayStartUtc = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = zonedDateString(dayStartUtc, tz);
    const dow = zonedDayOfWeek(dayStartUtc, tz);
    const weeklyForDow = weeklyByDow.get(dow) ?? [];
    const dayOverrides = overridesByDate.get(dateStr) ?? [];

    if (weeklyForDow.length === 0 && dayOverrides.length === 0) continue;

    const eff = computeEffectiveRanges(weeklyForDow, dayOverrides);
    if (eff.length > 0) out.push(dateStr);
  }
  return out;
}

/**
 * Returns weekly + override rows + upcoming bookings for the schedule UI.
 * Booking start/end times are decomposed into the coach's tz so the calendar
 * cells line up with the same wall clock the coach typed into the editor.
 */
export async function getScheduleData(
  coachId: string,
  daysAhead: number = 60,
  tz: string = DEFAULT_TIMEZONE
) {
  const todayStr = zonedDateString(new Date(), tz);
  const start = zonedDateMinutesToUtc(todayStr, 0, tz);
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const [weekly, overrides, bookings] = await Promise.all([
    prisma.availability.findMany({
      where: { coachId },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    prisma.availabilityOverride.findMany({
      where: { coachId, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
    prisma.booking.findMany({
      where: {
        coachId,
        status: "CONFIRMED",
        startTime: { gte: start, lt: end },
      },
      include: {
        player: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
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
    bookings: bookings.map((b) => {
      const [date, startMin] = splitInTz(b.startTime, tz);
      const [, endMin] = splitInTz(b.endTime, tz);
      return {
        id: b.id,
        date,
        startMinute: startMin,
        endMinute: endMin,
        playerName: b.player.name,
        serviceName: b.service.name,
      };
    }),
  };
}

/** Decompose a UTC instant into [YYYY-MM-DD, minutes-from-midnight] in `tz`. */
function splitInTz(d: Date, tz: string): [string, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let h = parseInt(get("hour"), 10);
  if (h === 24) h = 0;
  const m = parseInt(get("minute"), 10);
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  return [dateStr, h * 60 + m];
}

/**
 * YYYY-MM-DD for Prisma `@db.Date` values. Postgres deserializes those as
 * UTC-midnight Dates, so we read the calendar fields in UTC — server-local
 * extraction would shift the date one back when the server is west of UTC.
 */
export function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse YYYY-MM-DD as UTC-midnight. Returns null if invalid.
 *
 * UTC (not server-local) so that storing the result in a Postgres `@db.Date`
 * column always truncates to the same calendar date the user typed, even when
 * the server is several timezones east or west of UTC.
 */
export function parseDateString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const date = new Date(Date.UTC(y, mo, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) {
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
