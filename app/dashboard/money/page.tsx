"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatMoney, formatDateTime } from "@/lib/format";

type FinancialData = {
  revenueThisMonthCents: number;
  projectedUpcomingCents: number;
  unpaidBalanceCents: number;
  paidCount: number;
  unpaidCount: number;
  revenueByService: { name: string; cents: number }[];
  revenueByPlayer: { name: string; cents: number }[];
  monthlyTrend: { month: string; cents: number }[];
  unpaidBookings: {
    id: string;
    startTime: string;
    playerName: string;
    serviceName: string;
    priceCents: number;
    amountPaidCents: number;
    paymentStatus: string;
  }[];
};

export default function MoneyPage() {
  const [data, setData] = useState<FinancialData | null>(null);

  useEffect(() => {
    fetch("/api/financial").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return <div className="text-ink-muted">Loading…</div>;
  }

  const trendData = data.monthlyTrend.map((m) => ({ ...m, dollars: m.cents / 100 }));
  const serviceData = data.revenueByService.map((s) => ({ ...s, dollars: s.cents / 100 }));

  async function markPaid(id: string) {
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID" }),
    });
    const fresh = await fetch("/api/financial").then((r) => r.json());
    setData(fresh);
  }

  return (
    <div className="space-y-8">
      <h1 className="h-display text-3xl tracking-wider">FINANCES</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        <BigStat label="THIS MONTH" value={formatMoney(data.revenueThisMonthCents)} tone="signal" />
        <BigStat label="PROJECTED" value={formatMoney(data.projectedUpcomingCents)} sub="from upcoming" />
        <BigStat label="OUTSTANDING" value={formatMoney(data.unpaidBalanceCents)} tone="warn" />
        <BigStat
          label="PAID / UNPAID"
          value={`${data.paidCount} / ${data.unpaidCount}`}
          sub="sessions"
        />
      </div>

      {/* Trend */}
      <div className="bg-bg-panel border border-line p-5">
        <div className="text-xs font-mono tracking-widest text-ink-dim mb-4">REVENUE — LAST 6 MONTHS</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <XAxis dataKey="month" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                cursor={{ fill: "rgba(212,255,0,0.05)" }}
                contentStyle={{ background: "#1c1c1c", border: "1px solid #2a2a2a", fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
              />
              <Bar dataKey="dollars" fill="#d4ff00" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By service + by player */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-bg-panel border border-line p-5">
          <div className="text-xs font-mono tracking-widest text-ink-dim mb-4">REVENUE BY SERVICE</div>
          {serviceData.length === 0 ? (
            <div className="text-ink-muted text-sm">No paid sessions yet.</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceData} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#a3a3a3"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1c1c1c", border: "1px solid #2a2a2a", fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                  />
                  <Bar dataKey="dollars" radius={[0, 2, 2, 0]}>
                    {serviceData.map((_, i) => (
                      <Cell key={i} fill="#d4ff00" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-bg-panel border border-line p-5">
          <div className="text-xs font-mono tracking-widest text-ink-dim mb-4">TOP PLAYERS</div>
          {data.revenueByPlayer.length === 0 ? (
            <div className="text-ink-muted text-sm">No paid sessions yet.</div>
          ) : (
            <div className="space-y-2">
              {data.revenueByPlayer.map((p, i) => {
                const max = data.revenueByPlayer[0]?.cents || 1;
                const pct = (p.cents / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{p.name}</span>
                      <span className="font-mono">{formatMoney(p.cents)}</span>
                    </div>
                    <div className="h-1.5 bg-bg-elev">
                      <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unpaid list */}
      <div>
        <h2 className="h-display text-2xl tracking-wider mb-4">OUTSTANDING PAYMENTS</h2>
        {data.unpaidBookings.length === 0 ? (
          <div className="bg-bg-panel border border-line p-6 text-center text-ink-muted">
            No outstanding payments. 💪
          </div>
        ) : (
          <div className="border border-line">
            {data.unpaidBookings.map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center justify-between p-4 bg-bg-panel ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <div>
                  <div className="font-semibold">{b.playerName}</div>
                  <div className="text-sm text-ink-muted">
                    {b.serviceName} · {formatDateTime(new Date(b.startTime))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-warn">
                      {formatMoney(b.priceCents - b.amountPaidCents)}
                    </div>
                    <div className="text-[10px] font-mono text-ink-dim">
                      {b.paymentStatus === "PARTIAL" ? "REMAINING" : "DUE"}
                    </div>
                  </div>
                  <button
                    onClick={() => markPaid(b.id)}
                    className="bg-ok/20 text-ok border border-ok/40 px-3 py-1.5 text-xs font-mono tracking-widest hover:bg-ok/30"
                  >
                    MARK PAID
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "signal" | "warn";
}) {
  const color = tone === "signal" ? "text-signal" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="bg-bg-panel p-5">
      <div className="text-xs font-mono tracking-widest text-ink-dim mb-2">{label}</div>
      <div className={`h-display text-3xl ${color}`}>{value}</div>
      {sub && <div className="text-xs text-ink-dim mt-1">{sub}</div>}
    </div>
  );
}
