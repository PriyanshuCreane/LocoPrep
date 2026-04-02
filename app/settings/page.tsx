"use client";

import { FormEvent, useEffect, useState } from "react";
import { useGamificationStore } from "@/store/gamification-store";
import { useLessonProgressStore } from "@/store/lesson-progress-store";

type SettingsResponse = {
  coursesRootPath: string;
  autoplayVideos: boolean;
  autoAdvanceOnEnd: boolean;
};

export default function SettingsPage() {
  const [coursesRootPath, setCoursesRootPath] = useState("");
  const [autoplayVideos, setAutoplayVideos] = useState(false);
  const [autoAdvanceOnEnd, setAutoAdvanceOnEnd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const resetAllProgress = useLessonProgressStore((state) => state.resetAllProgress);
  const setStats = useGamificationStore((state) => state.setStats);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (response.status === 401) {
          setMessage("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }

        const data = (await response.json()) as SettingsResponse;
        setCoursesRootPath(data.coursesRootPath ?? "");
        setAutoplayVideos(Boolean(data.autoplayVideos));
        setAutoAdvanceOnEnd(Boolean(data.autoAdvanceOnEnd));
      } catch {
        setMessage("Unable to load settings.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coursesRootPath,
          autoplayVideos,
          autoAdvanceOnEnd,
        }),
      });

      if (response.status === 401) {
        setMessage("Session expired. Redirecting to login...");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save settings.");
      }

      setMessage("Saved. Refresh the dashboard to rescan courses.");
    } catch {
      setMessage("Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const clearLocalProgress = () => {
    resetAllProgress();
    setStats({
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 1,
      nextLevelXp: 1000,
    });
    setMessage("Local progress cache cleared. Server progress is unchanged.");
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">System Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          Configure where LocoPrep scans your course files.
        </p>
      </header>

      <form className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 space-y-4 rounded-2xl p-6" onSubmit={onSubmit}>
        <label className="block space-y-2">
          <span className="accent-script text-sm font-semibold text-[var(--foreground)]">COURSES_ROOT_PATH</span>
          <input
            className="w-full rounded-xl border border-white/24 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-white/40"
            disabled={isLoading || isSaving}
            onChange={(event) => setCoursesRootPath(event.target.value)}
            placeholder="D:/Courses"
            type="text"
            value={coursesRootPath}
          />
        </label>

        <button className="btn btn-primary px-5 py-2 text-sm" disabled={isLoading || isSaving} type="submit">
          {isSaving ? "Saving..." : "Save"}
        </button>

        <div className="rounded-2xl border border-white/16 bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] p-4">
          <p className="text-sm font-semibold text-white/90">Playback behavior</p>
          <p className="mt-1 text-xs text-white/65">These options control how videos behave when a lesson opens or finishes.</p>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/12 bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3">
            <input
              checked={autoplayVideos}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              disabled={isLoading || isSaving}
              onChange={(event) => setAutoplayVideos(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-white">Auto play video on open</span>
              <span className="block text-xs text-white/65">Starts playback automatically when a video lesson is opened.</span>
            </span>
          </label>

          <label className="mt-3 flex items-start gap-3 rounded-xl border border-white/12 bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3">
            <input
              checked={autoAdvanceOnEnd}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              disabled={isLoading || isSaving}
              onChange={(event) => setAutoAdvanceOnEnd(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-white">Auto next when video ends</span>
              <span className="block text-xs text-white/65">Moves to the next lesson automatically when the current video finishes.</span>
            </span>
          </label>
        </div>

        {isLoading ? (
          <div className="skeleton-card">
            <div className="skeleton skeleton-line w-40" />
            <div className="mt-3 skeleton skeleton-line w-full" />
            <div className="mt-2 skeleton skeleton-line w-2/3" />
          </div>
        ) : null}

        <div className="border-t border-white/16 pt-4">
          <p className="text-sm font-semibold text-white/90">Local progress cache</p>
          <p className="mt-1 text-xs text-white/65">
            This clears browser-stored progress and gamification values for this device.
          </p>
          <button
            className="btn btn-danger mt-3 px-5 py-2 text-sm"
            onClick={clearLocalProgress}
            type="button"
          >
            Clear local progress
          </button>
        </div>

        {message ? <p className="text-sm text-white/85">{message}</p> : null}
      </form>
    </section>
  );
}
