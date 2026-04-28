"use client";
import { useEffect, useState } from "react";
import { formatMoney, formatDateTime } from "@/lib/format";

type Booking = {
  id: string;
  startTime: string;
  endTime: string;
  priceCents: number;
  amountPaidCents: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
  paymentMethod: string | null;
  paymentNotes: string | null;
  status: string;
  player: { id: string; name: string; email: string | null; phone: string | null };
  service: { id: string; name: string };
};

type Filter = "upcoming" | "past" | "unpaid" | "all";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [editing, setEditing] = useState<Booking | null>(null);

  useEffect(() => {
    const q = filter === "all" ? "" : `?filter=${filter}`;
    fetch(`/api/bookings${q}`).then((r) => r.json()).then(setBookings);
  }, [filter]);

  async function refresh() {
    const q = filter === "all" ? "" : `?filter=${filter}`;
    const data = await fetch(`/api/bookings${q}`).then((r) => r.json());
    setBookings(data);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <h1 className="h-display text-3xl tracking-wider">BOOKINGS</h1>
        <div className="flex gap-1 border border-line">
          {(["upcoming", "unpaid", "past", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-mono tracking-widest transition ${
                filter === f ? "bg-signal text-bg" : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
          No bookings to show.
        </div>
      ) : (
        <div className="border border-line">
          {bookings.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setEditing(b)}
              className={`w-full text-left flex items-center justify-between p-4 hover:bg-bg-hover transition ${
                i > 0 ? "border-t border-line" : ""
              } bg-bg-panel`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-semibold truncate">{b.player.name}</div>
                  {b.status === "CANCELLED" && (
                    <span className="text-[10px] font-mono text-bad">[CANCELLED]</span>
                  )}
                </div>
                <div className="text-sm text-ink-muted">
                  {b.service.name} · {formatDateTime(new Date(b.startTime))}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="font-mono text-sm">{formatMoney(b.priceCents)}</span>
                <PaymentBadge status={b.paymentStatus} />
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && <BookingEditModal booking={editing} onClose={() => setEditing(null)} onSave={refresh} />}
    </div>
  );
}

function BookingEditModal({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: () => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState(booking.paymentStatus);
  const [paymentMethod, setPaymentMethod] = useState(booking.paymentMethod || "");
  const [amountPaidStr, setAmountPaidStr] = useState((booking.amountPaidCents / 100).toFixed(2));
  const [notes, setNotes] = useState(booking.paymentNotes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus,
        paymentMethod: paymentMethod || null,
        amountPaidCents: Math.round(parseFloat(amountPaidStr || "0") * 100),
        paymentNotes: notes || null,
      }),
    });
    onSave();
    onClose();
  }

  async function cancel() {
    if (!confirm("Cancel this booking?")) return;
    await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-panel border border-line max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-mono tracking-widest text-signal mb-2">BOOKING</div>
        <h2 className="h-display text-2xl mb-1">{booking.player.name}</h2>
        <div className="text-sm text-ink-muted mb-6">
          {booking.service.name} · {formatDateTime(new Date(booking.startTime))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">STATUS</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as any)}>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">
              AMOUNT PAID (of {formatMoney(booking.priceCents)})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountPaidStr}
              onChange={(e) => setAmountPaidStr(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">METHOD</label>
            <input
              type="text"
              placeholder="Venmo / Cash App / Zelle / Cash"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">NOTES</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {booking.player.email && (
            <div className="text-xs text-ink-muted">📧 {booking.player.email}</div>
          )}
          {booking.player.phone && (
            <div className="text-xs text-ink-muted">📱 {booking.player.phone}</div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-signal text-bg py-2.5 font-semibold hover:bg-signal-dim disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="border border-line px-4 hover:border-ink-muted">
            Cancel
          </button>
        </div>
        {booking.status !== "CANCELLED" && (
          <button
            onClick={cancel}
            className="text-xs text-bad hover:underline mt-4 block w-full text-center"
          >
            Cancel this booking
          </button>
        )}
      </div>
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
