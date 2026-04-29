"use client";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatTime } from "@/lib/format";
import { tzAbbreviation } from "@/lib/timezone";

/**
 * Public booking flow. Three navigable steps mounted in one component:
 *   1. Service picker
 *   2. Calendar (date picker) + time slots for the selected date
 *   3. Player details + confirm
 *
 * All network calls go through safeFetchJson — this is the fix for the
 * crash where r.json() throws on empty/HTML responses. The UI never blanks;
 * any failure surfaces as a banner with a retry button.
 *
 * Props are unchanged from the previous version — the parent page does
 * not need to be modified.
 */

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; capacity: number };
type Slot = { start: string; end: string; spotsLeft: number };
type Step = "service" | "datetime" | "details" | "done";

type PaymentHandles = {
  venmo: string | null;
  cashApp: string | null;
  zelle: string | null;
  cash: string | null;
};

export function BookingFlow({
  slug,
  services,
  paymentMethods,
  paymentInstructions,
  timezone,
  paymentHandles,
}: {
  slug: string;
  services: Service[];
  paymentMethods: string[];
  paymentInstructions: string | null;
  timezone: string;
  paymentHandles?: PaymentHandles;
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);

  // Calendar state
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);

  // Slot state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [slot, setSlot] = useState<Slot | null>(null);

  // Details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ---------- data fetching ---------- */

  async function loadAvailableDates(svc: Service) {
    setDatesLoading(true);
    setDatesError(null);
    const res = await safeFetchJson<{ availableDates?: string[]; error?: string }>(
      `/api/public/${slug}/slots?serviceId=${encodeURIComponent(svc.id)}`
    );
    setDatesLoading(false);
    if (!res.ok) {
      setDatesError(res.error);
      setAvailableDates(new Set());
      return;
    }
    setAvailableDates(new Set(res.data.availableDates ?? []));
  }

  async function loadSlots(svc: Service, dateStr: string) {
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    const res = await safeFetchJson<{ slots?: Slot[]; error?: string }>(
      `/api/public/${slug}/slots?serviceId=${encodeURIComponent(svc.id)}&date=${encodeURIComponent(dateStr)}`
    );
    setSlotsLoading(false);
    if (!res.ok) {
      setSlotsError(res.error);
      return;
    }
    setSlots(res.data.slots ?? []);
  }

  // Load available dates whenever service changes
  useEffect(() => {
    if (!service) return;
    loadAvailableDates(service);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, slug]);

  // Load slots whenever date changes
  useEffect(() => {
    if (!service || !selectedDate) return;
    loadSlots(service, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, selectedDate, slug]);

  /* ---------- early returns ---------- */

  if (services.length === 0) {
    return (
      <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
        This coach hasn't set up services yet. Check back soon.
      </div>
    );
  }

  if (step === "done") {
    const handleRows: Array<[string, string]> = [];
    if (paymentHandles?.venmo) handleRows.push(["Venmo", paymentHandles.venmo]);
    if (paymentHandles?.cashApp) handleRows.push(["Cash App", paymentHandles.cashApp]);
    if (paymentHandles?.zelle) handleRows.push(["Zelle", paymentHandles.zelle]);
    if (paymentHandles?.cash) handleRows.push(["Cash", paymentHandles.cash]);
    const showPaymentBox = handleRows.length > 0 || !!paymentInstructions;
    return (
      <div className="bg-bg-panel border border-signal/40 p-8 text-center">
        <div className="text-signal h-display text-5xl mb-3">BOOKED.</div>
        <p className="text-ink mb-4">
          {service && slot && (
            <>You're set for <strong>{formatLongDateTime(slot.start, timezone)}</strong>.</>
          )}
        </p>
        {showPaymentBox && (
          <div className="bg-bg-elev border border-line p-4 text-left mt-6 space-y-3">
            <div className="text-xs font-mono tracking-widest text-signal">PAYMENT</div>
            {handleRows.length > 0 && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {handleRows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <span className="text-ink-dim font-mono text-xs uppercase tracking-wider self-center">
                      {label}
                    </span>
                    <span className="font-mono break-words">{value}</span>
                  </div>
                ))}
              </div>
            )}
            {paymentInstructions && (
              <div className="text-sm whitespace-pre-wrap">{paymentInstructions}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------- submit ---------- */

  async function submit() {
    if (!service || !slot) return;
    if (!name.trim()) { setSubmitError("Please enter your name."); return; }
    if (!email.trim() && !phone.trim()) { setSubmitError("Please provide email or phone."); return; }

    setSubmitError(null);
    setSubmitting(true);

    const res = await safeFetchJson<{ ok?: boolean; error?: string }>(
      `/api/public/${slug}/book`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          startTime: slot.start,
          playerName: name.trim(),
          playerEmail: email.trim() || undefined,
          playerPhone: phone.trim() || undefined,
          paymentMethod,
        }),
      }
    );

    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(res.error);
      // Slot got grabbed between view and submit — bounce back and refresh
      if (res.status === 409 && selectedDate) {
        await loadSlots(service, selectedDate);
        setSlot(null);
        setStep("datetime");
      }
      return;
    }

    setStep("done");
  }

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      <Crumbs step={step} hasService={!!service} hasSlot={!!slot} />

      {step === "service" && (
        <ServiceList
          services={services}
          onPick={(s) => { setService(s); setSelectedDate(null); setSlot(null); setStep("datetime"); }}
        />
      )}

      {step === "datetime" && service && (
        <DateTimeStep
          service={service}
          timezone={timezone}
          availableDates={availableDates}
          datesLoading={datesLoading}
          datesError={datesError}
          onRetryDates={() => loadAvailableDates(service)}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setSlot(null); }}
          slots={slots}
          slotsLoading={slotsLoading}
          slotsError={slotsError}
          onRetrySlots={() => selectedDate && loadSlots(service, selectedDate)}
          onPickSlot={(s) => { setSlot(s); setStep("details"); }}
          onBack={() => setStep("service")}
        />
      )}

      {step === "details" && service && slot && (
        <DetailsStep
          service={service}
          slot={slot}
          timezone={timezone}
          paymentMethods={paymentMethods}
          name={name} setName={setName}
          email={email} setEmail={setEmail}
          phone={phone} setPhone={setPhone}
          paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
          submitting={submitting}
          error={submitError}
          onBack={() => setStep("datetime")}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

/* =====================================================================
   Step components
   ===================================================================== */

function ServiceList({ services, onPick }: { services: Service[]; onPick: (s: Service) => void }) {
  return (
    <div className="space-y-2">
      {services.map((s) => (
        <button
          key={s.id}
          onClick={() => onPick(s)}
          className="w-full bg-bg-panel border border-line hover:border-signal active:bg-bg-hover transition p-4 text-left flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="font-semibold truncate">{s.name}</div>
            <div className="text-sm text-ink-muted font-mono">
              {s.durationMinutes} MIN
              {s.capacity > 1 && <> · GROUP UP TO {s.capacity}</>}
            </div>
          </div>
          <div className="h-display text-2xl text-signal whitespace-nowrap">{formatMoney(s.priceCents)}</div>
        </button>
      ))}
    </div>
  );
}

function DateTimeStep({
  service,
  timezone,
  availableDates, datesLoading, datesError, onRetryDates,
  selectedDate, onSelectDate,
  slots, slotsLoading, slotsError, onRetrySlots, onPickSlot,
  onBack,
}: {
  service: Service;
  timezone: string;
  availableDates: Set<string>;
  datesLoading: boolean;
  datesError: string | null;
  onRetryDates: () => void;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  slots: Slot[];
  slotsLoading: boolean;
  slotsError: string | null;
  onRetrySlots: () => void;
  onPickSlot: (s: Slot) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs font-mono text-ink-muted hover:text-ink">
        ← CHANGE SERVICE
      </button>
      <div className="bg-bg-panel border border-line p-3 text-sm">
        <strong>{service.name}</strong> · {service.durationMinutes}min · {formatMoney(service.priceCents)}
      </div>

      {datesError ? (
        <ErrorBox message={datesError} onRetry={onRetryDates} />
      ) : (
        <CalendarPicker
          loading={datesLoading}
          availableDates={availableDates}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />
      )}

      {selectedDate && (
        <div>
          <div className="text-xs font-mono tracking-widest text-ink-dim mb-2 flex items-center justify-between gap-2 flex-wrap">
            <span>TIMES — {formatLongDate(selectedDate).toUpperCase()}</span>
            <span className="normal-case tracking-wider text-[10px]">
              shown in {tzAbbreviation(timezone)} (coach time)
            </span>
          </div>
          {slotsError ? (
            <ErrorBox message={slotsError} onRetry={onRetrySlots} />
          ) : slotsLoading ? (
            <div className="bg-bg-panel border border-line p-6 text-center text-ink-muted text-sm">
              Loading times…
            </div>
          ) : slots.length === 0 ? (
            <div className="bg-bg-panel border border-line p-6 text-center text-ink-muted text-sm">
              No available times on this date. Try another day.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  onClick={() => onPickSlot(s)}
                  className="bg-bg-panel border border-line hover:border-signal active:bg-bg-hover transition py-3 text-sm font-mono flex flex-col items-center gap-0.5"
                >
                  <span>{formatTime(new Date(s.start), timezone)}</span>
                  {service.capacity > 1 && (
                    <span className="text-[9px] text-ink-dim tracking-widest">
                      {s.spotsLeft} SPOT{s.spotsLeft === 1 ? "" : "S"} LEFT
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailsStep({
  service, slot, timezone, paymentMethods,
  name, setName, email, setEmail, phone, setPhone,
  paymentMethod, setPaymentMethod,
  submitting, error, onBack, onSubmit,
}: {
  service: Service;
  slot: Slot;
  timezone: string;
  paymentMethods: string[];
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  paymentMethod: string; setPaymentMethod: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs font-mono text-ink-muted hover:text-ink">
        ← CHANGE TIME
      </button>
      <div className="bg-bg-panel border border-line p-3 text-sm">
        <strong>{service.name}</strong> · {formatLongDateTime(slot.start, timezone)}
        <span className="text-ink-dim text-xs ml-1">({tzAbbreviation(timezone)})</span>
      </div>

      <div>
        <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">YOUR NAME</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </div>
      <div>
        <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">EMAIL</label>
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PHONE</label>
        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="text-xs text-ink-dim">Email or phone required.</div>

      {paymentMethods.length > 0 && (
        <div>
          <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">
            HOW WILL YOU PAY?
          </label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-2">{error}</div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full bg-signal text-bg py-3 font-semibold hover:bg-signal-dim active:bg-signal-dim transition disabled:opacity-50"
      >
        {submitting ? "Booking…" : `Confirm booking — ${formatMoney(service.priceCents)}`}
      </button>
    </div>
  );
}

/* =====================================================================
   Calendar picker
   ===================================================================== */

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarPicker({
  loading,
  availableDates,
  selectedDate,
  onSelect,
}: {
  loading: boolean;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const maxDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60),
    [today]
  );

  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);
  const leadingBlanks = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const canGoBack =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoForward =
    viewYear < maxDate.getFullYear() ||
    (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());

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
          className="text-sm font-mono px-3 py-1 disabled:opacity-30 hover:text-signal"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="font-mono text-sm tracking-widest uppercase">{monthLabel}</div>
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
        {DOW_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-mono text-ink-dim py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" aria-busy={loading}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const isAvailable = availableDates.has(cell.dateStr);
          const isPast = cell.dateStr < todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const disabled = !isAvailable || isPast || loading;

          return (
            <button
              key={cell.dateStr}
              onClick={() => !disabled && onSelect(cell.dateStr)}
              disabled={disabled}
              className={[
                "aspect-square flex items-center justify-center text-sm font-mono border transition",
                isSelected
                  ? "bg-signal text-bg border-signal"
                  : disabled
                    ? "border-transparent text-ink-dim/40 cursor-not-allowed"
                    : "border-line hover:border-signal active:bg-bg-hover text-ink",
                isToday && !isSelected ? "ring-1 ring-ink-muted/30" : "",
              ].join(" ")}
              aria-label={cell.dateStr + (isAvailable ? " (available)" : " (unavailable)")}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-[10px] font-mono text-ink-dim flex gap-4">
        <span><span className="inline-block w-2 h-2 border border-line align-middle mr-1" />AVAILABLE</span>
        <span><span className="inline-block w-2 h-2 bg-signal align-middle mr-1" />SELECTED</span>
      </div>
    </div>
  );
}

/* =====================================================================
   Shared bits
   ===================================================================== */

function Crumbs({ step, hasService, hasSlot }: { step: Step; hasService: boolean; hasSlot: boolean }) {
  return (
    <div className="flex gap-1 text-xs font-mono tracking-widest">
      <Crumb done={hasService} active={step === "service"} label="01 SERVICE" />
      <Crumb done={hasSlot} active={step === "datetime"} label="02 DATE & TIME" />
      <Crumb done={false} active={step === "details"} label="03 DETAILS" />
    </div>
  );
}

function Crumb({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex-1 px-2 py-2 border text-center ${
        active ? "border-signal text-signal" : done ? "border-line text-ink" : "border-line text-ink-dim"
      }`}
    >
      {label}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-3 flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        onClick={onRetry}
        className="text-xs font-mono tracking-widest border border-bad/40 px-2 py-1 hover:bg-bad/20"
      >
        RETRY
      </button>
    </div>
  );
}

/* =====================================================================
   Helpers
   ===================================================================== */

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * Bulletproof JSON fetch.
 *
 * Handles every way the previous code could crash:
 *   - r.json() throwing on empty body
 *   - r.json() throwing on HTML error pages
 *   - fetch itself rejecting (network drop)
 *   - 4xx / 5xx with valid JSON body containing { error }
 *   - 4xx / 5xx with empty body
 *
 * Returns a discriminated union — caller branches on .ok, no try/catch needed.
 */
async function safeFetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<FetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, status: 0, error: "Network error. Please check your connection." };
  }

  const text = await response.text().catch(() => "");
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }

  if (!response.ok) {
    const msg =
      (parsed && typeof parsed.error === "string" && parsed.error) ||
      (response.status === 404
        ? "Not found."
        : response.status >= 500
          ? "Something went wrong on our end. Please try again."
          : "Request failed.");
    return { ok: false, status: response.status, error: msg };
  }

  if (parsed === null) {
    return { ok: false, status: response.status, error: "Unexpected response from server." };
  }

  return { ok: true, data: parsed as T };
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatLongDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
