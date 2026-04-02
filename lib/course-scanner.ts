import fs from "node:fs/promises";
import path from "node:path";
import type { Course, Lesson, Module } from "@/types";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".html", ".htm"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const DOCUMENT_EXTENSIONS = new Set([".doc", ".docx", ".rtf"]);
const QUIZ_HINTS = ["quiz", "exam", "test", "assessment", "exercise", "assignment", "homework"];

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

async function findContentFilesRecursively(dirPath: string): Promise<string[]> {
  const entries = await safeReadDir(dirPath);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isSymbolicLink()) {
        return [];
      }

      if (entry.isDirectory()) {
        return findContentFilesRecursively(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (
        VIDEO_EXTENSIONS.has(ext) ||
        AUDIO_EXTENSIONS.has(ext) ||
        TEXT_EXTENSIONS.has(ext) ||
        PDF_EXTENSIONS.has(ext) ||
        DOCUMENT_EXTENSIONS.has(ext)
      ) {
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

export async function scanCourses(coursesRootPath: string): Promise<Course[]> {
  const courseEntries = await safeReadDir(coursesRootPath);

  const courses: Course[] = [];

  for (const courseEntry of courseEntries) {
    if (!courseEntry.isDirectory() || courseEntry.isSymbolicLink()) {
      continue;
    }

    const coursePath = path.join(coursesRootPath, courseEntry.name);
    const moduleEntries = await safeReadDir(coursePath);

    const modules: Module[] = [];

    for (const moduleEntry of moduleEntries) {
      if (!moduleEntry.isDirectory() || moduleEntry.isSymbolicLink()) {
        continue;
      }

      const modulePath = path.join(coursePath, moduleEntry.name);
      const lessonContentFiles = await findContentFilesRecursively(modulePath);

      const lessons: Lesson[] = lessonContentFiles
        .sort((a, b) => a.localeCompare(b))
        .map((filePath) => {
          const relativePath = path.relative(coursesRootPath, filePath).replace(/\\/g, "/");
          const fileName = path.basename(filePath);
          const extension = path.extname(fileName).toLowerCase();

          return {
            id: toId(relativePath),
            title: toTitle(fileName),
            contentPath: relativePath,
            mediaType: toMediaType(fileName),
            fileExtension: extension,
          };
        });

      modules.push({
        id: toId(`${courseEntry.name}-${moduleEntry.name}`),
        name: moduleEntry.name,
        lessons,
      });
    }

    courses.push({
      id: toId(courseEntry.name),
      name: courseEntry.name,
      modules,
    });
  }

  return courses.sort((a, b) => a.name.localeCompare(b.name));
}
