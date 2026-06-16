"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to create account.");
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
    <main className="relative flex h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(226,231,223,0.2),transparent_40%),radial-gradient(circle_at_86%_14%,rgba(185,193,185,0.12),transparent_34%),radial-gradient(circle_at_60%_84%,rgba(226,231,223,0.08),transparent_46%)]" />

      <section className="glass-luxe edge-glow-violet relative grid w-full max-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[28px] lg:grid-cols-[1fr_1.08fr]">
        <form onSubmit={onSubmit} className="overflow-y-auto p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">Create your account</h1>
          <p className="mt-2 text-xs sm:text-sm text-[color-mix(in_srgb,var(--foreground)_74%,transparent)]">Save progress, keep streaks, and unlock guided practice paths.</p>

          <label className="mt-4 block text-xs sm:text-sm font-medium text-[var(--foreground)]">Email</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/24 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3 py-2 text-xs sm:text-sm text-[var(--foreground)] outline-none ring-white/20 transition placeholder:text-[var(--muted)] focus:ring"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label className="mt-3 block text-xs sm:text-sm font-medium text-[var(--foreground)]">Password</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/24 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3 py-2 text-xs sm:text-sm text-[var(--foreground)] outline-none ring-white/20 transition placeholder:text-[var(--muted)] focus:ring"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />

          {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-200">{error}</p> : null}

          <button
            className="btn btn-primary mt-4 w-full rounded-xl px-4 py-2 text-sm"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>

          <p className="mt-4 text-xs sm:text-sm text-[color-mix(in_srgb,var(--foreground)_74%,transparent)]">
            Have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--accent-soft)] hover:text-[var(--foreground)]">
              Sign in
            </Link>
          </p>
        </form>

        <aside className="hidden border-l border-white/20 overflow-y-auto p-8 lg:flex lg:flex-col lg:justify-center">
          <p className="accent-script inline-flex rounded-full border border-white/25 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
            LocoPrep
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-[1.05] text-[var(--foreground)]">
            Build fluency with
            <span className="block text-[var(--accent-soft)]">momentum you can feel.</span>
          </h2>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-[color-mix(in_srgb,var(--foreground)_74%,transparent)]">
            Get adaptive learning paths, mixed lesson media, and streak-friendly routines designed for consistency.
          </p>
          <div className="glass-luxe-soft edge-glow-violet mt-6 space-y-2 rounded-2xl p-3 text-xs text-[var(--foreground)]">
            <p className="font-semibold text-[var(--foreground)]">What you unlock</p>
            <p>Track XP and levels per course.</p>
            <p>Resume exactly where you paused.</p>
            <p>Practice with videos, text, quizzes, and documents.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

