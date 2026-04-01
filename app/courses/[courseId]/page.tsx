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
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Course Map</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{course.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">Choose a lesson to start learning.</p>
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
            className="glass-luxe-soft edge-glow-violet motion-reveal rounded-2xl p-5"
            style={{ ["--reveal-delay" as string]: `${80 + (moduleIndex % 5) * 80}ms` }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={`text-xl font-bold text-white ${moduleCompleted ? "pen-cross opacity-80" : ""}`}>{module.name}</h2>
              <span className="accent-script rounded-full border border-white/22 bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                {moduleCompletedCount} / {module.lessons.length} done
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredLessons.map((lesson, lessonIndex) => {
                const lessonCompleted = completedLessonIds.has(lesson.id);
                return (
                <Link
                  key={lesson.id}
                  data-lesson-id={lesson.id}
                  className="glass-luxe-soft edge-glow-violet motion-reveal motion-hover-surface rounded-xl px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-white/35 hover:bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] hover:text-[var(--foreground)]"
                  href={`/lesson/${course.id}/${lesson.id}`}
                  style={{ ["--reveal-delay" as string]: `${120 + (lessonIndex % 6) * 55}ms` }}
                >
                  <span className="flex items-center gap-2">
                    {lessonCompleted ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--surface-2)_85%,transparent)]" aria-hidden>
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
