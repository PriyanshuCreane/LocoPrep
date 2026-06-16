"use client";

import { FormEvent, useEffect, useState } from "react";
import { useGamificationStore } from "@/store/gamification-store";
import { useLessonProgressStore } from "@/store/lesson-progress-store";

type CourseRootSetting = {
  label: string;
  path: string;
};

type SettingsResponse = {
  courseRoots?: CourseRootSetting[];
  coursesRootPath?: string;
  autoplayVideos: boolean;
  autoAdvanceOnEnd: boolean;
  defaultPlaybackSpeed: number;
};

const createEmptyRoot = (): CourseRootSetting => ({
  label: "",
  path: "",
});

export default function SettingsPage() {
  const [courseRoots, setCourseRoots] = useState<CourseRootSetting[]>([createEmptyRoot()]);
  const [autoplayVideos, setAutoplayVideos] = useState(false);
  const [autoAdvanceOnEnd, setAutoAdvanceOnEnd] = useState(false);
  const [defaultPlaybackSpeed, setDefaultPlaybackSpeed] = useState<number>(1);
  const [agentUrl, setAgentUrl] = useState("");
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
        const roots = Array.isArray(data.courseRoots) && data.courseRoots.length > 0
          ? data.courseRoots
          : data.coursesRootPath
            ? [{ label: "", path: data.coursesRootPath }]
            : [createEmptyRoot()];

        setCourseRoots(roots.map((root) => ({ label: root.label ?? "", path: root.path ?? "" })));
        setAutoplayVideos(Boolean(data.autoplayVideos));
        setAutoAdvanceOnEnd(Boolean(data.autoAdvanceOnEnd));
        setDefaultPlaybackSpeed(
          typeof data.defaultPlaybackSpeed === "number" ? data.defaultPlaybackSpeed : 1,
        );

        const savedAgentUrl = window.localStorage.getItem("locoprep-agent-url");
        if (savedAgentUrl) {
          setAgentUrl(savedAgentUrl);
        }
      } catch {
        setMessage("Unable to load settings.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const updateRoot = (index: number, field: keyof CourseRootSetting, value: string) => {
    setCourseRoots((current) =>
      current.map((root, rootIndex) =>
        rootIndex === index ? { ...root, [field]: value } : root,
      ),
    );
  };

  const addRoot = () => {
    setCourseRoots((current) => [...current, createEmptyRoot()]);
  };

  const removeRoot = (index: number) => {
    setCourseRoots((current) => {
      if (current.length === 1) {
        return [createEmptyRoot()];
      }

      return current.filter((_, rootIndex) => rootIndex !== index);
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      window.localStorage.setItem("locoprep-agent-url", agentUrl.trim());

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseRoots,
          autoplayVideos,
          autoAdvanceOnEnd,
          defaultPlaybackSpeed,
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-300/24 via-fuchsia-300/16 to-amber-300/20" />
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">System Control</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)] sm:text-base">
          Configure one or more course library roots and how lessons play back.
        </p>
      </header>

      <form className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 relative space-y-4 overflow-hidden rounded-2xl p-6" onSubmit={onSubmit}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-300/22 via-sky-300/16 to-fuchsia-300/18" />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="accent-script text-sm font-semibold text-[var(--foreground)]">Course libraries</p>
              <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                Add each root you want LocoPrep to scan.
              </p>
            </div>
            <button className="btn btn-ghost px-4 py-2 text-sm" disabled={isLoading || isSaving} type="button" onClick={addRoot}>
              Add root
            </button>
          </div>

          <div className="space-y-3">
            {courseRoots.map((root, index) => (
              <div key={`${index}-${root.path}`} className="rounded-2xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">
                    Library {index + 1}
                  </p>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    disabled={isLoading || isSaving}
                    onClick={() => removeRoot(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Label</span>
                    <input
                      className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent"
                      disabled={isLoading || isSaving}
                      onChange={(event) => updateRoot(index, "label", event.target.value)}
                      placeholder="Java, Python, React..."
                      type="text"
                      value={root.label}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">COURSES_ROOT_PATH</span>
                    <input
                      className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent"
                      disabled={isLoading || isSaving}
                      onChange={(event) => updateRoot(index, "path", event.target.value)}
                      placeholder="D:/Courses"
                      type="text"
                      value={root.path}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary px-5 py-2 text-sm" disabled={isLoading || isSaving} type="submit">
          {isSaving ? "Saving..." : "Save"}
        </button>

        <div className="rounded-2xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] p-4">
          <div className="mb-3 h-1.5 w-28 rounded-full bg-gradient-to-r from-sky-300/24 via-violet-300/20 to-fuchsia-300/22" />
          <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Local Agent (Cloud Bridge)</p>
          <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">If you are running the LocoPrep Agent on your PC, paste your loca.lt tunnel URL here to stream local courses.</p>
          
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Agent URL</span>
            <input
              className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-transparent"
              disabled={isLoading || isSaving}
              onChange={(event) => setAgentUrl(event.target.value)}
              placeholder="https://locoprep-agent.loca.lt"
              type="url"
              value={agentUrl}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] p-4">
          <div className="mb-3 h-1.5 w-28 rounded-full bg-gradient-to-r from-cyan-300/24 via-emerald-300/20 to-amber-300/22" />
          <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Playback behavior</p>
          <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">These options control how videos behave when a lesson opens or finishes.</p>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3">
            <input
              checked={autoplayVideos}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              disabled={isLoading || isSaving}
              onChange={(event) => setAutoplayVideos(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Auto play video on open</span>
              <span className="block text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">Starts playback automatically when a video lesson is opened.</span>
            </span>
          </label>

          <label className="mt-3 flex items-start gap-3 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3">
            <input
              checked={autoAdvanceOnEnd}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              disabled={isLoading || isSaving}
              onChange={(event) => setAutoAdvanceOnEnd(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Auto next when video ends</span>
              <span className="block text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">Moves to the next lesson automatically when the current video finishes.</span>
            </span>
          </label>

          <label className="mt-3 block rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3">
            <span className="block text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Default playback speed</span>
            <span className="mt-0.5 block text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">Applies automatically whenever a lesson opens.</span>
            <select
              className="mt-2 w-full rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
              disabled={isLoading || isSaving}
              onChange={(event) => setDefaultPlaybackSpeed(Number(event.target.value))}
              value={defaultPlaybackSpeed}
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x (Normal)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="skeleton-card">
            <div className="skeleton skeleton-line w-40" />
            <div className="mt-3 skeleton skeleton-line w-full" />
            <div className="mt-2 skeleton skeleton-line w-2/3" />
          </div>
        ) : null}

        <div className="border-t border-transparent pt-4">
          <div className="mb-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-fuchsia-300/24 via-violet-300/18 to-cyan-300/20" />
          <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_94%,transparent)]">Local progress cache</p>
          <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">
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

        {message ? <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_84%,transparent)]">{message}</p> : null}
      </form>
    </section>
  );
}
