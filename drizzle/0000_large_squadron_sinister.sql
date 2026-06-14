CREATE TABLE "auth_login_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" integer DEFAULT 0 NOT NULL,
	"last_updated" text NOT NULL,
	CONSTRAINT "auth_login_locks_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" integer NOT NULL,
	"last_updated" text NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "lessons_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lesson_id" text NOT NULL,
	"course_id" text NOT NULL,
	"last_watched_time" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"last_updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_completion_date" text,
	"last_updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_completion_date" text,
	"last_updated" text NOT NULL,
	CONSTRAINT "user_streaks_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_progress_user_lesson_unique" ON "lessons_progress" USING btree ("user_id","lesson_id");