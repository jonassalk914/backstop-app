"use client";
import { useEffect, useState } from "react";
import { COMMON_TIMEZONES, tzAbbreviation } from "@/lib/timezone";

type Settings = {
  email: string;
  firstName: string;
  lastName: string;
  slug: string;
  phone: string | null;
  paymentInstructions: string | null;
  paymentMethods: string[];
  timezone: string;
};

const COMMON_METHODS = ["Venmo", "Cash App", "Zelle", "Cash", "PayPal", "Check"];

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/settings").then((r) => r.json()).then((data) => {
      setS(data);
      setMethods(data.paymentMethods);
    });
  }, []);

  async function save() {
    if (!s) return;
    setError(null);
    setSaving(true);
    const res = await fetch("/api/coach/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: s.firstName,
        lastName: s.lastName,
        slug: s.slug,
        phone: s.phone,
        paymentInstructions: s.paymentInstructions,
        paymentMethods: methods,
        timezone: s.timezone,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed.");
    }
  }

  function toggleMethod(m: string) {
    setMethods(methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]);
  }

  if (!s) return <div className="text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-8 max-w-xl">
      <h1 className="h-display text-3xl tracking-wider">SETTINGS</h1>

      <section className="space-y-4">
        <div className="text-xs font-mono tracking-widest text-signal">PROFILE</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">FIRST</label>
            <input value={s.firstName} onChange={(e) => setS({ ...s, firstName: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">LAST</label>
            <input value={s.lastName} onChange={(e) => setS({ ...s, lastName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">EMAIL</label>
          <input value={s.email} disabled className="opacity-60" />
        </div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PHONE (OPTIONAL)</label>
          <input
            value={s.phone || ""}
            onChange={(e) => setS({ ...s, phone: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-mono tracking-widest text-signal">BOOKING LINK</div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">SLUG</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-muted whitespace-nowrap">/book/</span>
            <input value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value })} />
          </div>
          <div className="text-xs text-ink-dim mt-1">
            Lowercase letters, numbers, and hyphens only.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-mono tracking-widest text-signal">TIMEZONE</div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">
            COACH TIMEZONE
          </label>
          <select
            value={s.timezone}
            onChange={(e) => setS({ ...s, timezone: e.target.value })}
          >
            {COMMON_TIMEZONES.some((t) => t.value === s.timezone) ? null : (
              <option value={s.timezone}>{s.timezone}</option>
            )}
            {COMMON_TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="text-xs text-ink-dim mt-1">
            Currently {tzAbbreviation(s.timezone)}. Times shown to you and to players are in this zone, so both sides see the same wall clock.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-mono tracking-widest text-signal">PAYMENT</div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-2 block">
            METHODS YOU ACCEPT
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => toggleMethod(m)}
                className={`px-3 py-1.5 text-sm border transition ${
                  methods.includes(m)
                    ? "bg-signal text-bg border-signal"
                    : "border-line text-ink-muted hover:border-ink-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">
            PAYMENT INSTRUCTIONS (SHOWN TO PLAYERS)
          </label>
          <textarea
            rows={4}
            placeholder="e.g. Venmo @mike-coach (last 4: 1234) — please include player's name in note."
            value={s.paymentInstructions || ""}
            onChange={(e) => setS({ ...s, paymentInstructions: e.target.value })}
          />
        </div>
      </section>

      {error && <div className="text-bad text-sm">{error}</div>}

      <button
        onClick={save}
        disabled={saving}
        className="bg-signal text-bg px-6 py-3 font-semibold hover:bg-signal-dim disabled:opacity-50"
      >
        {savedFlash ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
