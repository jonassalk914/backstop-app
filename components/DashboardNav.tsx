"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

const TABS = [
  { href: "/dashboard", label: "OVERVIEW" },
  { href: "/dashboard/bookings", label: "BOOKINGS" },
  { href: "/dashboard/players", label: "PLAYERS" },
  { href: "/dashboard/services", label: "SERVICES" },
  { href: "/dashboard/schedule", label: "SCHEDULE" },
  { href: "/dashboard/money", label: "MONEY" },
  { href: "/dashboard/settings", label: "SETTINGS" },
];

export function DashboardNav({
  coachName,
  slug,
  isAdmin,
}: {
  coachName: string;
  slug: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-line bg-bg sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-3 h-3 bg-signal rotate-45" />
            <span className="h-display text-xl tracking-wider">BACKSTOP</span>
          </Link>

          <div className="flex items-center gap-4 relative">
            <span className="hidden sm:block text-xs font-mono text-ink-muted">
              /book/{slug}
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-mono tracking-widest text-signal hover:underline"
              >
                ADMIN
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-xs font-mono text-ink-muted hover:text-ink"
            >
              {coachName.toUpperCase()}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-bg-elev border border-line py-1 min-w-[160px] z-20">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-bg-hover"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const active =
              t.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-2.5 text-xs font-mono tracking-widest border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-signal text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
