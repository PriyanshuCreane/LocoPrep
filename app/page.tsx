"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Course, CourseOrganizerState } from "@/types";
import { useGamificationStore } from "@/store/gamification-store";

type CourseCard = Course & {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type FolderSection = {
  id: string;
  label: string;
  courses: CourseCard[];
  isUnsorted?: boolean;
};

function ProgressRing({
  progress,
  strokeClass,
  trackClass,
}: {
  progress: number;
  strokeClass?: string;
  trackClass?: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative h-16 w-16">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          className={trackClass ?? "stroke-[color-mix(in_srgb,var(--foreground)_14%,transparent)]"}
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          strokeWidth="8"
        />
        <circle
          className={strokeClass ?? "stroke-[var(--foreground)]"}
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--foreground)]">
        {progress}%
      </span>
    </div>
  );
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseOrganizer, setCourseOrganizer] = useState<CourseOrganizerState>({
    folders: [],
    courseFolderMap: {},
  });
  const [courseProgress, setCourseProgress] = useState<Record<string, { totalLessons: number; completedLessons: number; totalXp: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentLesson, setRecentLesson] = useState<{ lessonId: string; courseId: string; lastUpdated: string } | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const level = useGamificationStore((state) => state.level);
  const totalXp = useGamificationStore((state) => state.totalXp);
  const nextLevelXp = useGamificationStore((state) => state.nextLevelXp);
  const currentStreak = useGamificationStore((state) => state.currentStreak);
  const syncStats = useGamificationStore((state) => state.syncStats);

  useEffect(() => {
    void syncStats();
  }, [syncStats]);

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [coursesResponse, settingsResponse] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/settings", { cache: "no-store" }),
        ]);

        if (coursesResponse.status === 401 || settingsResponse.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }

        const data = (await coursesResponse.json()) as Course[] | { error: string };

        if (!coursesResponse.ok) {
          const message = "error" in data ? data.error : "Failed to load courses.";
          throw new Error(message);
        }

        const settingsData = (await settingsResponse.json()) as {
          courseOrganizer?: Partial<CourseOrganizerState>;
        } | { error: string };

        if (settingsResponse.ok && !("error" in settingsData)) {
          const folders = Array.isArray(settingsData.courseOrganizer?.folders)
            ? settingsData.courseOrganizer.folders
                .filter(
                  (folder): folder is { id: string; label: string } =>
                    Boolean(folder) && typeof folder.id === "string" && typeof folder.label === "string",
                )
                .map((folder) => ({ id: folder.id, label: folder.label }))
            : [];

          const courseFolderMap =
            settingsData.courseOrganizer?.courseFolderMap && typeof settingsData.courseOrganizer.courseFolderMap === "object"
              ? Object.fromEntries(
                  Object.entries(settingsData.courseOrganizer.courseFolderMap).filter(
                    (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
                  ),
                )
              : {};

          setCourseOrganizer({ folders, courseFolderMap });
          setExpandedFolderIds(new Set(folders.map((folder) => folder.id)));
        }

        const coursesData = Array.isArray(data) ? data : [];
        setCourses(coursesData);

        try {
          const recentResponse = await fetch("/api/progress/recent", { cache: "no-store" });
          if (recentResponse.ok) {
            const recentData = (await recentResponse.json()) as {
              recent: { lessonId: string; courseId: string; lastUpdated: string } | null;
            };
            setRecentLesson(recentData.recent);
          }
        } catch {
          // Ignore recent progress errors
        }

        const progressMap: Record<string, { totalLessons: number; completedLessons: number; totalXp: number }> = {};
        for (const course of coursesData) {
          try {
            const progressResponse = await fetch(`/api/progress/${course.id}`, { cache: "no-store" });
            if (progressResponse.ok) {
              const progressData = (await progressResponse.json()) as {
                totalLessons: number;
                completedLessons: number;
                totalXp: number;
              };
              progressMap[course.id] = progressData;
            }
          } catch {
            // Ignore per-course progress errors
          }
        }
        setCourseProgress(progressMap);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCourses();
  }, []);

  const courseCards = useMemo(
    () =>
      courses.map((course) => {
        const totalLessons = course.modules.reduce(
          (count, module) => count + module.lessons.length,
          0,
        );

        const progress = courseProgress[course.id];
        const completedLessons = progress?.completedLessons ?? 0;
        const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

        return {
          ...course,
          totalLessons,
          completedLessons,
          progressPercent,
        };
      }),
    [courses, courseProgress],
  );

  const groupedFolders = useMemo<FolderSection[]>(() => {
    const folderLookup = new Map(courseOrganizer.folders.map((folder) => [folder.id, folder.label] as const));
    const folderCourses = new Map<string, CourseCard[]>();
    const unsorted: CourseCard[] = [];

    for (const course of courseCards) {
      const folderId = courseOrganizer.courseFolderMap[course.id];
      if (!folderId || !folderLookup.has(folderId)) {
        unsorted.push(course);
        continue;
      }

      const existing = folderCourses.get(folderId) ?? [];
      existing.push(course);
      folderCourses.set(folderId, existing);
    }

    const sections: FolderSection[] = courseOrganizer.folders.map((folder) => ({
      id: folder.id,
      label: folder.label,
      courses: (folderCourses.get(folder.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    sections.push({
      id: "unsorted",
      label: "Unsorted",
      courses: unsorted.sort((a, b) => a.name.localeCompare(b.name)),
      isUnsorted: true,
    });

    return sections;
  }, [courseCards, courseOrganizer.courseFolderMap, courseOrganizer.folders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const cardThemes = [
    {
      chipA: "border-cyan-400/45 bg-cyan-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#0891b2_10%)]",
      chipB: "border-sky-400/45 bg-sky-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#0284c7_10%)]",
      panel: "border-cyan-200/34 bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(56,189,248,0.1))]",
      ring: "stroke-cyan-500",
      ringTrack: "stroke-cyan-500/28",
      glow: "from-cyan-300/24 via-sky-300/12 to-transparent",
    },
    {
      chipA: "border-emerald-400/45 bg-emerald-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#059669_10%)]",
      chipB: "border-lime-400/45 bg-lime-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#65a30d_10%)]",
      panel: "border-emerald-200/34 bg-[linear-gradient(135deg,rgba(52,211,153,0.2),rgba(163,230,53,0.1))]",
      ring: "stroke-emerald-500",
      ringTrack: "stroke-emerald-500/28",
      glow: "from-emerald-300/24 via-lime-300/12 to-transparent",
    },
    {
      chipA: "border-amber-400/45 bg-amber-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#b45309_10%)]",
      chipB: "border-rose-400/45 bg-rose-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#be123c_10%)]",
      panel: "border-amber-200/34 bg-[linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,113,133,0.1))]",
      ring: "stroke-amber-500",
      ringTrack: "stroke-amber-500/28",
      glow: "from-amber-300/24 via-rose-300/12 to-transparent",
    },
    {
      chipA: "border-fuchsia-400/45 bg-fuchsia-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#c026d3_10%)]",
      chipB: "border-violet-400/45 bg-violet-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#7c3aed_10%)]",
      panel: "border-fuchsia-200/34 bg-[linear-gradient(135deg,rgba(232,121,249,0.2),rgba(167,139,250,0.1))]",
      ring: "stroke-fuchsia-500",
      ringTrack: "stroke-fuchsia-500/28",
      glow: "from-fuchsia-300/24 via-violet-300/12 to-transparent",
    },
  ] as const;

  return (
    <section className="space-y-8">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(56,189,248,0.24),transparent_36%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_70%_88%,rgba(244,114,182,0.18),transparent_40%)]" />
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_74%,transparent)] text-2xl font-bold text-[var(--foreground)]">
            {level}
          </div>
          <div className="flex-1 rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-3 shadow-[0_10px_24px_-20px_var(--card-shadow)]">
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Level Progress</p>
            <div className="mt-2 h-2 w-full rounded-full border border-[color-mix(in_srgb,var(--foreground)_14%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_58%,transparent)] p-0.5">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(129,140,248,0.92),rgba(244,114,182,0.92))] transition-all"
                style={{ width: `${Math.max(0, ((1000 - nextLevelXp) / 1000) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">{totalXp - ((level - 1) * 1000)} / 1000 XP</p>
          </div>
        </div>
        <p className="accent-script mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Momentum Hub
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Welcome back, <span className="text-[var(--accent-soft)]">Explorer.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color-mix(in_srgb,var(--foreground)_78%,transparent)] sm:text-base">
          {currentStreak > 0 ? `You're on a ${currentStreak}-day streak! Keep it going.` : "Start a streak by completing a lesson today."}
        </p>
      </header>

      <section>
        {recentLesson ? (
          <Link
            className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 motion-hover-surface mb-5 block rounded-2xl p-4 transition hover:border-[color-mix(in_srgb,var(--foreground)_28%,transparent)]"
            href={`/lesson/${recentLesson.courseId}/${recentLesson.lessonId}`}
          >
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Continue learning</p>
            <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]">Jump back into your most recently accessed lesson.</p>
          </Link>
        ) : null}

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Your Courses</h2>
          <span className="accent-script rounded-full border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
            {courseCards.length} found
          </span>
        </div>

        {isLoading ? (
          <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6">
            <div className="skeleton skeleton-line w-40" />
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="skeleton-card">
                <div className="skeleton skeleton-pill w-28" />
                <div className="mt-4 skeleton skeleton-line w-4/5" />
                <div className="mt-2 skeleton skeleton-line w-3/5" />
              </div>
              <div className="skeleton-card">
                <div className="skeleton skeleton-pill w-24" />
                <div className="mt-4 skeleton skeleton-line w-3/4" />
                <div className="mt-2 skeleton skeleton-line w-2/3" />
              </div>
              <div className="skeleton-card hidden xl:block">
                <div className="skeleton skeleton-pill w-20" />
                <div className="mt-4 skeleton skeleton-line w-5/6" />
                <div className="mt-2 skeleton skeleton-line w-1/2" />
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-300/35 bg-red-900/15 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && courseCards.length === 0 ? (
          <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
            No courses found. Go to Settings and set a valid COURSES_ROOT_PATH.
          </div>
        ) : null}

        {!isLoading && !error && courseCards.length > 0 ? (
          <div className="space-y-6">
            {groupedFolders.map((folder, groupIndex) => {
              const theme = cardThemes[groupIndex % cardThemes.length];
              const isExpanded = expandedFolderIds.has(folder.id);

              return (
                <section
                  key={folder.id}
                  className="glass-luxe-soft edge-glow-violet rounded-2xl p-5 sm:p-6"
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 text-left"
                    onClick={() => toggleFolder(folder.id)}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full bg-gradient-to-r ${theme.glow}`} />
                        <h3 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">{folder.label}</h3>
                      </div>
                      <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
                        {folder.courses.length} course{folder.courses.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {isExpanded ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {folder.courses.length > 0 ? folder.courses.map((course, index) => {
                        const courseTheme = cardThemes[(groupIndex + index) % cardThemes.length];

                        return (
                          <Link
                            key={course.id}
                            className={`glass-luxe-soft edge-glow-violet paper-tape motion-reveal motion-hover-surface group relative block overflow-hidden rounded-2xl p-5 transition hover:border-[color-mix(in_srgb,var(--foreground)_28%,transparent)] ${(index % 4) === 0 ? "paper-tilt-1" : (index % 4) === 1 ? "paper-tilt-2" : (index % 4) === 2 ? "paper-tilt-3" : "paper-tilt-4"}`}
                            href={`/courses/${course.id}`}
                            style={{ ["--reveal-delay" as string]: `${80 + (index % 6) * 70}ms` }}
                          >
                            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${courseTheme.glow}`} />
                            <div className="mb-4 flex items-center justify-between">
                              <span className={`accent-script rounded-full border px-3 py-1 text-xs font-semibold ${courseTheme.chipA}`}>
                                {course.modules.length} modules
                              </span>
                              <span className={`accent-script rounded-full border px-3 py-1 text-xs font-semibold ${courseTheme.chipB}`}>
                                {course.totalLessons} lessons
                              </span>
                            </div>
                            <h3 className="mb-4 text-lg font-bold text-[var(--foreground)]">{course.name}</h3>
                            <div className={`rounded-2xl border p-4 shadow-[0_10px_24px_-20px_var(--card-shadow)] ${courseTheme.panel}`}>
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)]">Course progress</p>
                                  <p className="mt-1 text-sm font-semibold text-[color-mix(in_srgb,var(--foreground)_92%,transparent)]">
                                    {course.completedLessons} / {course.totalLessons} completed
                                  </p>
                                  <p className="accent-script mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                    Open course
                                  </p>
                                </div>
                                <ProgressRing
                                  progress={course.progressPercent}
                                  strokeClass={courseTheme.ring}
                                  trackClass={courseTheme.ringTrack}
                                />
                              </div>
                            </div>
                          </Link>
                        );
                      }) : (
                        <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] p-6 text-sm text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
                          This folder is empty.
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </section>
    </section>
  );
}
