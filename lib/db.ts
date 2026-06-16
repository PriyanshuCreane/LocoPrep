import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required but missing. Set DATABASE_URL in your environment (for local dev, define it in .env.local).",
	);
}

const sql = neon(databaseUrl);

export const db = drizzle(sql);

// Resolve the drizzle/ folder relative to this file rather than process.cwd().
// This is more reliable on Vercel serverless where cwd() may differ.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_FOLDER = path.join(__dirname, "..", "drizzle");

// Run migrations automatically on startup.
// Safe to call repeatedly — drizzle-kit tracks applied migrations in __drizzle_migrations table.
let migrationRan = false;

export async function runMigrations(): Promise<void> {
	if (migrationRan) return;
	migrationRan = true;

	try {
		await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
		console.log("[db] Migrations applied successfully.");
	} catch (error) {
		// Log but don't crash the server — tables may already exist from a prior deploy.
		console.error("[db] Migration warning:", error);
	}
}
