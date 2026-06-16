import fs from "node:fs/promises";
import path from "node:path";
import type { CourseOrganizerState } from "@/types";

const ROOT_CONFIG_FILE_PATH = path.join(process.cwd(), "locoprep.config.json");
const LEGACY_CONFIG_FILE_PATH = path.join(process.cwd(), "data", "locoprep.config.json");

export type CourseRootSetting = {
  label: string;
  path: string;
};

export type AppSettings = {
  courseRoots: CourseRootSetting[];
  courseOrganizer: CourseOrganizerState;
  autoplayVideos: boolean;
  autoAdvanceOnEnd: boolean;
  defaultPlaybackSpeed: number;
};

type ConfigPayload = Partial<AppSettings> & {
  coursesRootPath?: unknown;
};

const DEFAULT_SETTINGS: AppSettings = {
  courseRoots: [],
  courseOrganizer: {
    folders: [],
    courseFolderMap: {},
  },
  autoplayVideos: false,
  autoAdvanceOnEnd: false,
  defaultPlaybackSpeed: 1,
};

const ALLOWED_PLAYBACK_SPEEDS = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);

function sanitizeCourseRootPath(rootPath: string): string {
  return rootPath.trim();
}

function sanitizeCourseRootLabel(label: string, rootPath: string): string {
  const trimmedLabel = label.trim();

  if (trimmedLabel) {
    return trimmedLabel;
  }

  const fallbackLabel = path.basename(rootPath.trim());
  return fallbackLabel || "Courses";
}

function normalizeCourseRoots(value: unknown): CourseRootSetting[] {
  const roots: CourseRootSetting[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const candidate = item as { label?: unknown; path?: unknown };
      if (typeof candidate.path !== "string") {
        continue;
      }

      const sanitizedPath = sanitizeCourseRootPath(candidate.path);
      if (!sanitizedPath) {
        continue;
      }

      roots.push({
        path: sanitizedPath,
        label: sanitizeCourseRootLabel(typeof candidate.label === "string" ? candidate.label : "", sanitizedPath),
      });
    }
  }

  return roots;
}

function createLegacyRootEntry(rootPath: string): CourseRootSetting {
  const sanitizedPath = sanitizeCourseRootPath(rootPath);
  return {
    path: sanitizedPath,
    label: sanitizeCourseRootLabel("", sanitizedPath),
  };
}

export function normalizeCourseOrganizer(value: unknown): CourseOrganizerState {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS.courseOrganizer;
  }

  const candidate = value as {
    folders?: unknown;
    courseFolderMap?: unknown;
  };

  const folders = Array.isArray(candidate.folders)
    ? candidate.folders
        .map((folder) => {
          if (!folder || typeof folder !== "object") {
            return null;
          }

          const folderCandidate = folder as { id?: unknown; label?: unknown };
          if (typeof folderCandidate.id !== "string" || typeof folderCandidate.label !== "string") {
            return null;
          }

          const id = folderCandidate.id.trim();
          const label = folderCandidate.label.trim();

          if (!id || !label) {
            return null;
          }

          return { id, label };
        })
        .filter((folder): folder is { id: string; label: string } => folder !== null)
    : [];

  const courseFolderMap =
    candidate.courseFolderMap && typeof candidate.courseFolderMap === "object"
      ? Object.fromEntries(
          Object.entries(candidate.courseFolderMap).filter((entry): entry is [string, string] => {
            const [courseId, folderId] = entry;
            return (
              typeof courseId === "string" &&
              typeof folderId === "string" &&
              courseId.trim().length > 0 &&
              folderId.trim().length > 0
            );
          }),
        )
      : {};

  return {
    folders,
    courseFolderMap,
  };
}

async function readConfigFile(filePath: string): Promise<ConfigPayload | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as ConfigPayload;
  } catch {
    return null;
  }
}

async function readConfigPayload(): Promise<ConfigPayload> {
  const [rootPayload, legacyPayload] = await Promise.all([
    readConfigFile(ROOT_CONFIG_FILE_PATH),
    readConfigFile(LEGACY_CONFIG_FILE_PATH),
  ]);

  if (!rootPayload && !legacyPayload) {
    return {};
  }

  const rootCourseRoots = normalizeCourseRoots(rootPayload?.courseRoots);
  const legacyCourseRoots = normalizeCourseRoots(legacyPayload?.courseRoots);
  const rootLegacyCourseRootPath = typeof rootPayload?.coursesRootPath === "string" ? rootPayload.coursesRootPath : "";
  const legacyLegacyCourseRootPath = typeof legacyPayload?.coursesRootPath === "string" ? legacyPayload.coursesRootPath : "";

  const mergedRoots =
    rootCourseRoots.length > 0
      ? rootCourseRoots
      : legacyCourseRoots.length > 0
        ? legacyCourseRoots
        : rootLegacyCourseRootPath.trim()
          ? [createLegacyRootEntry(rootLegacyCourseRootPath)]
          : legacyLegacyCourseRootPath.trim()
            ? [createLegacyRootEntry(legacyLegacyCourseRootPath)]
            : [];

  return {
    courseRoots: mergedRoots,
    courseOrganizer: rootPayload?.courseOrganizer ?? legacyPayload?.courseOrganizer,
    autoplayVideos: rootPayload?.autoplayVideos ?? legacyPayload?.autoplayVideos,
    autoAdvanceOnEnd: rootPayload?.autoAdvanceOnEnd ?? legacyPayload?.autoAdvanceOnEnd,
    defaultPlaybackSpeed: rootPayload?.defaultPlaybackSpeed ?? legacyPayload?.defaultPlaybackSpeed,
  };
}

