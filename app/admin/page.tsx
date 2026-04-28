"use client";
import { useEffect, useState } from "react";

type AdminCoach = {
  id: string;
  email: string;
  name: string;
  slug: string;
  enabled: boolean;
  createdAt: string;
  playerCount: number;
  bookingCount: number;
};

export default function AdminPage() {
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/admin/coaches")
      .then((r) => r.json())
      .then((d) => { setCoaches(d); setLoading(false); });
  }

  useEffect(load, []);

  async function toggleEnabled(c: AdminCoach) {
    const action = c.enabled ? "Disable" : "Enable";
    if (!confirm(`${action} ${c.name}?`)) return;
    await fetch(`/api/admin/coaches/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-3xl tracking-wider">COACHES</h1>
        <p className="text-sm text-ink-muted mt-1">{coaches.length} total · {coaches.filter(c => c.enabled).length} enabled</p>
      </div>

      {loading ? (
        <div className="text-ink-muted">Loading…</div>
      ) : coaches.length === 0 ? (
        <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
          No coaches yet.
        </div>
      ) : (
        <div className="border border-line">
          <div className="bg-bg-elev px-4 py-2 grid grid-cols-12 gap-3 text-[10px] font-mono tracking-widest text-ink-dim">
            <div className="col-span-4">COACH</div>
            <div className="col-span-3">SLUG</div>
            <div className="col-span-1 text-right">PLAYERS</div>
            <div className="col-span-1 text-right">BOOKINGS</div>
            <div className="col-span-1 text-right">SINCE</div>
            <div className="col-span-2 text-right">STATUS</div>
          </div>
          {coaches.map((c, i) => (
            <div
              key={c.id}
              className={`px-4 py-3 grid grid-cols-12 gap-3 items-center bg-bg-panel ${
                i > 0 ? "border-t border-line" : ""
              } ${!c.enabled ? "opacity-60" : ""}`}
            >
              <div className="col-span-4 min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-ink-muted truncate">{c.email}</div>
              </div>
              <div className="col-span-3 text-xs font-mono text-ink-muted truncate">/book/{c.slug}</div>
              <div className="col-span-1 text-right font-mono">{c.playerCount}</div>
              <div className="col-span-1 text-right font-mono">{c.bookingCount}</div>
              <div className="col-span-1 text-right text-xs text-ink-muted font-mono">
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => toggleEnabled(c)}
                  className={`text-[10px] font-mono tracking-widest px-3 py-1.5 border ${
                    c.enabled
                      ? "border-ok/40 text-ok hover:bg-ok/10"
                      : "border-bad/40 text-bad hover:bg-bad/10"
                  }`}
                >
                  {c.enabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
