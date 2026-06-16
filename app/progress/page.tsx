export default function ProgressPage() {
  const cardThemes = [
    {
      delay: "motion-delay-1",
      strip: "from-cyan-300/24 via-sky-300/12 to-transparent",
      panel: "border-cyan-200/34 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(56,189,248,0.08))]",
    },
    {
      delay: "motion-delay-2",
      strip: "from-emerald-300/24 via-lime-300/12 to-transparent",
      panel: "border-emerald-200/34 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(163,230,53,0.08))]",
    },
    {
      delay: "motion-delay-3",
      strip: "from-amber-300/24 via-rose-300/12 to-transparent",
      panel: "border-amber-200/34 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(251,113,133,0.08))]",
    },
  ] as const;

  return (
    <section className="space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-300/24 via-fuchsia-300/16 to-amber-300/20" />
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Performance Arc</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] sm:text-4xl">Progress</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)] sm:text-base">
          Review your learning momentum, consistency, and growth at a glance.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cardThemes.map((theme, index) => (
          <article
            key={index}
            className={`glass-luxe-soft edge-glow-violet motion-reveal ${theme.delay} motion-hover-surface relative overflow-hidden rounded-2xl p-5 ${theme.panel}`}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${theme.strip}`} />
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {index === 0 ? "Current Streak" : index === 1 ? "XP Trend" : "Course Completion"}
            </p>
            <p className="mt-3 text-2xl font-bold text-[var(--foreground)]">Coming soon</p>
          </article>
        ))}
      </div>

      <section className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-4 relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-300/24 via-violet-300/12 to-cyan-300/20" />
        <h2 className="text-xl font-bold text-[var(--foreground)]">Insights Roadmap</h2>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
          Detailed analytics are being prepared. This page now mirrors the premium visual system and is ready for live metrics wiring.
        </p>
      </section>
    </section>
  );
}
