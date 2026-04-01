import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { lessonsProgress, userStreaksTable } from "./schema";

export type LessonProgressData = {
  lessonId: string;
  courseId: string;
  lastWatchedTime: number;
  completed: boolean;
  xpEarned: number;
};

export async function getLessonProgress(userId: number, lessonId: string): Promise<LessonProgressData | null> {
  const result = await db
    .select()
    .from(lessonsProgress)
    .where(and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.lessonId, lessonId)))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    lessonId: row.lessonId,
    courseId: row.courseId,
    lastWatchedTime: row.lastWatchedTime,
    completed: row.completed,
    xpEarned: row.xpEarned,
  };
}

export async function saveLessonProgress(input: {
  userId: number;
  lessonId: string;
  courseId: string;
  lastWatchedTime: number;
  completed: boolean;
}): Promise<LessonProgressData> {
  const existing = await getLessonProgress(input.userId, input.lessonId);

  const xpEarned = existing?.xpEarned ?? 0;
  const newXp = input.completed && !existing?.completed ? 100 : xpEarned;
  const boundedTime = Math.max(0, input.lastWatchedTime);

  if (existing) {
    await db
      .update(lessonsProgress)
      .set({
        lastWatchedTime: boundedTime,
        completed: input.completed,
        xpEarned: newXp,
        lastUpdated: new Date().toISOString(),
      })
      .where(and(eq(lessonsProgress.userId, input.userId), eq(lessonsProgress.lessonId, input.lessonId)));
  } else {
    await db.insert(lessonsProgress).values({
      userId: input.userId,
      lessonId: input.lessonId,
      courseId: input.courseId,
      lastWatchedTime: boundedTime,
      completed: input.completed,
      xpEarned: newXp,
      lastUpdated: new Date().toISOString(),
    });
  }

  return {
    lessonId: input.lessonId,
    courseId: input.courseId,
    lastWatchedTime: boundedTime,
    completed: input.completed,
    xpEarned: newXp,
  };
}

export async function getCourseProgress(courseId: string): Promise<{
  totalLessons: number;
  completedLessons: number;
  totalXp: number;
}> {
  return getCourseProgressForUser(0, courseId);
}

export async function getCourseProgressForUser(userId: number, courseId: string): Promise<{
  totalLessons: number;
  completedLessons: number;
  totalXp: number;
}> {
  const rows = await db
    .select()
    .from(lessonsProgress)
    .where(and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.courseId, courseId)));

  const completedLessons = rows.filter((row) => row.completed).length;
  const totalXp = rows.reduce((sum, row) => sum + row.xpEarned, 0);

  return {
    totalLessons: rows.length,
    completedLessons,
    totalXp,
  };
}

export async function getCourseLessonProgressForUser(userId: number, courseId: string): Promise<{
  totalLessons: number;
  completedLessons: number;
  totalXp: number;
  completedLessonIds: string[];
  lastActiveLessonId: string | null;
}> {
  const rows = await db
    .select()
    .from(lessonsProgress)
    .where(and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.courseId, courseId)));

  const completedLessonIds = rows
    .filter((row) => row.completed)
    .map((row) => row.lessonId);

  const sortedByRecent = [...rows].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  );

  const lastActiveLessonId = sortedByRecent.length > 0 ? sortedByRecent[0].lessonId : null;

  return {
    totalLessons: rows.length,
    completedLessons: completedLessonIds.length,
    totalXp: rows.reduce((sum, row) => sum + row.xpEarned, 0),
    completedLessonIds,
    lastActiveLessonId,
  };
}

export async function resetCourseProgressForUser(userId: number, courseId: string): Promise<number> {
  const targetRows = await db
    .select({ id: lessonsProgress.id })
    .from(lessonsProgress)
    .where(and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.courseId, courseId)));

  if (targetRows.length === 0) {
    return 0;
  }

  await db
    .delete(lessonsProgress)
    .where(and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.courseId, courseId)));

  return targetRows.length;
}

export async function getGlobalStats(): Promise<{
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  nextLevelXp: number;
}> {
  return getGlobalStatsForUser(0);
}

export async function getGlobalStatsForUser(userId: number): Promise<{
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  nextLevelXp: number;
}> {
  const rows = await db
    .select()
    .from(lessonsProgress)
    .where(eq(lessonsProgress.userId, userId));
  const totalXp = rows.reduce((sum, row) => sum + row.xpEarned, 0);
  const level = Math.floor(totalXp / 1000) + 1;
  const nextLevelXp = (level * 1000) - totalXp;

  const streakRows = await db
    .select()
    .from(userStreaksTable)
    .where(eq(userStreaksTable.userId, userId))
    .limit(1);
  const streakData = streakRows[0] ?? null;

  return {
    totalXp,
    currentStreak: streakData?.currentStreak ?? 0,
    longestStreak: streakData?.longestStreak ?? 0,
    level,
    nextLevelXp: Math.max(0, nextLevelXp),
  };
}

export async function updateStreak(): Promise<{
  currentStreak: number;
  longestStreak: number;
}> {
  return updateStreakForUser(0);
}

export async function updateStreakForUser(userId: number): Promise<{
  currentStreak: number;
  longestStreak: number;
}> {
  const today = new Date().toISOString().split("T")[0];

  const streakRows = await db
    .select()
    .from(userStreaksTable)
    .where(eq(userStreaksTable.userId, userId))
    .limit(1);
  const streakData = streakRows[0];

  if (!streakData) {
    await db.insert(userStreaksTable).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastCompletionDate: today,
      lastUpdated: new Date().toISOString(),
    });
    return { currentStreak: 1, longestStreak: 1 };
  }

  const lastDate = streakData.lastCompletionDate;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = streakData.currentStreak;
  if (lastDate !== today) {
    if (lastDate === yesterdayStr) {
      newStreak = streakData.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  }

  const newLongest = Math.max(newStreak, streakData.longestStreak);

  await db
    .update(userStreaksTable)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastCompletionDate: today,
      lastUpdated: new Date().toISOString(),
    })
    .where(eq(userStreaksTable.id, streakData.id));

  return { currentStreak: newStreak, longestStreak: newLongest };
}

export async function getMostRecentLessonForUser(userId: number): Promise<{
  lessonId: string;
  courseId: string;
  lastWatchedTime: number;
  completed: boolean;
  lastUpdated: string;
} | null> {
  const rows = await db
    .select()
    .from(lessonsProgress)
    .where(eq(lessonsProgress.userId, userId));

  if (rows.length === 0) {
    return null;
  }

  const sorted = rows.sort((a, b) =>
    new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  );
  const row = sorted[0];

  return {
    lessonId: row.lessonId,
    courseId: row.courseId,
    lastWatchedTime: row.lastWatchedTime,
    completed: row.completed,
    lastUpdated: row.lastUpdated,
  };
}
