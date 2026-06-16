"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, NotebookText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Course } from "@/types";

type LessonFilter = "all" | "remaining" | "completed";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [lastActiveLessonId, setLastActiveLessonId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [filter, setFilter] = useState<LessonFilter>("all");
  const [isResetting, setIsResetting] = useState(false);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (response.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }
        const data = (await response.json()) as Course[] | { error: string };
        if (!response.ok) {
          const message = "error" in data ? data.error : "Unable to load course.";
          throw new Error(message);
        }

        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load course.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (!courseId) {
      return;
    }

    const loadProgress = async () => {
      setProgressLoaded(false);
      try {
        const response = await fetch(`/api/progress/${courseId}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          completedLessonIds?: string[];
          lastActiveLessonId?: string | null;
        };

        setCompletedLessonIds(new Set(data.completedLessonIds ?? []));
        setLastActiveLessonId(data.lastActiveLessonId ?? null);
      } catch {
        // Ignore progress load failures for now
      } finally {
        setProgressLoaded(true);
      }
    };

    void loadProgress();
  }, [courseId]);

  const course = useMemo(() => courses.find((item) => item.id === courseId), [courseId, courses]);

  const mapThemes = [
    {
      strip: "from-cyan-300/45 via-sky-300/22 to-transparent",
      modulePanel: "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(14,165,233,0.08))] shadow-[0_18px_36px_-30px_rgba(34,211,238,0.42)]",
      lessonDot: "bg-cyan-300/95",
      lessonPanel: "border-cyan-300/14 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(56,189,248,0.04))]",
      chip: "border-cyan-300/55 bg-cyan-300/20 text-cyan-950 dark:text-cyan-50",
    },
    {
      strip: "from-emerald-300/45 via-lime-300/22 to-transparent",
      modulePanel: "border-emerald-300/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.18),rgba(132,204,22,0.08))] shadow-[0_18px_36px_-30px_rgba(16,185,129,0.42)]",
      lessonDot: "bg-emerald-300/95",
      lessonPanel: "border-emerald-300/14 bg-[linear-gradient(135deg,rgba(52,211,153,0.08),rgba(163,230,53,0.04))]",
      chip: "border-emerald-300/55 bg-emerald-300/20 text-emerald-950 dark:text-emerald-50",
    },
    {
      strip: "from-amber-300/45 via-rose-300/22 to-transparent",
      modulePanel: "border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(244,114,182,0.08))] shadow-[0_18px_36px_-30px_rgba(245,158,11,0.42)]",
      lessonDot: "bg-amber-300/95",
      lessonPanel: "border-amber-300/14 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,113,133,0.04))]",
      chip: "border-amber-300/55 bg-amber-300/20 text-amber-950 dark:text-amber-50",
    },
    {
      strip: "from-fuchsia-300/45 via-violet-300/22 to-transparent",
      modulePanel: "border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(232,121,249,0.18),rgba(167,139,250,0.08))] shadow-[0_18px_36px_-30px_rgba(217,70,239,0.42)]",
      lessonDot: "bg-fuchsia-300/95",
      lessonPanel: "border-fuchsia-300/14 bg-[linear-gradient(135deg,rgba(232,121,249,0.08),rgba(167,139,250,0.04))]",
      chip: "border-fuchsia-300/55 bg-fuchsia-300/20 text-fuchsia-950 dark:text-fuchsia-50",
    },
  ] as const;

  useEffect(() => {
    if (!course || !progressLoaded || hasAutoScrolledRef.current) {
      return;
    }

    const nextUnfinishedLesson = course.modules
      .flatMap((module) => module.lessons)
      .find((lesson) => !completedLessonIds.has(lesson.id));

    if (!nextUnfinishedLesson) {
      hasAutoScrolledRef.current = true;
      return;
    }

    const target = document.querySelector(`[data-lesson-id="${nextUnfinishedLesson.id}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      hasAutoScrolledRef.current = true;
    }
  }, [course, progressLoaded, completedLessonIds]);

  const handleResetCourseProgress = async () => {
    if (!courseId || isResetting) {
      return;
    }

    const shouldReset = window.confirm("Reset progress for this course only?");
    if (!shouldReset) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch(`/api/progress/${courseId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Unable to reset course progress.");
      }

      setCompletedLessonIds(new Set());
      setLastActiveLessonId(null);
      hasAutoScrolledRef.current = false;
      setFilter("all");
    } catch {
      window.alert("Could not reset this course progress right now.");
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-white/70">
        <div className="skeleton skeleton-line w-32" />
        <div className="mt-4 skeleton skeleton-line w-4/5" />
        <div className="mt-2 skeleton skeleton-line w-2/3" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-300/35 bg-red-900/15 p-6 text-sm text-red-200">
        {error}
      </section>
    );
  }

  if (!course) {
    return (
      <section className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-white/70">
        Course not found.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.14),transparent_32%),radial-gradient(circle_at_68%_88%,rgba(245,158,11,0.12),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-400/60 via-fuchsia-400/40 to-amber-400/55" />
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Course Map</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] sm:text-4xl">{course.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)] sm:text-base">Choose a lesson to start learning.</p>
        {lastActiveLessonId ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn btn-primary px-4 py-2 text-sm" href={`/lesson/${course.id}/${lastActiveLessonId}`}>
              Continue where you left off
            </Link>
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={handleResetCourseProgress} type="button" disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset this course progress"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <button className="btn btn-ghost px-4 py-2 text-sm" onClick={handleResetCourseProgress} type="button" disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset this course progress"}
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`btn px-3 py-1.5 text-xs ${filter === "all" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setFilter("all")}
          type="button"
        >
          All
        </button>
        <button
          className={`btn px-3 py-1.5 text-xs ${filter === "remaining" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setFilter("remaining")}
          type="button"
        >
          Remaining
        </button>
        <button
          className={`btn px-3 py-1.5 text-xs ${filter === "completed" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setFilter("completed")}
          type="button"
        >
          Completed
        </button>
      </div>

      <div className="space-y-4">
        {course.modules.map((module, moduleIndex) => {
          const moduleCompletedCount = module.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
          const moduleCompleted = module.lessons.length > 0 && moduleCompletedCount === module.lessons.length;
          const filteredLessons = module.lessons.filter((lesson) => {
            const completed = completedLessonIds.has(lesson.id);
            if (filter === "remaining") {
              return !completed;
            }
            if (filter === "completed") {
              return completed;
            }
            return true;
          });

          if (filteredLessons.length === 0) {
            return null;
          }

          return (
          <article
            key={module.id}
            className={`glass-luxe-soft edge-glow-violet motion-reveal relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-34px_rgba(0,0,0,0.45)] ${mapThemes[moduleIndex % mapThemes.length].modulePanel}`}
            style={{ ["--reveal-delay" as string]: `${80 + (moduleIndex % 5) * 80}ms` }}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${mapThemes[moduleIndex % mapThemes.length].strip}`} />
            <div className="pointer-events-none absolute right-4 top-4 h-16 w-16 rounded-full bg-white/8 blur-2xl" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={`text-xl font-bold text-[var(--foreground)] ${moduleCompleted ? "pen-cross opacity-80" : ""}`}>{module.name}</h2>
              <span className={`accent-script rounded-full border border-transparent px-3 py-1 text-xs font-semibold ${mapThemes[moduleIndex % mapThemes.length].chip}`}>
                {moduleCompletedCount} / {module.lessons.length} done
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredLessons.map((lesson, lessonIndex) => {
                const lessonCompleted = completedLessonIds.has(lesson.id);
                const theme = mapThemes[(moduleIndex + lessonIndex) % mapThemes.length];
                return (
                <Link
                  key={lesson.id}
                  data-lesson-id={lesson.id}
                  className={`glass-luxe-soft edge-glow-violet motion-reveal motion-hover-surface rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-transparent hover:bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] hover:text-[var(--foreground)] ${theme.lessonPanel}`}
                  href={`/lesson/${course.id}/${lesson.id}`}
                  style={{ ["--reveal-delay" as string]: `${120 + (lessonIndex % 6) * 55}ms` }}
                >
                  <span className={`mb-2 block h-1.5 w-14 rounded-full ${theme.strip} bg-gradient-to-r`} />
                  <span className="flex items-center gap-2">
                    {lessonCompleted ? (
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border border-transparent ${theme.lessonDot}`} aria-hidden>
                        <NotebookText className="h-2.5 w-2.5" />
                        <Check className="-ml-1 h-2.5 w-2.5" />
                      </span>
                    ) : null}
                    <span className={`block ${lessonCompleted ? "pen-cross opacity-80" : ""}`}>{lesson.title}</span>
                  </span>
                  <span className="accent-script mt-1 block text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {lessonCompleted ? "completed" : lesson.mediaType}
                  </span>
                </Link>
                );
              })}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
