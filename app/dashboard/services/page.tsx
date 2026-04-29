"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  capacity: number;
  active: boolean;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [adding, setAdding] = useState(false);

  function load() {
    fetch("/api/services").then((r) => r.json()).then(setServices);
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="h-display text-3xl tracking-wider">SERVICES</h1>
          <p className="text-sm text-ink-muted mt-1">What you offer. Players pick from these when booking.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim"
        >
          + Add service
        </button>
      </div>

      {services.filter((s) => s.active).length === 0 && !adding && (
        <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
          No active services. Add one to start receiving bookings.
        </div>
      )}

      <div className="space-y-3">
        {adding && <ServiceForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
        {services.filter((s) => s.active).map((s) => (
          <ServiceRow key={s.id} service={s} onChanged={load} />
        ))}
      </div>

      {services.some((s) => !s.active) && (
        <details className="text-sm">
          <summary className="text-ink-muted cursor-pointer">Show archived</summary>
          <div className="space-y-2 mt-3 opacity-60">
            {services.filter((s) => !s.active).map((s) => (
              <div key={s.id} className="bg-bg-panel border border-line p-3 text-sm">
                <span className="line-through">{s.name}</span> — {s.durationMinutes}min · {formatMoney(s.priceCents)}
                {s.capacity > 1 && <> · group up to {s.capacity}</>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ServiceRow({ service, onChanged }: { service: Service; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  async function archive() {
    if (!confirm(`Archive "${service.name}"? Existing bookings keep this service.`)) return;
    await fetch(`/api/services/${service.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <ServiceForm
        initial={service}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChanged(); }}
      />
    );
  }

  return (
    <div className="bg-bg-panel border border-line p-4 flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold">{service.name}</div>
        <div className="text-sm text-ink-muted font-mono">
          {service.durationMinutes} MIN · {formatMoney(service.priceCents)}
          {service.capacity > 1 && <> · GROUP UP TO {service.capacity}</>}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(true)} className="text-xs font-mono text-ink-muted hover:text-ink px-2 py-1">
          EDIT
        </button>
        <button onClick={archive} className="text-xs font-mono text-bad hover:underline px-2 py-1">
          ARCHIVE
        </button>
      </div>
    </div>
  );
}

function ServiceForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Service;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [duration, setDuration] = useState(initial?.durationMinutes || 60);
  const [price, setPrice] = useState(initial ? (initial.priceCents / 100).toFixed(2) : "");
  const [capacity, setCapacity] = useState(initial?.capacity || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const priceCents = Math.round(parseFloat(price || "0") * 100);
    const cap = Math.max(1, Math.min(50, Math.floor(capacity || 1)));
    if (!name.trim() || duration < 15 || priceCents < 0) {
      setError("Please fill all fields. Duration must be at least 15 min.");
      return;
    }
    setSaving(true);
    const url = initial ? `/api/services/${initial.id}` : "/api/services";
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), durationMinutes: duration, priceCents, capacity: cap }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError("Save failed.");
  }

  return (
    <div className="bg-bg-elev border border-signal/40 p-4 space-y-3">
      <div>
        <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">NAME</label>
        <input
          placeholder="e.g. 1-on-1 Hitting Lesson"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">DURATION (MIN)</label>
          <input
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
          />
        </div>
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PRICE ($)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="75.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">
          CAPACITY (PLAYERS PER SLOT)
        </label>
        <input
          type="number"
          min={1}
          max={50}
          step={1}
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
        />
        <div className="text-xs text-ink-dim mt-1">
          1 = traditional 1-on-1. Increase for group lessons (e.g. 2 for a 2-on-1).
        </div>
      </div>
      {error && <div className="text-bad text-sm">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="border border-line px-4 py-2 hover:border-ink-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
