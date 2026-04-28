"use client";
import { useEffect, useMemo, useState } from "react";
import { tzAbbreviation, DEFAULT_TIMEZONE } from "@/lib/timezone";

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

type Booking = {
  id: string;
  date: string;
  startMinute: number;
  endMinute: number;
  playerName: string;
  serviceName: string;
};

type Range = { startMinute: number; endMinute: number };

/** Compact summary of a date's status, used for cell rendering. */
type DayStatus = {
  kind: "no-rule" | "available" | "tweaked" | "blocked" | "fully-booked";
  bookingCount: number;
  hasAdd: boolean;
  hasBlock: boolean;
};

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

function formatRange(r: Range): string {
  return `${formatTimeDisplay(r.startMinute)} – ${formatTimeDisplay(r.endMinute)}`;
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

/** Total bookable minutes on a date after subtracting bookings from effective windows. */
function unbookedMinutes(effective: Range[], bookings: Booking[]): number {
  let remaining = effective.map((r) => ({ ...r }));
  for (const b of bookings) {
    const next: Range[] = [];
    for (const r of remaining) {
      if (b.endMinute <= r.startMinute || b.startMinute >= r.endMinute) {
        next.push(r);
        continue;
      }
      if (b.startMinute > r.startMinute) next.push({ startMinute: r.startMinute, endMinute: b.startMinute });
      if (b.endMinute < r.endMinute) next.push({ startMinute: b.endMinute, endMinute: r.endMinute });
    }
    remaining = next;
  }
  return remaining.reduce((sum, r) => sum + (r.endMinute - r.startMinute), 0);
}

/** Compute a cell's display status from raw inputs. */
function statusForDate(
  weeklyForDow: Range[],
  dayOverrides: Override[],
  dayBookings: Booking[]
): DayStatus {
  const hasAdd = dayOverrides.some((o) => o.type === "ADD");
  const hasBlock = dayOverrides.some((o) => o.type === "BLOCK");
  const bookingCount = dayBookings.length;
  const effective = computeEffective(weeklyForDow, dayOverrides);

  if (effective.length === 0) {
    // No bookable time. Decide whether it's structural (no rule) or chosen (blocked).
    if (weeklyForDow.length > 0 && hasBlock) {
      return { kind: "blocked", bookingCount, hasAdd, hasBlock };
    }
    return { kind: "no-rule", bookingCount, hasAdd, hasBlock };
  }

  const free = unbookedMinutes(effective, dayBookings);
  if (bookingCount > 0 && free === 0) {
    return { kind: "fully-booked", bookingCount, hasAdd, hasBlock };
  }

  return {
    kind: hasAdd || hasBlock ? "tweaked" : "available",
    bookingCount,
    hasAdd,
    hasBlock,
  };
}

/* =====================================================================
   Page
   ===================================================================== */

export default function SchedulePage() {
  const [weekly, setWeekly] = useState<WeeklyWindow[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/availability");
    if (!res.ok) return;
    const data = await res.json();
    setWeekly(data.weekly ?? []);
    setOverrides(data.overrides ?? []);
    setBookings(data.bookings ?? []);
    if (data.timezone) setTimezone(data.timezone);
  }

  useEffect(() => { load(); }, []);

  /* ---- weekly editor handlers ---- */

  function addWeekly(dow: number) {
    setWeekly([...weekly, { dayOfWeek: dow, startMinute: 16 * 60, endMinute: 20 * 60 }]);
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
            <p className="text-sm text-ink-muted mt-1">
              Default windows that repeat every week, in your timezone (
              <span className="font-mono">{tzAbbreviation(timezone)} — {timezone}</span>
              ). Players see the same wall clock. Change the zone in <a href="/dashboard/settings" className="text-signal hover:underline">settings</a>.
            </p>
          </div>
          <button
            onClick={saveWeekly}
            disabled={savingWeekly}
            className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim disabled:opacity-50"
          >
            {savedFlash ? "Saved ✓" : savingWeekly ? "Saving…" : "Save weekly"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {DOW_LABELS_LONG.map((day, dow) => {
            const dayWindows = weekly
              .map((w, i) => ({ ...w, idx: i }))
              .filter((w) => w.dayOfWeek === dow);
            const isOff = dayWindows.length === 0;

            return (
              <div
                key={dow}
                className={`bg-bg-panel border p-3 flex flex-col gap-2 ${isOff ? "border-line/60" : "border-line"}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`font-mono text-xs tracking-widest ${isOff ? "text-ink-dim" : "text-signal"}`}>
                    {day}
                  </div>
                  <button
                    onClick={() => addWeekly(dow)}
                    className="text-xs font-mono text-ink-muted hover:text-signal"
                    aria-label={`Add window on ${day}`}
                  >
                    + ADD
                  </button>
                </div>

                {isOff ? (
                  <div className="text-xs text-ink-dim italic py-2">Day off</div>
                ) : (
                  <div className="space-y-2">
                    {dayWindows.map((w) => (
                      <div key={w.idx} className="flex items-center gap-1 flex-wrap">
                        <input
                          type="time"
                          value={minutesToTimeStr(w.startMinute)}
                          onChange={(e) => updateWeekly(w.idx, { startMinute: timeStrToMinutes(e.target.value) })}
                          className="!w-auto !p-1.5 !text-xs"
                        />
                        <span className="text-ink-muted text-xs">→</span>
                        <input
                          type="time"
                          value={minutesToTimeStr(w.endMinute)}
                          onChange={(e) => updateWeekly(w.idx, { endMinute: timeStrToMinutes(e.target.value) })}
                          className="!w-auto !p-1.5 !text-xs"
                        />
                        <button
                          onClick={() => removeWeekly(w.idx)}
                          className="text-bad text-xs hover:underline ml-auto"
                          aria-label="Remove window"
                        >
                          ×
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

      {/* ---------- CALENDAR + DAY PANEL ---------- */}
      <section className="space-y-4">
        <div>
          <h2 className="h-display text-3xl tracking-wider">CALENDAR</h2>
          <p className="text-sm text-ink-muted mt-1">
            Click any date to see what's bookable, view confirmed sessions, or add a one-off change.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <CalendarGrid
            weekly={weekly}
            overrides={overrides}
            bookings={bookings}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
          <div className="bg-bg-panel border border-line p-5 min-h-[300px]">
            {selectedDate ? (
              <DayPanel
                date={selectedDate}
                weekly={weekly}
                overrides={overrides}
                bookings={bookings}
                onChanged={load}
                onClose={() => setSelectedDate(null)}
              />
            ) : (
              <div className="text-ink-muted text-sm py-8 text-center">
                Pick a date on the calendar to see what's bookable.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =====================================================================
   Calendar grid
   ===================================================================== */

function CalendarGrid({
  weekly,
  overrides,
  bookings,
  selectedDate,
  onSelect,
}: {
  weekly: WeeklyWindow[];
  overrides: Override[];
  bookings: Booking[];
  selectedDate: string | null;
  onSelect: (d: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Group lookups for fast cell rendering
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

  const bookingsByDate = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) {
      const arr = m.get(b.date) ?? [];
      arr.push(b);
      m.set(b.date, arr);
    }
    return m;
  }, [bookings]);

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
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
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
          className="text-sm font-mono px-3 py-1 disabled:opacity-30 hover:text-signal"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm tracking-widest uppercase">{monthLabel}</div>
          <button
            onClick={goToday}
            className="text-[10px] font-mono tracking-widest text-ink-muted hover:text-signal border border-line px-2 py-0.5"
          >
            TODAY
          </button>
        </div>
        <button
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="text-sm font-mono px-3 py-1 disabled:opacity-30 hover:text-signal"
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
          if (!cell) return <div key={i} className="aspect-square" />;

          const isPast = cell.dateStr < todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const dow = parseDateStr(cell.dateStr).getDay();
          const dayWeekly = weeklyByDow.get(dow) ?? [];
          const dayOverrides = overridesByDate.get(cell.dateStr) ?? [];
          const dayBookings = bookingsByDate.get(cell.dateStr) ?? [];
          const status = statusForDate(dayWeekly, dayOverrides, dayBookings);

          return (
            <DayCell
              key={cell.dateStr}
              day={cell.day}
              dateStr={cell.dateStr}
              status={status}
              isPast={isPast}
              isToday={isToday}
              isSelected={isSelected}
              onClick={() => !isPast && onSelect(cell.dateStr)}
            />
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

/* ---------- DayCell — the four-state language ---------- */

function DayCell({
  day,
  dateStr,
  status,
  isPast,
  isToday,
  isSelected,
  onClick,
}: {
  day: number;
  dateStr: string;
  status: DayStatus;
  isPast: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Base classes
  let base = "aspect-square flex flex-col items-center justify-center text-sm font-mono border transition relative";
  let stateClasses = "";

  if (isSelected) {
    stateClasses = "bg-signal text-bg border-signal";
  } else if (isPast) {
    stateClasses = "border-transparent text-ink-dim/40 cursor-not-allowed";
  } else {
    switch (status.kind) {
      case "no-rule":
        stateClasses = "border-line text-ink-dim hover:border-ink-muted";
        break;
      case "available":
        stateClasses = "border-signal/40 text-ink hover:border-signal";
        break;
      case "tweaked":
        stateClasses = "border-warn/50 text-ink hover:border-warn";
        break;
      case "blocked":
        stateClasses = "border-bad/40 text-ink-dim hover:border-bad";
        break;
      case "fully-booked":
        stateClasses = "bg-signal/10 border-signal/60 text-ink hover:border-signal";
        break;
    }
  }

  const ringClass = isToday && !isSelected ? "ring-1 ring-ink-muted/30" : "";

  // Tooltip text via title attribute — accessible and friction-free
  const tooltip =
    isPast
      ? "Past"
      : status.kind === "no-rule"
        ? "No availability set"
        : status.kind === "available"
          ? "Available — weekly rule"
          : status.kind === "tweaked"
            ? `Available — ${[
                status.hasAdd ? "extra time added" : null,
                status.hasBlock ? "partial block" : null,
              ].filter(Boolean).join(", ")}`
            : status.kind === "blocked"
              ? "Blocked off"
              : "Fully booked";

  return (
    <button
      onClick={onClick}
      disabled={isPast}
      className={[base, stateClasses, ringClass].filter(Boolean).join(" ")}
      title={`${dateStr} — ${tooltip}${status.bookingCount > 0 ? ` · ${status.bookingCount} booking${status.bookingCount === 1 ? "" : "s"}` : ""}`}
    >
      <span>{day}</span>

      {/* Indicator row: dot + override marks */}
      {!isPast && !isSelected && (
        <div className="absolute bottom-1 flex items-center gap-0.5">
          {status.kind === "available" && (
            <span className="w-1 h-1 rounded-full bg-signal" />
          )}
          {status.kind === "tweaked" && (
            <>
              <span className="w-1 h-1 rounded-full bg-signal" />
              {status.hasAdd && <span className="w-1 h-1 rounded-full bg-ok" />}
              {status.hasBlock && <span className="w-1 h-1 rounded-full bg-bad" />}
            </>
          )}
          {status.kind === "blocked" && (
            <span className="w-1 h-1 rounded-full bg-bad" />
          )}
          {status.kind === "fully-booked" && (
            <span className="text-[8px] font-mono text-signal tracking-widest">FULL</span>
          )}
        </div>
      )}

      {/* Booking count badge — corner */}
      {!isPast && status.bookingCount > 0 && status.kind !== "fully-booked" && (
        <span
          className={`absolute top-0.5 right-0.5 text-[9px] font-mono leading-none px-1 py-0.5 ${
            isSelected ? "bg-bg/30 text-bg" : "bg-bg-elev text-ink"
          }`}
        >
          {status.bookingCount}
        </span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px] font-mono text-ink-dim">
      <LegendItem swatch={<span className="w-3 h-3 inline-block border border-signal/40 align-middle" />} label="AVAILABLE" />
      <LegendItem swatch={<span className="w-3 h-3 inline-block border border-warn/50 align-middle" />} label="MODIFIED" />
      <LegendItem swatch={<span className="w-3 h-3 inline-block border border-bad/40 align-middle" />} label="BLOCKED" />
      <LegendItem swatch={<span className="w-3 h-3 inline-block bg-signal/10 border border-signal/60 align-middle" />} label="FULLY BOOKED" />
      <LegendItem swatch={<span className="px-1 bg-bg-elev text-[8px] align-middle">2</span>} label="BOOKING COUNT" />
    </div>
  );
}
function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-1.5">{swatch}{label}</span>;
}

/* =====================================================================
   Day panel — narrative-style summary
   ===================================================================== */

function DayPanel({
  date,
  weekly,
  overrides,
  bookings,
  onChanged,
  onClose,
}: {
  date: string;
  weekly: WeeklyWindow[];
  overrides: Override[];
  bookings: Booking[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState<null | "ADD" | "BLOCK">(null);

  const dow = parseDateStr(date).getDay();
  const dayWeekly: Range[] = weekly
    .filter((w) => w.dayOfWeek === dow)
    .map((w) => ({ startMinute: w.startMinute, endMinute: w.endMinute }));
  const dayOverrides = overrides.filter((o) => o.date === date);
  const adds = dayOverrides.filter((o) => o.type === "ADD");
  const blocks = dayOverrides.filter((o) => o.type === "BLOCK");
  const dayBookings = bookings
    .filter((b) => b.date === date)
    .sort((a, b) => a.startMinute - b.startMinute);

  const effective = computeEffective(dayWeekly, dayOverrides);
  const free = unbookedMinutes(effective, dayBookings);

  const longLabel = parseDateStr(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dayName = parseDateStr(date).toLocaleDateString("en-US", { weekday: "long" });

  /* ----- narrative summary line ----- */
  let summary: React.ReactNode;
  if (effective.length === 0) {
    if (blocks.length > 0) {
      summary = <span className="text-bad">Blocked off — no bookings possible.</span>;
    } else {
      summary = <span className="text-ink-dim">No availability set for this date.</span>;
    }
  } else if (free === 0 && dayBookings.length > 0) {
    summary = <span className="text-signal">Fully booked.</span>;
  } else {
    summary = (
      <span>
        <span className="text-signal">{effective.map(formatRange).join(", ")}</span>{" "}
        <span className="text-ink-muted">bookable</span>
      </span>
    );
  }

  /* ----- "where this came from" subtitle ----- */
  const sourceParts: string[] = [];
  if (dayWeekly.length > 0) {
    sourceParts.push(`weekly ${dayName} hours (${dayWeekly.map(formatRange).join(", ")})`);
  }
  if (adds.length > 0) {
    sourceParts.push(
      `extra time added (${adds.map((a) =>
        a.startMinute === null ? "whole day" : formatRange({ startMinute: a.startMinute as number, endMinute: a.endMinute as number })
      ).join(", ")})`
    );
  }
  if (blocks.length > 0) {
    sourceParts.push(
      `blocked (${blocks.map((b) =>
        b.startMinute === null ? "whole day" : formatRange({ startMinute: b.startMinute as number, endMinute: b.endMinute as number })
      ).join(", ")})`
    );
  }
  const sourceText = sourceParts.length > 0
    ? sourceParts.length === 1 ? sourceParts[0] : sourceParts.slice(0, -1).join(", ") + " and " + sourceParts[sourceParts.length - 1]
    : null;

  async function removeOverride(id: string) {
    if (!confirm("Remove this override?")) return;
    await fetch(`/api/availability/overrides?id=${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono tracking-widest text-signal mb-1">SELECTED DATE</div>
          <div className="h-display text-xl">{longLabel.toUpperCase()}</div>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink text-lg leading-none" aria-label="Close">
          ×
        </button>
      </div>

      {/* Narrative summary */}
      <div className="space-y-1">
        <div className="text-sm">{summary}</div>
        {sourceText && (
          <div className="text-xs text-ink-dim">From {sourceText}.</div>
        )}
      </div>

      {/* Bookings on this date */}
      {dayBookings.length > 0 && (
        <div>
          <div className="text-[10px] font-mono tracking-widest text-ink-dim mb-2">
            BOOKINGS ({dayBookings.length})
          </div>
          <div className="space-y-1">
            {dayBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between bg-bg-elev border border-line px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{b.playerName}</div>
                  <div className="text-xs text-ink-muted truncate">{b.serviceName}</div>
                </div>
                <div className="font-mono text-xs whitespace-nowrap ml-3">
                  {formatTimeDisplay(b.startMinute)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing overrides */}
      {dayOverrides.length > 0 && (
        <div>
          <div className="text-[10px] font-mono tracking-widest text-ink-dim mb-2">
            OVERRIDES ON THIS DATE
          </div>
          <div className="space-y-1">
            {dayOverrides.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between bg-bg-elev border border-line px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 ${
                      o.type === "ADD"
                        ? "bg-ok/15 text-ok border border-ok/40"
                        : "bg-bad/15 text-bad border border-bad/40"
                    }`}
                  >
                    {o.type}
                  </span>
                  <span className="font-mono text-xs">
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

/* =====================================================================
   Override form (unchanged from previous)
   ===================================================================== */

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
  const [wholeDay, setWholeDay] = useState(type === "BLOCK");
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
