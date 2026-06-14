// This file is called once when the Next.js server starts (Node.js runtime only).
// It is the idiomatic place to run one-time startup tasks like DB migrations.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/db");
    await runMigrations();
  }
}
