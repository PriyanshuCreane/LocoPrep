import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required but missing. Set DATABASE_URL in your environment (for local dev, define it in .env.local).",
	);
}

const sql = neon(databaseUrl);

export const db = drizzle(sql);

// Run migrations automatically on startup.
// Safe to call repeatedly — drizzle-kit tracks applied migrations in __drizzle_migrations table.
let migrationRan = false;

export async function runMigrations(): Promise<void> {
	if (migrationRan) return;
	migrationRan = true;

	try {
		await migrate(db, {
			migrationsFolder: path.join(process.cwd(), "drizzle"),
		});
	} catch (error) {
		console.error("[db] Migration failed:", error);
		throw error;
	}
}
