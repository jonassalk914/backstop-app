"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatDateTime } from "@/lib/format";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

type Stats = {
  revenueThisMonthCents: number;
  projectedUpcomingCents: number;
  unpaidBalanceCents: number;
  paidCount: number;
  unpaidCount: number;
};

type UpcomingBooking = {
  id: string;
  startTime: string;
  player: { name: string };
  service: { name: string };
  paymentStatus: string;
};

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/financial").then((r) => r.json()),
      fetch("/api/bookings?filter=upcoming").then((r) => r.json()),
      fetch("/api/coach/settings").then((r) => r.json()),
    ]).then(([fin, bookings, settings]) => {
      setStats(fin);
      setUpcoming(bookings.slice(0, 5));
      setSlug(settings.slug);
      if (settings?.timezone) setTimezone(settings.timezone);
    });
  }, []);

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${slug}`
    : `/book/${slug}`;

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Booking link callout */}
      <div className="bg-bg-panel border border-line p-5">
        <div className="text-xs font-mono tracking-widest text-signal mb-2">YOUR BOOKING LINK</div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <code className="font-mono text-sm text-ink flex-1 truncate">{bookingUrl}</code>
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="bg-signal text-bg px-4 py-2 text-sm font-semibold hover:bg-signal-dim transition"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <Link
              href={`/book/${slug}`}
              target="_blank"
              className="border border-line px-4 py-2 text-sm font-semibold hover:border-ink-muted"
            >
              Preview ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="h-display text-2xl tracking-wider mb-4">AT A GLANCE</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          <Stat
            label="THIS MONTH"
            value={stats ? formatMoney(stats.revenueThisMonthCents) : "—"}
            tone="signal"
          />
          <Stat
            label="UPCOMING"
            value={stats ? formatMoney(stats.projectedUpcomingCents) : "—"}
            tone="default"
          />
          <Stat
            label="UNPAID"
            value={stats ? formatMoney(stats.unpaidBalanceCents) : "—"}
            tone="warn"
          />
          <Stat
            label="UNPAID SESSIONS"
            value={stats ? `${stats.unpaidCount}` : "—"}
            tone="default"
          />
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="h-display text-2xl tracking-wider">NEXT UP</h2>
          <Link href="/dashboard/bookings" className="text-xs font-mono text-ink-muted hover:text-ink">
            ALL BOOKINGS →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
            No upcoming sessions yet. Share your booking link to get started.
          </div>
        ) : (
          <div className="border border-line">
            {upcoming.map((b, i) => (
              <Link
                key={b.id}
                href="/dashboard/bookings"
                className={`flex items-center justify-between p-4 hover:bg-bg-hover transition ${
                  i > 0 ? "border-t border-line" : ""
                } bg-bg-panel`}
              >
                <div>
                  <div className="font-semibold">{b.player.name}</div>
                  <div className="text-sm text-ink-muted">
                    {b.service.name} · {formatDateTime(new Date(b.startTime), timezone)}
                  </div>
                </div>
                <PaymentBadge status={b.paymentStatus} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "signal" | "warn" }) {
  const color = tone === "signal" ? "text-signal" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="bg-bg-panel p-5">
      <div className="text-xs font-mono tracking-widest text-ink-dim mb-2">{label}</div>
      <div className={`h-display text-3xl ${color}`}>{value}</div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-ok/10 text-ok border-ok/30",
    UNPAID: "bg-warn/10 text-warn border-warn/30",
    PARTIAL: "bg-warn/10 text-warn border-warn/30",
    CANCELLED: "bg-bad/10 text-bad border-bad/30",
  };
  return (
    <span className={`text-[10px] font-mono tracking-widest px-2 py-1 border ${styles[status] || ""}`}>
      {status}
    </span>
  );
}
