"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Course } from "@/types";
import { useGamificationStore } from "@/store/gamification-store";

function ProgressRing({ progress }: { progress: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative h-16 w-16">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          className="stroke-white/10"
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          strokeWidth="8"
        />
        <circle
          className="stroke-white"
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
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {progress}%
      </span>
    </div>
  );
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, { totalLessons: number; completedLessons: number; totalXp: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentLesson, setRecentLesson] = useState<{ lessonId: string; courseId: string; lastUpdated: string } | null>(null);

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
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (response.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }
        const data = (await response.json()) as Course[] | { error: string };

        if (!response.ok) {
          const message = "error" in data ? data.error : "Failed to load courses.";
          throw new Error(message);
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

  return (
    <section className="space-y-8">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/10 text-2xl font-bold text-[var(--foreground)]">
            {level}
          </div>
          <div className="flex-1 rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-3 shadow-[0_10px_24px_-20px_var(--card-shadow)]">
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Level Progress</p>
            <div className="mt-2 h-2 w-full rounded-full border border-[color-mix(in_srgb,var(--foreground)_14%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_58%,transparent)] p-0.5">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.max(0, ((1000 - nextLevelXp) / 1000) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-white/70">{totalXp - ((level - 1) * 1000)} / 1000 XP</p>
          </div>
        </div>
        <p className="accent-script mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Momentum Hub
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Welcome back, Explorer.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          {currentStreak > 0 ? `You're on a ${currentStreak}-day streak! Keep it going.` : "Start a streak by completing a lesson today."}
        </p>
      </header>

      <section>
        {recentLesson ? (
          <Link
            className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 motion-hover-surface mb-5 block rounded-2xl p-4 transition hover:border-white/35"
            href={`/lesson/${recentLesson.courseId}/${recentLesson.lessonId}`}
          >
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Continue learning</p>
            <p className="mt-1 text-sm text-white/90">Jump back into your most recently accessed lesson.</p>
          </Link>
        ) : null}

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Your Courses</h2>
          <span className="accent-script rounded-full border border-white/22 bg-white/8 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
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
          <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-white/70">
            No courses found. Go to Settings and set a valid COURSES_ROOT_PATH.
          </div>
        ) : null}

        {!isLoading && !error && courseCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courseCards.map((course, index) => (
              <Link
                key={course.id}
                className={`glass-luxe-soft edge-glow-violet paper-tape motion-reveal motion-hover-surface group block rounded-2xl p-5 transition hover:border-white/35 ${(index % 4) === 0 ? "paper-tilt-1" : (index % 4) === 1 ? "paper-tilt-2" : (index % 4) === 2 ? "paper-tilt-3" : "paper-tilt-4"}`}
                href={`/courses/${course.id}`}
                style={{ ["--reveal-delay" as string]: `${80 + (index % 6) * 70}ms` }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="accent-script rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {course.modules.length} modules
                  </span>
                  <span className="accent-script rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {course.totalLessons} lessons
                  </span>
                </div>
                <h3 className="mb-4 text-lg font-bold text-white">{course.name}</h3>
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-4 shadow-[0_10px_24px_-20px_var(--card-shadow)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                    <p className="text-sm text-white/70">Course progress</p>
                    <p className="mt-1 text-sm font-semibold text-white/92">
                      {course.completedLessons} / {course.totalLessons} completed
                    </p>
                    <p className="accent-script mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Open course
                    </p>
                    </div>
                    <ProgressRing progress={course.progressPercent} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
