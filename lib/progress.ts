import fs from "node:fs/promises";
import path from "node:path";

export type LessonProgressRecord = {
  lessonId: string;
  currentTime: number;
  completed: boolean;
  updatedAt: string;
};

type ProgressFileShape = {
  lessons: Record<string, LessonProgressRecord>;
};

const PROGRESS_FILE_PATH = path.join(process.cwd(), "locoprep.progress.json");

async function readProgressFile(): Promise<ProgressFileShape> {
  try {
    const raw = await fs.readFile(PROGRESS_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ProgressFileShape>;
    return {
      lessons: parsed.lessons ?? {},
    };
  } catch {
    return { lessons: {} };
  }
}

async function writeProgressFile(data: ProgressFileShape): Promise<void> {
  await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getLessonProgress(lessonId: string): Promise<LessonProgressRecord | null> {
  const progress = await readProgressFile();
  return progress.lessons[lessonId] ?? null;
}

export async function saveLessonProgress(input: {
  lessonId: string;
  currentTime: number;
  completed: boolean;
}): Promise<LessonProgressRecord> {
  const progress = await readProgressFile();

  const record: LessonProgressRecord = {
    lessonId: input.lessonId,
    currentTime: Math.max(0, Number.isFinite(input.currentTime) ? input.currentTime : 0),
    completed: Boolean(input.completed),
    updatedAt: new Date().toISOString(),
  };

  progress.lessons[input.lessonId] = record;
  await writeProgressFile(progress);
  return record;
}

