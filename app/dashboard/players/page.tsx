"use client";
import { useEffect, useState } from "react";

type Player = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  lastActivity: string;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetch("/api/players").then((r) => r.json()).then(setPlayers);
  }

  useEffect(() => { load(); }, []);

  async function deletePlayer(p: Player) {
    if (!confirm(`Delete ${p.name} from your players? This can't be undone.`)) return;
    setDeletingId(p.id);
    const res = await fetch(`/api/players/${p.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not delete that player.");
    }
  }

  const filtered = players.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <h1 className="h-display text-3xl tracking-wider">PLAYERS</h1>
        <div className="text-xs font-mono text-ink-muted">{players.length} TOTAL</div>
      </div>

      <input
        type="search"
        placeholder="Search by name, email, or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="bg-bg-panel border border-line p-8 text-center text-ink-muted">
          {players.length === 0 ? "No players yet. They'll appear here after their first booking." : "No matches."}
        </div>
      ) : (
        <div className="border border-line">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={`p-4 ${i > 0 ? "border-t border-line" : ""} bg-bg-panel`}
            >
              <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-ink-muted">
                    {p.email && <span>{p.email}</span>}
                    {p.email && p.phone && <span> · </span>}
                    {p.phone && <span>{p.phone}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-ink-dim">LAST</div>
                  <div className="text-sm">{new Date(p.lastActivity).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-mono mt-3 gap-4 flex-wrap">
                <div className="flex gap-4">
                  <span>
                    <span className="text-ink-dim">TOTAL</span>{" "}
                    <span className="text-ink">{p.totalBookings}</span>
                  </span>
                  <span>
                    <span className="text-ink-dim">UPCOMING</span>{" "}
                    <span className="text-signal">{p.upcomingBookings}</span>
                  </span>
                  <span>
                    <span className="text-ink-dim">DONE</span>{" "}
                    <span className="text-ink">{p.completedBookings}</span>
                  </span>
                </div>
                <button
                  onClick={() => deletePlayer(p)}
                  disabled={deletingId === p.id}
                  className="text-bad hover:underline disabled:opacity-50 tracking-widest"
                >
                  {deletingId === p.id ? "DELETING…" : "DELETE"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
