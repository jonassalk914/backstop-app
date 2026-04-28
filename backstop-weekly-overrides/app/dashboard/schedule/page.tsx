"use client";
import { useEffect, useMemo, useState } from "react";

const DOW_LABELS_LONG = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DOW_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

type WeeklyWindow = {
  id?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type Override = {
  id: string;
  date: string;
  type: "ADD" | "BLOCK";
  startMinute: number | null;
  endMinute: number | null;
};

type Range = { startMinute: number; endMinute: number };

/* ---------- helpers ---------- */

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeStrToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTimeDisplay(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Mirror of computeEffectiveRanges in lib/booking.ts — kept client-side for the calendar viz. */
function computeEffective(weekly: Range[], overrides: Override[]): Range[] {
  const blocks = overrides
    .filter((o) => o.type === "BLOCK")
    .map((o) => ({ startMinute: o.startMinute ?? 0, endMinute: o.endMinute ?? 1440 }));
  const adds = overrides
    .filter((o) => o.type === "ADD")
    .map((o) => ({ startMinute: o.startMinute ?? 0, endMinute: o.endMinute ?? 1440 }));

  let running = weekly.map((w) => ({ ...w }));
  for (const b of blocks) {
    const next: Range[] = [];
    for (const r of running) {
      if (b.endMinute <= r.startMinute || b.startMinute >= r.endMinute) {
        next.push(r);
        continue;
      }
      if (b.startMinute > r.startMinute) next.push({ startMinute: r.startMinute, endMinute: b.startMinute });
      if (b.endMinute < r.endMinute) next.push({ startMinute: b.endMinute, endMinute: r.endMinute });
    }
    running = next;
  }
  const merged = [...running, ...adds].sort((a, b) => a.startMinute - b.startMinute);
  if (merged.length === 0) return [];
  const out: Range[] = [{ ...merged[0] }];
  for (let i = 1; i < merged.length; i++) {
    const tail = out[out.length - 1];
    const cur = merged[i];
    if (cur.startMinute <= tail.endMinute) {
      tail.endMinute = Math.max(tail.endMinute, cur.endMinute);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/* ---------- main ---------- */

export default function SchedulePage() {
  const [weekly, setWeekly] = useState<WeeklyWindow[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load() {
    const data = await fetch("/api/availability").then((r) => r.json());
    setWeekly(data.weekly);
    setOverrides(data.overrides);
  }

  useEffect(() => { load(); }, []);

  /* ---- weekly editor handlers ---- */

  function addWeekly(dow: number) {
    setWeekly([...weekly, { dayOfWeek: dow, startMinute: 9 * 60, endMinute: 17 * 60 }]);
  }
  function updateWeekly(idx: number, patch: Partial<WeeklyWindow>) {
    setWeekly(weekly.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }
  function removeWeekly(idx: number) {
    setWeekly(weekly.filter((_, i) => i !== idx));
  }

  async function saveWeekly() {
    for (const w of weekly) {
      if (w.endMinute <= w.startMinute) {
        alert("End time must be after start time on every weekly window.");
        return;
      }
    }
    setSavingWeekly(true);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        windows: weekly.map((w) => ({
          dayOfWeek: w.dayOfWeek,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
      }),
    });
    setSavingWeekly(false);
    if (res.ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      load();
    }
  }

  return (
    <div className="space-y-10">
      {/* ---------- WEEKLY EDITOR ---------- */}
      <section className="space-y-4">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="h-display text-3xl tracking-wider">WEEKLY AVAILABILITY</h1>
            <p className="text-sm text-ink-muted mt-1">Recurring hours every week. The calendar below shows the effective schedule with any date-specific overrides.</p>
          </div>
          <button
            onClick={saveWeekly}
            disabled={savingWeekly}
            className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim disabled:opacity-50"
          >
            {savedFlash ? "Saved ✓" : savingWeekly ? "Saving…" : "Save weekly"}
          </button>
        </div>

        <div className="space-y-2">
          {DOW_LABELS_LONG.map((day, dow) => {
            const dayWindows = weekly.map((w, i) => ({ ...w, idx: i })).filter((w) => w.dayOfWeek === dow);
            return (
              <div key={dow} className="bg-bg-panel border border-line p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-sm tracking-widest">{day}</div>
                  <button
                    onClick={() => addWeekly(dow)}
                    className="text-xs font-mono text-signal hover:underline"
                  >
                    + ADD
                  </button>
                </div>
                {dayWindows.length === 0 ? (
                  <div className="text-sm text-ink-dim">Off</div>
                ) : (
                  <div className="space-y-2">
                    {dayWindows.map((w) => (
                      <div key={w.idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={minutesToTimeStr(w.startMinute)}
                          onChange={(e) => updateWeekly(w.idx, { startMinute: timeStrToMinutes(e.target.value) })}
                          className="!w-auto"
                        />
                        <span className="text-ink-muted">→</span>
                        <input
                          type="time"
                          value={minutesToTimeStr(w.endMinute)}
                          onChange={(e) => updateWeekly(w.idx, { endMinute: timeStrToMinutes(e.target.value) })}
                          className="!w-auto"
                        />
                        <button
                          onClick={() => removeWeekly(w.idx)}
                          className="text-bad text-sm font-mono px-2 hover:underline"
                        >
                          REMOVE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- CALENDAR VIZ + OVERRIDES ---------- */}
      <section className="space-y-4">
        <div>
          <h2 className="h-display text-3xl tracking-wider">CALENDAR</h2>
          <p className="text-sm text-ink-muted mt-1">
            Upcoming dates with effective availability. Click a date to add a one-off override (extra time or a block).
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <CalendarGrid
            weekly={weekly}
            overrides={overrides}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
          <div className="bg-bg-panel border border-line p-4 min-h-[300px]">
            {selectedDate ? (
              <DayPanel
                date={selectedDate}
                weekly={weekly}
                overrides={overrides}
                onChanged={load}
                onClose={() => setSelectedDate(null)}
              />
            ) : (
              <div className="text-ink-muted text-sm py-8 text-center">
                Pick a date on the calendar to see effective availability and add overrides.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- calendar grid ---------- */

function CalendarGrid({
  weekly,
  overrides,
  selectedDate,
  onSelect,
}: {
  weekly: WeeklyWindow[];
  overrides: Override[];
  selectedDate: string | null;
  onSelect: (d: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Group weekly by DOW + overrides by date for quick lookup
  const weeklyByDow = useMemo(() => {
    const m = new Map<number, Range[]>();
    for (const w of weekly) {
      const arr = m.get(w.dayOfWeek) ?? [];
      arr.push({ startMinute: w.startMinute, endMinute: w.endMinute });
      m.set(w.dayOfWeek, arr);
    }
    return m;
  }, [weekly]);

  const overridesByDate = useMemo(() => {
    const m = new Map<string, Override[]>();
    for (const o of overrides) {
      const arr = m.get(o.date) ?? [];
      arr.push(o);
      m.set(o.date, arr);
    }
    return m;
  }, [overrides]);

  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);
  const leadingBlanks = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const maxDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60), [today]);
  const canGoBack = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoForward = viewYear < maxDate.getFullYear() || (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());

  function shift(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-bg-panel border border-line p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="text-sm font-mono px-2 py-1 disabled:opacity-30 hover:text-signal"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="font-mono text-sm tracking-widest uppercase">{monthLabel}</div>
        <button
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="text-sm font-mono px-2 py-1 disabled:opacity-30 hover:text-signal"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DOW_LABELS_SHORT.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-mono text-ink-dim py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const isPast = cell.dateStr < todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const dow = parseDateStr(cell.dateStr).getDay();
          const dayWeekly = weeklyByDow.get(dow) ?? [];
          const dayOverrides = overridesByDate.get(cell.dateStr) ?? [];
          const effective = computeEffective(dayWeekly, dayOverrides);
          const hasAvailability = effective.length > 0;
          const hasOverride = dayOverrides.length > 0;

          return (
            <button
              key={cell.dateStr}
              onClick={() => !isPast && onSelect(cell.dateStr)}
              disabled={isPast}
              className={[
                "aspect-square flex flex-col items-center justify-center text-sm font-mono border transition relative",
                isSelected
                  ? "bg-signal text-bg border-signal"
                  : isPast
                    ? "border-transparent text-ink-dim/40 cursor-not-allowed"
                    : hasAvailability
                      ? "border-signal/40 text-ink hover:border-signal"
                      : "border-line text-ink-dim hover:border-ink-muted",
                isToday && !isSelected ? "ring-1 ring-ink-muted/30" : "",
              ].join(" ")}
            >
              <span>{cell.day}</span>
              <div className="absolute bottom-1 flex gap-0.5">
                {hasAvailability && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-signal" />
                )}
                {hasOverride && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-warn" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-[10px] font-mono text-ink-dim flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="inline-block w-1 h-1 rounded-full bg-signal align-middle mr-1" />AVAILABLE</span>
        <span><span className="inline-block w-1 h-1 rounded-full bg-warn align-middle mr-1" />OVERRIDE</span>
        <span><span className="inline-block w-2 h-2 bg-signal align-middle mr-1" />SELECTED</span>
      </div>
    </div>
  );
}

/* ---------- side panel ---------- */

function DayPanel({
  date,
  weekly,
  overrides,
  onChanged,
  onClose,
}: {
  date: string;
  weekly: WeeklyWindow[];
  overrides: Override[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState<null | "ADD" | "BLOCK">(null);

  const dow = parseDateStr(date).getDay();
  const dayWeekly: Range[] = weekly
    .filter((w) => w.dayOfWeek === dow)
    .map((w) => ({ startMinute: w.startMinute, endMinute: w.endMinute }));
  const dayOverrides = overrides.filter((o) => o.date === date);
  const effective = computeEffective(dayWeekly, dayOverrides);

  const longLabel = parseDateStr(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  async function removeOverride(id: string) {
    if (!confirm("Remove this override?")) return;
    await fetch(`/api/availability/overrides?id=${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono tracking-widest text-signal mb-1">SELECTED DATE</div>
          <div className="h-display text-xl">{longLabel.toUpperCase()}</div>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink text-lg leading-none" aria-label="Close">
          ×
        </button>
      </div>

      {/* Effective availability */}
      <div>
        <div className="text-[10px] font-mono tracking-widest text-ink-dim mb-2">EFFECTIVE AVAILABILITY</div>
        {effective.length === 0 ? (
          <div className="text-sm text-ink-dim py-2">Unavailable on this date.</div>
        ) : (
          <div className="space-y-1">
            {effective.map((r, i) => (
              <div key={i} className="bg-bg-elev border border-line px-3 py-1.5 text-sm font-mono">
                {formatTimeDisplay(r.startMinute)} → {formatTimeDisplay(r.endMinute)}
              </div>
            ))}
          </div>
        )}
        {dayWeekly.length > 0 && (
          <div className="text-[10px] text-ink-dim mt-2">
            From weekly {DOW_LABELS_LONG[dow]} ·{" "}
            {dayWeekly.map((r, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {formatTimeDisplay(r.startMinute)}–{formatTimeDisplay(r.endMinute)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Existing overrides */}
      {dayOverrides.length > 0 && (
        <div>
          <div className="text-[10px] font-mono tracking-widest text-ink-dim mb-2">OVERRIDES ON THIS DATE</div>
          <div className="space-y-1">
            {dayOverrides.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between bg-bg-elev border border-line px-3 py-1.5 text-sm"
              >
                <span>
                  <span
                    className={`inline-block text-[9px] font-mono tracking-widest px-1.5 py-0.5 mr-2 ${
                      o.type === "ADD"
                        ? "bg-ok/15 text-ok border border-ok/40"
                        : "bg-bad/15 text-bad border border-bad/40"
                    }`}
                  >
                    {o.type}
                  </span>
                  <span className="font-mono">
                    {o.startMinute === null && o.endMinute === null
                      ? "WHOLE DAY"
                      : `${formatTimeDisplay(o.startMinute as number)} → ${formatTimeDisplay(o.endMinute as number)}`}
                  </span>
                </span>
                <button
                  onClick={() => removeOverride(o.id)}
                  className="text-bad text-xs font-mono hover:underline"
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add override */}
      {adding ? (
        <OverrideForm
          date={date}
          type={adding}
          onCancel={() => setAdding(null)}
          onSaved={() => { setAdding(null); onChanged(); }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setAdding("ADD")}
            className="bg-ok/15 border border-ok/40 text-ok py-2 text-sm font-mono tracking-widest hover:bg-ok/25"
          >
            + ADD TIME
          </button>
          <button
            onClick={() => setAdding("BLOCK")}
            className="bg-bad/15 border border-bad/40 text-bad py-2 text-sm font-mono tracking-widest hover:bg-bad/25"
          >
            − BLOCK TIME
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- override form ---------- */

function OverrideForm({
  date,
  type,
  onCancel,
  onSaved,
}: {
  date: string;
  type: "ADD" | "BLOCK";
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [wholeDay, setWholeDay] = useState(type === "BLOCK"); // common case for BLOCK
  const [startStr, setStartStr] = useState("12:00");
  const [endStr, setEndStr] = useState("15:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    let body: any = { date, type };
    if (wholeDay) {
      body.startMinute = null;
      body.endMinute = null;
    } else {
      const s = timeStrToMinutes(startStr);
      const e = timeStrToMinutes(endStr);
      if (e <= s) {
        setError("End time must be after start time.");
        return;
      }
      body.startMinute = s;
      body.endMinute = e;
    }
    setSaving(true);
    const res = await fetch("/api/availability/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed.");
    }
  }

  const accent = type === "ADD" ? "border-ok/40" : "border-bad/40";
  const label = type === "ADD" ? "ADD TIME" : "BLOCK TIME";

  return (
    <div className={`bg-bg-elev border ${accent} p-3 space-y-3`}>
      <div className="text-[10px] font-mono tracking-widest">NEW {label}</div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wholeDay}
          onChange={(e) => setWholeDay(e.target.checked)}
          className="!w-auto"
        />
        <span>Whole day</span>
      </label>

      {!wholeDay && (
        <div className="flex items-center gap-2">
          <input type="time" value={startStr} onChange={(e) => setStartStr(e.target.value)} className="!w-auto" />
          <span className="text-ink-muted">→</span>
          <input type="time" value={endStr} onChange={(e) => setEndStr(e.target.value)} className="!w-auto" />
        </div>
      )}

      {error && <div className="text-bad text-xs">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-signal text-bg py-2 text-sm font-semibold hover:bg-signal-dim disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="border border-line px-3 py-2 text-sm hover:border-ink-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
