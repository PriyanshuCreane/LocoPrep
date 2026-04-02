import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const DEFAULT_DB_PATH = "locoprep.db";
const DB_PATH = (process.env.LOCOPREP_DB_PATH ?? DEFAULT_DB_PATH).trim() || DEFAULT_DB_PATH;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

sqlite.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS lessons_progress (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		lesson_id TEXT NOT NULL,
		course_id TEXT NOT NULL,
		last_watched_time INTEGER NOT NULL DEFAULT 0,
		completed INTEGER NOT NULL DEFAULT 0,
		xp_earned INTEGER NOT NULL DEFAULT 0,
		last_updated TEXT NOT NULL,
		UNIQUE(user_id, lesson_id)
	);

	CREATE TABLE IF NOT EXISTS streaks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		current_streak INTEGER NOT NULL DEFAULT 0,
		longest_streak INTEGER NOT NULL DEFAULT 0,
		last_completion_date TEXT,
		last_updated TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_streaks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL UNIQUE,
		current_streak INTEGER NOT NULL DEFAULT 0,
		longest_streak INTEGER NOT NULL DEFAULT 0,
		last_completion_date TEXT,
		last_updated TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS auth_rate_limits (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key TEXT NOT NULL UNIQUE,
		count INTEGER NOT NULL DEFAULT 0,
		reset_at INTEGER NOT NULL,
		last_updated TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS auth_login_locks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		failed_attempts INTEGER NOT NULL DEFAULT 0,
		locked_until INTEGER NOT NULL DEFAULT 0,
		last_updated TEXT NOT NULL
	);
`);

function getTableColumns(tableName: string): string[] {
	const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
	return rows.map((row) => row.name);
}

function migrateLessonsProgressSchema(): void {
	const columns = getTableColumns("lessons_progress");
	const hasUserId = columns.includes("user_id");

	if (hasUserId) {
		return;
	}

	sqlite.exec("BEGIN");
	try {
		sqlite.exec(`
			CREATE TABLE lessons_progress_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				lesson_id TEXT NOT NULL,
				course_id TEXT NOT NULL,
				last_watched_time INTEGER NOT NULL DEFAULT 0,
				completed INTEGER NOT NULL DEFAULT 0,
				xp_earned INTEGER NOT NULL DEFAULT 0,
				last_updated TEXT NOT NULL,
				UNIQUE(user_id, lesson_id)
			);
		`);

		sqlite.exec(`
			INSERT INTO lessons_progress_new (
				user_id,
				lesson_id,
				course_id,
				last_watched_time,
				completed,
				xp_earned,
				last_updated
			)
			SELECT
				CASE
					WHEN instr(lesson_id, '::') > 0
						AND substr(lesson_id, 1, instr(lesson_id, '::') - 1) GLOB '[0-9]*'
						AND length(substr(lesson_id, 1, instr(lesson_id, '::') - 1)) > 0
					THEN CAST(substr(lesson_id, 1, instr(lesson_id, '::') - 1) AS INTEGER)
					ELSE 0
				END AS user_id,
				CASE
					WHEN instr(lesson_id, '::') > 0
					THEN substr(lesson_id, instr(lesson_id, '::') + 2)
					ELSE lesson_id
				END AS lesson_id,
				course_id,
				last_watched_time,
				completed,
				xp_earned,
				last_updated
			FROM lessons_progress;
		`);

		sqlite.exec("DROP TABLE lessons_progress;");
		sqlite.exec("ALTER TABLE lessons_progress_new RENAME TO lessons_progress;");
		sqlite.exec("COMMIT");
	} catch (error) {
		sqlite.exec("ROLLBACK");
		throw error;
	}
}

migrateLessonsProgressSchema();

export const db = drizzle(sqlite);

