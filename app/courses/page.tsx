"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Course, CourseOrganizerState, CourseFolder } from "@/types";

type GroupedFolder = {
  id: string;
  label: string;
  courses: Course[];
  isUnsorted?: boolean;
};

const createFolderId = () => `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultOrganizerState = (): CourseOrganizerState => ({
  folders: [],
  courseFolderMap: {},
});

const normalizeLabel = (label: string, fallback: string): string => {
  const trimmed = label.trim();
  return trimmed || fallback;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<CourseOrganizerState>(createDefaultOrganizerState());
  const [hasLoadedOrganizer, setHasLoadedOrganizer] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingCourseId, setDraggingCourseId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

  const cardThemes = [
    {
      chip: "border-cyan-400/45 bg-cyan-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#0891b2_10%)]",
      strip: "from-cyan-300/24 via-sky-300/12 to-transparent",
      panel: "border-cyan-200/34 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(56,189,248,0.08))]",
    },
    {
      chip: "border-emerald-400/45 bg-emerald-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#059669_10%)]",
      strip: "from-emerald-300/24 via-lime-300/12 to-transparent",
      panel: "border-emerald-200/34 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(163,230,53,0.08))]",
    },
    {
      chip: "border-amber-400/45 bg-amber-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#b45309_10%)]",
      strip: "from-amber-300/24 via-rose-300/12 to-transparent",
      panel: "border-amber-200/34 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(251,113,133,0.08))]",
    },
    {
      chip: "border-fuchsia-400/45 bg-fuchsia-400/14 text-[color-mix(in_srgb,var(--foreground)_90%,#c026d3_10%)]",
      strip: "from-fuchsia-300/24 via-violet-300/12 to-transparent",
      panel: "border-fuchsia-200/34 bg-[linear-gradient(135deg,rgba(232,121,249,0.16),rgba(167,139,250,0.08))]",
    },
  ] as const;

  useEffect(() => {
    const run = async () => {
      try {
        const agentUrl = window.localStorage.getItem("locoprep-agent-url") || "";
        const coursesEndpoint = agentUrl ? `${agentUrl}/api/courses` : "/api/courses";

        const headers: Record<string, string> = {};
        if (agentUrl) headers["Bypass-Tunnel-Reminder"] = "true";

        const [coursesResponse, settingsResponse] = await Promise.all([
          fetch(coursesEndpoint, { cache: "no-store", headers }),
          fetch("/api/settings", { cache: "no-store" }),
        ]);

        if (coursesResponse.status === 401 || settingsResponse.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }

        const coursesData = (await coursesResponse.json()) as Course[] | { error: string };
        if (!coursesResponse.ok) {
          const message = "error" in coursesData ? coursesData.error : "Unable to load courses.";
          throw new Error(message);
        }

        const settingsData = (await settingsResponse.json()) as { courseOrganizer?: Partial<CourseOrganizerState> } | { error: string };
        if (settingsResponse.ok && !("error" in settingsData)) {
          const folders = Array.isArray(settingsData.courseOrganizer?.folders)
            ? settingsData.courseOrganizer?.folders
                .filter((folder): folder is CourseFolder => Boolean(folder) && typeof folder.id === "string" && typeof folder.label === "string")
                .map((folder) => ({ id: folder.id, label: folder.label }))
            : [];
          const courseFolderMap = settingsData.courseOrganizer?.courseFolderMap && typeof settingsData.courseOrganizer.courseFolderMap === "object"
            ? Object.fromEntries(
                Object.entries(settingsData.courseOrganizer.courseFolderMap).filter((entry): entry is [string, string] =>
                  typeof entry[0] === "string" && typeof entry[1] === "string",
                ),
              )
            : {};

          setOrganizer({ folders, courseFolderMap });
        }

        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load courses.");
      } finally {
        setHasLoadedOrganizer(true);
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (!hasLoadedOrganizer) {
      return;
    }
    const persistOrganizer = async () => {
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseOrganizer: organizer }),
        });
      } catch {
        // Keep the local UI responsive; the next change or refresh can retry.
      }
    };

    void persistOrganizer();
  }, [hasLoadedOrganizer, organizer]);

  const groupedFolders = useMemo<GroupedFolder[]>(() => {
    const folderLookup = new Map(organizer.folders.map((folder) => [folder.id, folder.label] as const));
    const folderCourses = new Map<string, Course[]>();
    const unsorted: Course[] = [];

    for (const course of courses) {
      const folderId = organizer.courseFolderMap[course.id];
      if (!folderId || !folderLookup.has(folderId)) {
        unsorted.push(course);
        continue;
      }

      const current = folderCourses.get(folderId) ?? [];
      current.push(course);
      folderCourses.set(folderId, current);
    }

    const sections: GroupedFolder[] = organizer.folders.map((folder) => ({
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
  }, [courses, organizer.courseFolderMap, organizer.folders]);

  const folderOptions = useMemo(() => organizer.folders, [organizer.folders]);

  const createFolder = () => {
    const label = newFolderName.trim();
    if (!label) {
      return;
    }

    const folder: CourseFolder = {
      id: createFolderId(),
      label,
    };

    setOrganizer((current) => ({
      ...current,
      folders: [...current.folders, folder],
    }));
    setNewFolderName("");
  };

  const renameFolder = (folderId: string, label: string) => {
    setOrganizer((current) => ({
      ...current,
      folders: current.folders.map((folder) =>
        folder.id === folderId ? { ...folder, label: normalizeLabel(label, folder.label) } : folder,
      ),
    }));
  };

  const deleteFolder = (folderId: string) => {
    setOrganizer((current) => {
      const nextMap = { ...current.courseFolderMap };
      for (const [courseId, assignedFolderId] of Object.entries(nextMap)) {
        if (assignedFolderId === folderId) {
          delete nextMap[courseId];
        }
      }

      return {
        folders: current.folders.filter((folder) => folder.id !== folderId),
        courseFolderMap: nextMap,
      };
    });
  };

  const assignCourseToFolder = (courseId: string, folderId: string) => {
    setOrganizer((current) => {
      const nextMap = { ...current.courseFolderMap };
      if (folderId === "") {
        delete nextMap[courseId];
      } else {
        nextMap[courseId] = folderId;
      }

      return {
        ...current,
        courseFolderMap: nextMap,
      };
    });
  };

  const handleCourseDragStart = (event: React.DragEvent<HTMLElement>, courseId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", courseId);
    setDraggingCourseId(courseId);
  };

  const handleCourseDragEnd = () => {
    setDraggingCourseId(null);
    setDropTargetFolderId(null);
  };

  const handleFolderDragOver = (event: React.DragEvent<HTMLElement>, folderId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDropTargetFolderId(null);
  };

  const handleFolderDrop = (event: React.DragEvent<HTMLElement>, folderId: string) => {
    event.preventDefault();
    const courseId = event.dataTransfer.getData("text/plain");
    if (courseId) {
      assignCourseToFolder(courseId, folderId);
    }
    setDraggingCourseId(null);
    setDropTargetFolderId(null);
  };

  return (
    <section className="space-y-6">
      <header className="glass-luxe edge-glow-violet paper-tape motion-reveal relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Learning Library</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] sm:text-4xl">Browse Courses</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)] sm:text-base">
          Create your own folders, label them the way you want, and file courses into them like a library.
        </p>
      </header>

      <section className="glass-luxe-soft edge-glow-violet motion-reveal motion-delay-1 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Folders</p>
            <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">Organize your courses</h2>
            <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
              Each folder behaves like a custom section. Move courses in and out whenever you want.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="w-full rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] sm:w-72"
              disabled={isLoading}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createFolder();
                }
              }}
              placeholder="New folder name, e.g. GUI"
              value={newFolderName}
            />
            <button className="btn btn-primary px-5 py-3 text-sm" disabled={isLoading} onClick={createFolder} type="button">
              Create folder
            </button>
          </div>
        </div>

        {folderOptions.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {folderOptions.map((folder) => (
              <span key={folder.id} className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_76%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                {folder.label}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">Available Paths</h2>
        <span className="accent-script rounded-full border border-transparent bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
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
        <div className="glass-luxe-soft edge-glow-violet rounded-2xl p-6 text-sm text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
          No courses found. Add course content and refresh.
        </div>
      ) : null}

      {!isLoading && !error && courses.length > 0 ? (
        <div className="space-y-8">
          {groupedFolders.map((folderGroup, groupIndex) => {
            const sectionTheme = cardThemes[groupIndex % cardThemes.length];

            const isDropTarget = dropTargetFolderId === folderGroup.id;

            return (
              <section
                key={folderGroup.id}
                className={`glass-luxe-soft edge-glow-violet rounded-2xl p-5 sm:p-6 transition ${isDropTarget ? "border-[color-mix(in_srgb,var(--accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)]" : ""}`}
                onDragLeave={handleFolderDragLeave}
                onDragOver={(event) => handleFolderDragOver(event, folderGroup.id)}
                onDrop={(event) => handleFolderDrop(event, folderGroup.id)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full bg-gradient-to-r ${sectionTheme.strip}`} />
                      <h3 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">{folderGroup.label}</h3>
                    </div>
                    <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
                      {folderGroup.courses.length} course{folderGroup.courses.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  {!folderGroup.isUnsorted ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="w-44 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                        defaultValue={folderGroup.label}
                        onBlur={(event) => renameFolder(folderGroup.id, event.target.value)}
                        placeholder="Folder name"
                        type="text"
                      />
                      <button
                        className="btn btn-ghost px-4 py-2 text-sm"
                        onClick={() => deleteFolder(folderGroup.id)}
                        type="button"
                      >
                        Delete folder
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {folderGroup.courses.length > 0 ? folderGroup.courses.map((course, index) => {
                    const theme = cardThemes[(groupIndex + index) % cardThemes.length];
                    const isDragging = draggingCourseId === course.id;

                    return (
                      <article
                        key={course.id}
                        draggable
                        onDragEnd={handleCourseDragEnd}
                        onDragStart={(event) => handleCourseDragStart(event, course.id)}
                        className={`glass-luxe-soft edge-glow-violet paper-tape motion-reveal motion-hover-surface group relative overflow-hidden rounded-2xl p-5 transition hover:border-transparent ${isDragging ? "scale-[0.98] opacity-60" : ""} ${(index % 4) === 0 ? "paper-tilt-1" : (index % 4) === 1 ? "paper-tilt-2" : (index % 4) === 2 ? "paper-tilt-3" : "paper-tilt-4"}`}
                        style={{ ["--reveal-delay" as string]: `${80 + (index % 6) * 70}ms` }}
                      >
                        <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${theme.strip}`} />
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <span className={`accent-script rounded-full border border-transparent px-3 py-1 text-xs font-semibold ${theme.chip}`}>
                            {course.modules.length} modules
                          </span>
                          <select
                            className="rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
                            disabled={isLoading}
                            onChange={(event) => assignCourseToFolder(course.id, event.target.value)}
                            value={organizer.courseFolderMap[course.id] ?? ""}
                          >
                            <option value="">Unsorted</option>
                            {folderOptions.map((folder) => (
                              <option key={folder.id} value={folder.id}>
                                {folder.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{course.name}</h2>
                        <div className={`mt-4 rounded-2xl border p-4 shadow-[0_10px_24px_-20px_var(--card-shadow)] ${theme.panel}`}>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                            <span className="rounded-full border border-transparent bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] px-2 py-1">
                              {course.sourceRootLabel}
                            </span>
                            <span className="rounded-full border border-transparent bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] px-2 py-1">
                              Drag to move
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)]">Structured lessons, media, and quizzes inside.</p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="accent-script text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition group-hover:text-[var(--foreground)]">
                              Open course
                            </p>
                            <Link
                              className="btn btn-ghost relative z-10 px-4 py-2 text-xs"
                              href={`/courses/${course.id}`}
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] p-6 text-sm text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
                      No courses in this folder yet. Use the folder selector on a course card to move it here.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
