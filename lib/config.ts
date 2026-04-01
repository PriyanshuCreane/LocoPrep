import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_FILE_PATH = path.join(process.cwd(), "locoprep.config.json");

export type AppSettings = {
  coursesRootPath: string;
  autoplayVideos: boolean;
  autoAdvanceOnEnd: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  coursesRootPath: "",
  autoplayVideos: false,
  autoAdvanceOnEnd: false,
};

async function readConfigPayload(): Promise<Partial<AppSettings>> {
  try {
    const content = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    return parsed;
  } catch {
    return {};
  }
}

export async function readAppSettingsFromConfig(): Promise<AppSettings> {
  const payload = await readConfigPayload();

  return {
    coursesRootPath: (payload.coursesRootPath ?? DEFAULT_SETTINGS.coursesRootPath).trim(),
    autoplayVideos: Boolean(payload.autoplayVideos ?? DEFAULT_SETTINGS.autoplayVideos),
    autoAdvanceOnEnd: Boolean(payload.autoAdvanceOnEnd ?? DEFAULT_SETTINGS.autoAdvanceOnEnd),
  };
}

export async function readCoursesRootPathFromConfig(): Promise<string> {
  const settings = await readAppSettingsFromConfig();
  return settings.coursesRootPath;
}

export async function writeCoursesRootPathToConfig(coursesRootPath: string): Promise<void> {
  const settings = await readAppSettingsFromConfig();
  await writeAppSettingsToConfig({ ...settings, coursesRootPath });
}

export async function writeAppSettingsToConfig(settings: AppSettings): Promise<void> {
  const payload = {
    coursesRootPath: settings.coursesRootPath.trim(),
    autoplayVideos: settings.autoplayVideos,
    autoAdvanceOnEnd: settings.autoAdvanceOnEnd,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

