import fs from "node:fs/promises";
import path from "node:path";
import type { Course, Module } from "@/types";
import type { CourseRootSetting } from "@/lib/config";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".html", ".htm"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const DOCUMENT_EXTENSIONS = new Set([".doc", ".docx", ".rtf"]);
const QUIZ_HINTS = ["quiz", "exam", "test", "assessment", "exercise", "assignment", "homework"];
const NOISE_NAME_HINTS = ["support us", "freecoursesonline", "websites you may like"];

function isSupportedContentExtension(ext: string): boolean {
  return (
    VIDEO_EXTENSIONS.has(ext) ||
    AUDIO_EXTENSIONS.has(ext) ||
    TEXT_EXTENSIONS.has(ext) ||
    PDF_EXTENSIONS.has(ext) ||
    DOCUMENT_EXTENSIONS.has(ext)
  );
}

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitle(fileName: string): string {
  const withoutExt = fileName.replace(path.extname(fileName), "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeReadDir(dirPath: string) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function shouldIgnoreEntryName(name: string): boolean {
  const lower = name.toLowerCase();
  return NOISE_NAME_HINTS.some((hint) => lower.includes(hint));
}

async function findContentFilesRecursively(dirPath: string): Promise<string[]> {
  const entries = await safeReadDir(dirPath);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isSymbolicLink()) {
        return [];
      }

      if (entry.isDirectory()) {
        if (shouldIgnoreEntryName(entry.name)) {
          return [];
        }
        return findContentFilesRecursively(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".url" || shouldIgnoreEntryName(entry.name)) {
        return [];
      }

      if (isSupportedContentExtension(ext)) {
        return [fullPath];
      }

      return [];
    }),
  );

  return nested.flat();
}

function toMediaType(fileName: string): "video" | "audio" | "text" | "pdf" | "quiz" | "document" {
  const ext = path.extname(fileName).toLowerCase();
  const lower = fileName.toLowerCase();

  if (QUIZ_HINTS.some((hint) => lower.includes(hint))) {
    return "quiz";
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }

  if (PDF_EXTENSIONS.has(ext)) {
    return "pdf";
  }

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return "document";
  }

  return "text";
}

function buildLesson(filePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();

  return {
    id: toId(relativePath),
    title: toTitle(fileName),
    contentPath: relativePath,
    mediaType: toMediaType(fileName),
    fileExtension: extension,
  };
}

export async function scanCourses(courseRoots: CourseRootSetting[]): Promise<Course[]> {
  const courses: Course[] = [];

  for (const courseRoot of courseRoots) {
    const normalizedRootPath = courseRoot.path.trim();

    if (!normalizedRootPath) {
      continue;
    }

    const courseEntries = await safeReadDir(normalizedRootPath);

    for (const courseEntry of courseEntries) {
      if (!courseEntry.isDirectory() || courseEntry.isSymbolicLink()) {
        continue;
      }

      const coursePath = path.join(normalizedRootPath, courseEntry.name);
      const courseItems = (await safeReadDir(coursePath)).filter((item) => !shouldIgnoreEntryName(item.name));

      const modules: Module[] = [];

      const directFiles = courseItems
        .filter((item) => item.isFile())
        .map((item) => path.join(coursePath, item.name))
        .filter((filePath) => {
          const ext = path.extname(filePath).toLowerCase();

          return VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext);
        });

      if (directFiles.length > 0) {
        modules.push({
          id: toId(`${courseRoot.label}-${courseEntry.name}-content`),
          name: "Content",
          lessons: directFiles.sort((a, b) => a.localeCompare(b)).map((filePath) => buildLesson(filePath, normalizedRootPath)),
        });
      }

      for (const moduleEntry of courseItems) {
        if (!moduleEntry.isDirectory() || moduleEntry.isSymbolicLink()) {
          continue;
        }

        const modulePath = path.join(coursePath, moduleEntry.name);
        const moduleItems = (await safeReadDir(modulePath)).filter((item) => !shouldIgnoreEntryName(item.name));
        const directModuleFiles = moduleItems
          .filter((item) => item.isFile())
          .filter((item) => {
            const ext = path.extname(item.name).toLowerCase();
            return ext !== ".url" && isSupportedContentExtension(ext);
          });
        const chapterDirs = moduleItems.filter((item) => item.isDirectory() && !item.isSymbolicLink());

        if (directModuleFiles.length === 0 && chapterDirs.length > 0) {
          for (const chapterDir of chapterDirs) {
            const chapterPath = path.join(modulePath, chapterDir.name);
            const chapterContentFiles = await findContentFilesRecursively(chapterPath);
            const chapterLessons = chapterContentFiles.sort((a, b) => a.localeCompare(b)).map((filePath) => buildLesson(filePath, normalizedRootPath));

            if (chapterLessons.length > 0) {
              modules.push({
                id: toId(`${courseRoot.label}-${courseEntry.name}-${moduleEntry.name}-${chapterDir.name}`),
                name: `${moduleEntry.name} / ${chapterDir.name}`,
                lessons: chapterLessons,
              });
            }
          }
        } else {
          const lessonContentFiles = await findContentFilesRecursively(modulePath);
          const lessons = lessonContentFiles.sort((a, b) => a.localeCompare(b)).map((filePath) => buildLesson(filePath, normalizedRootPath));

          if (lessons.length > 0) {
            modules.push({
              id: toId(`${courseRoot.label}-${courseEntry.name}-${moduleEntry.name}`),
              name: moduleEntry.name,
              lessons,
            });
          }
        }
      }

      if (modules.length > 0) {
        courses.push({
          id: toId(`${courseRoot.label}-${courseEntry.name}`),
          name: courseEntry.name,
          modules,
          sourceRootPath: normalizedRootPath,
          sourceRootLabel: courseRoot.label,
        });
      }
    }
  }

  return courses.sort((a, b) => {
    const rootComparison = a.sourceRootLabel.localeCompare(b.sourceRootLabel);
    if (rootComparison !== 0) {
      return rootComparison;
    }

    return a.name.localeCompare(b.name);
  });
}
