"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Client error boundary caught:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">LocoPrep Recovery</p>
      <h1 className="mt-3 text-4xl font-black text-[var(--foreground)]">Something Unexpected Happened</h1>
      <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--foreground)_78%,transparent)]">
        The page hit a client-side error. Your data is safe. Reload this view and continue learning.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          onClick={() => reset()}
          type="button"
        >
          Retry
        </button>
        <Link
          className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] px-5 py-2 text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_88%,transparent)] transition hover:border-[color-mix(in_srgb,var(--accent)_58%,transparent)] hover:text-[var(--foreground)]"
          href="/"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}

