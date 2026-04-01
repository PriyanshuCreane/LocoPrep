export default function ProgressPage() {
  return (
    <section className="space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Performance Arc</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Progress</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          Review your learning momentum, consistency, and growth at a glance.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 motion-hover-surface rounded-2xl p-5">
          <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Current Streak</p>
          <p className="mt-3 text-2xl font-bold text-white">Coming soon</p>
        </article>
        <article className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-2 motion-hover-surface rounded-2xl p-5">
          <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">XP Trend</p>
          <p className="mt-3 text-2xl font-bold text-white">Coming soon</p>
        </article>
        <article className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-3 motion-hover-surface rounded-2xl p-5">
          <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Course Completion</p>
          <p className="mt-3 text-2xl font-bold text-white">Coming soon</p>
        </article>
      </div>

      <section className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-4 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white">Insights Roadmap</h2>
        <p className="mt-2 text-sm text-white/70">
          Detailed analytics are being prepared. This page now mirrors the premium visual system and is ready for live metrics wiring.
        </p>
      </section>
    </section>
  );
}
