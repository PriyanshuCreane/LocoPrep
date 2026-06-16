"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok) {
        setError(data.error || "Reset failed. Please try again.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,rgba(167,139,250,0.12),rgba(14,165,233,0.12))] border border-[color-mix(in_srgb,var(--accent)_24%,transparent)]">
            <LogIn className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Recovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Force Reset</h1>
          <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
            Instantly overwrite the password for any registered email.
          </p>
        </div>

        <form className="glass-luxe-soft edge-glow-violet space-y-5 rounded-3xl p-6 sm:p-8" onSubmit={onSubmit}>
          {error ? (
            <div className="rounded-xl border border-red-300/35 bg-red-900/15 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-300/35 bg-emerald-900/15 p-4 text-sm text-emerald-200">
              Password successfully reset! Redirecting to login...
            </div>
          ) : null}

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Account Email</span>
              <input
                className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--accent)]"
                disabled={isLoading || success}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">New Password</span>
              <input
                className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--accent)]"
                disabled={isLoading || success}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={password}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Confirm Password</span>
              <input
                className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--accent)]"
                disabled={isLoading || success}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>

          <button
            className="btn btn-primary w-full py-3"
            disabled={isLoading || success}
            type="submit"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>

          <p className="text-center text-sm text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
            Remembered your password?{" "}
            <Link className="font-semibold text-[var(--accent)] hover:underline" href="/login">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
