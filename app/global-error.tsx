"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">LocoPrep</p>
          <h1 className="mt-3 text-4xl font-black text-[var(--foreground)]">A Critical Error Occurred</h1>
          <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--foreground)_78%,transparent)]">Please retry. If this persists, restart the app server.</p>
          <button
            className="mt-6 rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
            onClick={() => reset()}
            type="button"
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}

