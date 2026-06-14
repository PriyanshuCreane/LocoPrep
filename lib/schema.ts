import { bigint, boolean, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const lessonsProgress = pgTable(
  "lessons_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    courseId: text("course_id").notNull(),
    lastWatchedTime: integer("last_watched_time").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    xpEarned: integer("xp_earned").notNull().default(0),
    lastUpdated: text("last_updated").notNull(),
  },
  (table) => ({
    userLessonUnique: uniqueIndex("lessons_progress_user_lesson_unique").on(table.userId, table.lessonId),
  }),
);

export const streaksTable = pgTable("streaks", {
  id: serial("id").primaryKey(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCompletionDate: text("last_completion_date"),
  lastUpdated: text("last_updated").notNull(),
});

export const userStreaksTable = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCompletionDate: text("last_completion_date"),
  lastUpdated: text("last_updated").notNull(),
});

export const authRateLimitsTable = pgTable("auth_rate_limits", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  resetAt: bigint("reset_at", { mode: "number" }).notNull(),
  lastUpdated: text("last_updated").notNull(),
});

export const authLoginLocksTable = pgTable("auth_login_locks", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: bigint("locked_until", { mode: "number" }).notNull().default(0),
  lastUpdated: text("last_updated").notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type LessonProgress = typeof lessonsProgress.$inferSelect;
export type InsertLessonProgress = typeof lessonsProgress.$inferInsert;
export type Streak = typeof streaksTable.$inferSelect;
export type InsertStreak = typeof streaksTable.$inferInsert;
export type UserStreak = typeof userStreaksTable.$inferSelect;
export type InsertUserStreak = typeof userStreaksTable.$inferInsert;
export type AuthRateLimit = typeof authRateLimitsTable.$inferSelect;
export type InsertAuthRateLimit = typeof authRateLimitsTable.$inferInsert;
export type AuthLoginLock = typeof authLoginLocksTable.$inferSelect;
export type InsertAuthLoginLock = typeof authLoginLocksTable.$inferInsert;
