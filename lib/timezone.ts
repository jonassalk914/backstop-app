/**
 * Timezone helpers. The coach's stored `timezone` (IANA, e.g. "America/New_York")
 * is the canonical wall-clock for weekly windows, slots, and bookings. Every
 * player/coach surface formats absolute UTC instants through this zone so both
 * sides see the same time regardless of their browser/server location.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Convert (date, minutes-from-midnight) interpreted in `tz` to a UTC Date.
 *
 * Example: zonedDateMinutesToUtc("2026-04-28", 16*60, "America/New_York")
 * returns the UTC moment that displays as 2026-04-28 16:00 in NY (= 20:00 UTC
 * during DST).
 *
 * Strategy: Date.UTC(...) gives the moment whose UTC wall-clock matches the
 * inputs. Format that moment in `tz` to read back the wall-clock the zone
 * sees; the difference is the zone's offset at that instant. Subtract it.
 */
export function zonedDateMinutesToUtc(dateStr: string, minutes: number, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Invalid date string: ${dateStr}`);
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;

  const asUtc = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  const offsetMs = tzOffsetMs(asUtc, tz);
  return new Date(asUtc - offsetMs);
}

/**
 * The offset (ms) of `tz` from UTC at the given UTC instant. Positive when
 * the zone is ahead of UTC, negative when behind. Handles DST transitions.
 */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  let h = get("hour");
  if (h === 24) h = 0; // Intl quirk: midnight reported as "24"
  const tzWallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  return tzWallAsUtc - utcMs;
}

/** Day-of-week (0=Sun..6=Sat) for `date` as observed in `tz`. */
export function zonedDayOfWeek(date: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** YYYY-MM-DD for `date` as observed in `tz`. */
export function zonedDateString(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "4:00 PM" in `tz`. */
export function formatTimeInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "Mon, Apr 28" in `tz`. */
export function formatDateInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** "Mon, Apr 28 at 4:00 PM" in `tz`. */
export function formatDateTimeInTz(date: Date, tz: string): string {
  return `${formatDateInTz(date, tz)} at ${formatTimeInTz(date, tz)}`;
}

/** "Monday, April 28, 2026 at 4:00 PM" in `tz`. */
export function formatLongDateTimeInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Short timezone label ("EDT", "PST", "GMT+1") observed in `tz` right now. */
export function tzAbbreviation(tz: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** Whether the runtime accepts `tz` as a valid IANA name. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Common IANA zones for the settings selector. We don't try to enumerate
 * every zone — coaches operate in a small set of regions in practice.
 */
export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Toronto", label: "Eastern — Canada (Toronto)" },
  { value: "America/Vancouver", label: "Pacific — Canada (Vancouver)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "UTC", label: "UTC" },
];
