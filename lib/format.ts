export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/**
 * Time/date formatters. Pass a timezone (the coach's IANA tz) so player and
 * coach see the same wall clock regardless of where their browser/server is.
 * The `tz`-less variants kept for any caller that still wants browser-local
 * — but most surfaces should pass tz explicitly.
 */
export function formatTime(date: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDate(date: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, tz?: string): string {
  return `${formatDate(date, tz)} at ${formatTime(date, tz)}`;
}
