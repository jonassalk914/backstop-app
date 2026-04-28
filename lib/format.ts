export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}
