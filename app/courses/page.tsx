"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Course } from "@/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          const message = "error" in data ? data.error : "Unable to load courses.";
          throw new Error(message);
        }

        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load courses.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <section className="space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Learning Library</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Browse Courses</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          Select a course, explore modules, and jump into lessons with one click.
        </p>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white sm:text-xl">Available Paths</h2>
        <span className="accent-script rounded-full border border-white/22 bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
          {courses.length} courses
        </span>
      </div>

      {isLoading ? (
        <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6">
          <div className="skeleton skeleton-line w-32" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="skeleton-card"><div className="skeleton skeleton-pill w-24" /><div className="mt-4 skeleton skeleton-line w-4/5" /></div>
            <div className="skeleton-card"><div className="skeleton skeleton-pill w-20" /><div className="mt-4 skeleton skeleton-line w-3/4" /></div>
            <div className="skeleton-card hidden xl:block"><div className="skeleton skeleton-pill w-28" /><div className="mt-4 skeleton skeleton-line w-2/3" /></div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-300/35 bg-red-900/15 p-6 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && courses.length === 0 ? (
        <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-white/70">
          No courses found. Add course content and refresh.
        </div>
      ) : null}

      {!isLoading && !error && courses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, index) => (
            <Link
              key={course.id}
              className={`glass-luxe-soft edge-glow-violet paper-tape motion-reveal motion-hover-surface group rounded-2xl p-5 transition hover:border-white/35 ${(index % 4) === 0 ? "paper-tilt-1" : (index % 4) === 1 ? "paper-tilt-2" : (index % 4) === 2 ? "paper-tilt-3" : "paper-tilt-4"}`}
              href={`/courses/${course.id}`}
              style={{ ["--reveal-delay" as string]: `${80 + (index % 6) * 70}ms` }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="accent-script rounded-full border border-white/22 bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  {course.modules.length} modules
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{course.name}</h2>
              <p className="mt-2 text-sm text-white/70">Structured lessons, media, and quizzes inside.</p>
              <p className="accent-script mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition group-hover:text-[var(--foreground)]">
                Open course
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
