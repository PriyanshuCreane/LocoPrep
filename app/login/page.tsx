"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to login.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(226,231,223,0.2),transparent_42%),radial-gradient(circle_at_85%_12%,rgba(185,193,185,0.12),transparent_38%),radial-gradient(circle_at_50%_84%,rgba(226,231,223,0.08),transparent_48%)]" />

      <section className="glass-luxe edge-glow-violet relative grid w-full max-w-5xl overflow-hidden rounded-[28px] lg:grid-cols-[1.1fr_1fr]">
        <aside className="hidden border-r border-white/20 p-10 lg:block">
          <p className="accent-script inline-flex rounded-full border border-white/25 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
            LocoPrep
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-white">
            Continue your
            <span className="block text-[var(--accent-soft)]">daily language climb.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Pick up exactly where you left off with your streak, XP momentum, and personalized lesson path.
          </p>
          <div className="glass-luxe-soft edge-glow-violet mt-10 rounded-2xl p-4 text-sm text-[var(--foreground)]">
            <p className="font-semibold text-white">Today&apos;s cadence</p>
            <p className="mt-2">Keep sessions short and consistent. Ten focused minutes beats one random hour.</p>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="p-6 sm:p-8 lg:p-10">
          <h2 className="text-3xl font-bold text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-white/70">Sign in and continue learning from your latest lesson.</p>

          <label className="mt-6 block text-sm font-medium text-[var(--foreground)]">Email</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/24 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-[var(--foreground)] outline-none ring-white/20 transition placeholder:text-[var(--muted)] focus:ring"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label className="mt-5 block text-sm font-medium text-[var(--foreground)]">Password</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/24 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-[var(--foreground)] outline-none ring-white/20 transition placeholder:text-[var(--muted)] focus:ring"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          {error ? <p className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

          <button
            className="btn btn-primary mt-6 w-full rounded-2xl px-4 py-3"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-5 text-sm text-white/70">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-[var(--accent-soft)] hover:text-[var(--foreground)]">
              Create one
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