export async function readAppSettingsFromConfig(): Promise<AppSettings> {
  const payload = await readConfigPayload();
  const courseRoots = normalizeCourseRoots(payload.courseRoots);

  const rawDefaultPlaybackSpeed = typeof payload.defaultPlaybackSpeed === "number"
    ? payload.defaultPlaybackSpeed
    : DEFAULT_SETTINGS.defaultPlaybackSpeed;
  const defaultPlaybackSpeed = ALLOWED_PLAYBACK_SPEEDS.has(rawDefaultPlaybackSpeed)
    ? rawDefaultPlaybackSpeed
    : DEFAULT_SETTINGS.defaultPlaybackSpeed;

  return {
    courseRoots,
    courseOrganizer: normalizeCourseOrganizer(payload.courseOrganizer),
    autoplayVideos: Boolean(payload.autoplayVideos ?? DEFAULT_SETTINGS.autoplayVideos),
    autoAdvanceOnEnd: Boolean(payload.autoAdvanceOnEnd ?? DEFAULT_SETTINGS.autoAdvanceOnEnd),
    defaultPlaybackSpeed,
  };
}

export async function readCoursesRootPathFromConfig(): Promise<string> {
  const settings = await readAppSettingsFromConfig();
  return settings.courseRoots[0]?.path ?? "";
}

export async function readCourseRootsFromConfig(): Promise<CourseRootSetting[]> {
  const settings = await readAppSettingsFromConfig();
  return settings.courseRoots;
}

export async function resolveConfiguredCourseRootPath(requestedRootPath?: string | null): Promise<string | null> {
  const settings = await readAppSettingsFromConfig();
  const configuredRoots = settings.courseRoots;

  if (configuredRoots.length === 0) {
    return null;
  }

  if (!requestedRootPath) {
    return configuredRoots[0].path;
  }

  const resolvedRequestedPath = path.resolve(requestedRootPath.trim());
  const matchedRoot = configuredRoots.find((root) => path.resolve(root.path) === resolvedRequestedPath);

  return matchedRoot?.path ?? null;
}

export async function writeCoursesRootPathToConfig(coursesRootPath: string): Promise<void> {
  const settings = await readAppSettingsFromConfig();
  await writeAppSettingsToConfig({
    ...settings,
    courseRoots: [createLegacyRootEntry(coursesRootPath)],
  });
}

export async function writeAppSettingsToConfig(settings: AppSettings): Promise<void> {
  const sanitizedRoots = settings.courseRoots
    .map((root) => {
      const pathValue = sanitizeCourseRootPath(root.path);
      if (!pathValue) {
        return null;
      }

      return {
        path: pathValue,
        label: sanitizeCourseRootLabel(root.label, pathValue),
      };
    })
    .filter((root): root is CourseRootSetting => root !== null);

  const payload = {
    coursesRootPath: sanitizedRoots[0]?.path ?? "",
    courseRoots: sanitizedRoots,
    courseOrganizer: normalizeCourseOrganizer(settings.courseOrganizer),
    autoplayVideos: settings.autoplayVideos,
    autoAdvanceOnEnd: settings.autoAdvanceOnEnd,
    defaultPlaybackSpeed: ALLOWED_PLAYBACK_SPEEDS.has(settings.defaultPlaybackSpeed)
      ? settings.defaultPlaybackSpeed
      : DEFAULT_SETTINGS.defaultPlaybackSpeed,
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload, null, 2);
  await fs.writeFile(ROOT_CONFIG_FILE_PATH, serialized, "utf-8");

  try {
    await fs.mkdir(path.dirname(LEGACY_CONFIG_FILE_PATH), { recursive: true });
    await fs.writeFile(LEGACY_CONFIG_FILE_PATH, serialized, "utf-8");
  } catch {
    // Keep root config as source of truth even if legacy mirror write fails.
  }
}

