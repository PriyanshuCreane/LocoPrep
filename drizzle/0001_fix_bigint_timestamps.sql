ALTER TABLE "auth_login_locks" ALTER COLUMN "locked_until" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ALTER COLUMN "reset_at" SET DATA TYPE bigint;