import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg bg-grid">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-signal rotate-45" />
            <span className="h-display text-2xl tracking-wider">BACKSTOP</span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-ink-muted hover:text-ink">Sign in</Link>
            <Link href="/signup" className="bg-signal text-bg px-4 py-2 font-semibold hover:bg-signal-dim transition">
              Start coaching
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <div className="text-signal text-xs tracking-widest mb-4 font-mono">
            FOR INDEPENDENT BASEBALL COACHES
          </div>
          <h1 className="h-display text-6xl md:text-8xl leading-[0.9] mb-6">
            Run your<br />coaching business.<br />
            <span className="text-signal">Stop chasing payments.</span>
          </h1>
          <p className="text-ink-muted text-lg max-w-xl mb-10">
            Bookings, players, and money — one dashboard. Players book through your link.
            You track who paid. That's it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="bg-signal text-bg px-6 py-3 font-semibold hover:bg-signal-dim transition"
            >
              Create your booking page →
            </Link>
            <Link
              href="/login"
              className="border border-line px-6 py-3 font-semibold hover:border-ink-muted transition"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-line mt-24 border border-line">
          {[
            { n: "01", t: "BOOKINGS", d: "Players self-book through a public link. No double-booking, no back-and-forth." },
            { n: "02", t: "PLAYERS", d: "Auto-deduplicated roster. See every session, every dollar, per player." },
            { n: "03", t: "MONEY", d: "Track who paid via Venmo, Cash App, Zelle, or cash. Monthly revenue at a glance." },
          ].map((f) => (
            <div key={f.n} className="bg-bg-panel p-8">
              <div className="text-ink-dim font-mono text-xs mb-3">{f.n}</div>
              <div className="h-display text-2xl tracking-wider mb-2">{f.t}</div>
              <div className="text-ink-muted text-sm">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-ink-dim text-xs font-mono flex justify-between">
          <span>© BACKSTOP APP LLC</span>
          <span>OPERATIONS / BASEBALL</span>
        </div>
      </footer>
    </main>
  );
}
