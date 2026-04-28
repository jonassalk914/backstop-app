"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Signup failed.");
      setLoading(false);
      return;
    }

    // Auto sign in after signup
    const signInRes = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (signInRes?.ok) {
      router.push("/dashboard");
    } else {
      setError("Account created but sign-in failed. Try logging in.");
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
          <div className="text-signal text-xs tracking-widest mb-3 font-mono">NEW COACH</div>
          <h1 className="h-display text-4xl mb-2">Set up shop.</h1>
          <p className="text-ink-muted text-sm mb-8">Your dashboard is ready in 30 seconds.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">FIRST NAME</label>
                <input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">LAST NAME</label>
                <input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">EMAIL</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted font-mono tracking-wider mb-1 block">PASSWORD</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <div className="text-ink-dim text-xs mt-1">Minimum 8 characters.</div>
            </div>

            {error && (
              <div className="bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-signal text-bg py-3 font-semibold hover:bg-signal-dim transition disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          <div className="text-ink-muted text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-signal hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
