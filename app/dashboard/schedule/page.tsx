"use client";
import { useEffect, useState } from "react";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type Window = { dayOfWeek: number; startMinute: number; endMinute: number };

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeStrToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function SchedulePage() {
  const [windows, setWindows] = useState<Window[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetch("/api/availability").then((r) => r.json()).then(setWindows);
  }, []);

  function addWindow(dayOfWeek: number) {
    setWindows([...windows, { dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 }]);
  }

  function updateWindow(idx: number, patch: Partial<Window>) {
    setWindows(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }

  function removeWindow(idx: number) {
    setWindows(windows.filter((_, i) => i !== idx));
  }

  async function save() {
    // Validate
    for (const w of windows) {
      if (w.endMinute <= w.startMinute) {
        alert("End time must be after start time.");
        return;
      }
    }
    setSaving(true);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="h-display text-3xl tracking-wider">SCHEDULE</h1>
          <p className="text-sm text-ink-muted mt-1">When you're available each week. Players only see slots inside these windows.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim disabled:opacity-50"
        >
          {savedFlash ? "Saved ✓" : saving ? "Saving…" : "Save schedule"}
        </button>
      </div>

      <div className="space-y-2">
        {DAYS.map((day, dow) => {
          const dayWindows = windows.map((w, i) => ({ ...w, idx: i })).filter((w) => w.dayOfWeek === dow);
          return (
            <div key={dow} className="bg-bg-panel border border-line p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-sm tracking-widest">{day}</div>
                <button
                  onClick={() => addWindow(dow)}
                  className="text-xs font-mono text-signal hover:underline"
                >
                  + ADD WINDOW
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
                        onChange={(e) => updateWindow(w.idx, { startMinute: timeStrToMinutes(e.target.value) })}
                        className="!w-auto"
                      />
                      <span className="text-ink-muted">→</span>
                      <input
                        type="time"
                        value={minutesToTimeStr(w.endMinute)}
                        onChange={(e) => updateWindow(w.idx, { endMinute: timeStrToMinutes(e.target.value) })}
                        className="!w-auto"
                      />
                      <button
                        onClick={() => removeWindow(w.idx)}
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
    </div>
  );
}
