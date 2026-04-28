"use client";
import { useState, useEffect } from "react";
import { formatMoney, formatTime } from "@/lib/format";

type Service = { id: string; name: string; durationMinutes: number; priceCents: number };
type Slot = { start: string; end: string };

type Step = "service" | "time" | "details" | "done";

export function BookingFlow({
  slug,
  services,
  paymentMethods,
  paymentInstructions,
}: {
  slug: string;
  services: Service[];
  paymentMethods: string[];
  paymentInstructions: string | null;
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    setSlots([]);
    fetch(`/api/public/${slug}/slots?serviceId=${service.id}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [service, slug]);

  if (services.length === 0) {
    return (
      <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
        This coach hasn't set up services yet. Check back soon.
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="bg-bg-panel border border-signal/40 p-8 text-center">
        <div className="text-signal h-display text-5xl mb-3">BOOKED.</div>
        <p className="text-ink mb-4">
          Your session is confirmed. {service && slot && (
            <>You're set for <strong>{new Date(slot.start).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>.</>
          )}
        </p>
        {paymentInstructions && (
          <div className="bg-bg-elev border border-line p-4 text-left mt-6">
            <div className="text-xs font-mono tracking-widest text-signal mb-2">PAYMENT</div>
            <div className="text-sm whitespace-pre-wrap">{paymentInstructions}</div>
          </div>
        )}
      </div>
    );
  }

  async function submit() {
    if (!service || !slot) return;
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email && !phone) { setError("Please provide email or phone."); return; }
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/public/${slug}/book`, {
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
    });
    setSubmitting(false);
    if (res.ok) {
      setStep("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Booking failed. Please try again.");
      // If conflict, refresh slots
      if (res.status === 409) {
        fetch(`/api/public/${slug}/slots?serviceId=${service.id}`)
          .then((r) => r.json())
          .then((d) => setSlots(d.slots || []));
        setSlot(null);
        setStep("time");
      }
    }
  }

  // Group slots by date for cleaner UX
  const slotsByDate = slots.reduce((acc, s) => {
    const d = new Date(s.start).toDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 text-xs font-mono tracking-widest">
        <Crumb active={step === "service"} done={!!service} label="01 SERVICE" />
        <Crumb active={step === "time"} done={!!slot} label="02 TIME" />
        <Crumb active={step === "details"} done={false} label="03 DETAILS" />
      </div>

      {step === "service" && (
        <div className="space-y-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setService(s); setStep("time"); }}
              className="w-full bg-bg-panel border border-line hover:border-signal transition p-4 text-left flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-ink-muted font-mono">{s.durationMinutes} MIN</div>
              </div>
              <div className="h-display text-2xl text-signal">{formatMoney(s.priceCents)}</div>
            </button>
          ))}
        </div>
      )}

      {step === "time" && service && (
        <div className="space-y-4">
          <button onClick={() => setStep("service")} className="text-xs font-mono text-ink-muted hover:text-ink">
            ← CHANGE SERVICE
          </button>
          <div className="bg-bg-panel border border-line p-3 text-sm">
            <strong>{service.name}</strong> · {service.durationMinutes}min · {formatMoney(service.priceCents)}
          </div>

          {slots.length === 0 ? (
            <div className="bg-bg-panel border border-line p-6 text-center text-ink-muted text-sm">
              No times available in the next 2 weeks. Reach out to the coach directly.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(slotsByDate).map(([date, daySlots]) => (
                <div key={date}>
                  <div className="text-xs font-mono tracking-widest text-ink-dim mb-2">
                    {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {daySlots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => { setSlot(s); setStep("details"); }}
                        className="bg-bg-panel border border-line hover:border-signal transition py-2 text-sm font-mono"
                      >
                        {formatTime(new Date(s.start))}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "details" && service && slot && (
        <div className="space-y-4">
          <button onClick={() => setStep("time")} className="text-xs font-mono text-ink-muted hover:text-ink">
            ← CHANGE TIME
          </button>
          <div className="bg-bg-panel border border-line p-3 text-sm">
            <strong>{service.name}</strong> · {new Date(slot.start).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>

          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">YOUR NAME</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PHONE</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

          {error && <div className="bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-2">{error}</div>}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-signal text-bg py-3 font-semibold hover:bg-signal-dim disabled:opacity-50"
          >
            {submitting ? "Booking…" : `Confirm booking — ${formatMoney(service.priceCents)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Crumb({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex-1 px-3 py-2 border ${
        active ? "border-signal text-signal" : done ? "border-line text-ink" : "border-line text-ink-dim"
      }`}
    >
      {label}
    </div>
  );
}
