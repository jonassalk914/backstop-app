import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions, isAdminEmail } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-bg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-3 h-3 bg-bad" />
            <span className="h-display text-xl tracking-wider">BACKSTOP / ADMIN</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-mono text-ink-muted hover:text-ink">
            ← DASHBOARD
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
