"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) {
      router.push(params.get("from") || "/dashboard");
    } else {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg bg-grid flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-3 h-3 bg-signal rotate-45" />
            <span className="h-display text-2xl tracking-wider">BACKSTOP</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="h-display text-4xl mb-8">Sign in.</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">EMAIL</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PASSWORD</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && (
              <div className="bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-signal text-bg py-3 font-semibold hover:bg-signal-dim transition disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div className="text-ink-muted text-sm mt-6 text-center">
            New here?{" "}
            <Link href="/signup" className="text-signal hover:underline">Create an account</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
