import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authLoginLocksTable, authRateLimitsTable } from "@/lib/schema";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_LOGIN = 30;
const RATE_LIMIT_SIGNUP = 20;
const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }

  return "unknown-ip";
}

async function checkRateWindow(key: string, limit: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const rows = await db
    .select()
    .from(authRateLimitsTable)
    .where(eq(authRateLimitsTable.key, key))
    .limit(1);
  const existing = rows[0] ?? null;

  if (!existing || existing.resetAt <= now) {
    await db
      .insert(authRateLimitsTable)
      .values({
        key,
        count: 1,
        resetAt: now + RATE_WINDOW_MS,
        lastUpdated: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: authRateLimitsTable.key,
        set: {
          count: 1,
          resetAt: now + RATE_WINDOW_MS,
          lastUpdated: new Date().toISOString(),
        },
      });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  await db
    .update(authRateLimitsTable)
    .set({
      count: existing.count + 1,
      lastUpdated: new Date().toISOString(),
    })
    .where(and(eq(authRateLimitsTable.key, key), eq(authRateLimitsTable.resetAt, existing.resetAt)));

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkLoginRateLimit(request: NextRequest): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const ip = getClientIp(request);
  return checkRateWindow(`login:${ip}`, RATE_LIMIT_LOGIN);
}

export async function checkSignupRateLimit(request: NextRequest): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const ip = getClientIp(request);
  return checkRateWindow(`signup:${ip}`, RATE_LIMIT_SIGNUP);
}

export async function getLoginLockStatus(email: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const key = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(authLoginLocksTable)
    .where(eq(authLoginLocksTable.email, key))
    .limit(1);
  const entry = rows[0] ?? null;
  const now = Date.now();

  if (!entry) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  if (entry.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
    };
  }

  await db.delete(authLoginLocksTable).where(eq(authLoginLocksTable.email, key));
  return { locked: false, retryAfterSeconds: 0 };
}

export async function registerFailedLoginAttempt(email: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const rows = await db
    .select()
    .from(authLoginLocksTable)
    .where(eq(authLoginLocksTable.email, key))
    .limit(1);
  const current = rows[0] ?? null;

  const failedAttempts = (current?.failedAttempts ?? 0) + 1;
  const isLocked = failedAttempts >= LOCKOUT_AFTER_FAILURES;

  await db
    .insert(authLoginLocksTable)
    .values({
      email: key,
      failedAttempts: isLocked ? 0 : failedAttempts,
      lockedUntil: isLocked ? now + LOCKOUT_MS : 0,
      lastUpdated: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: authLoginLocksTable.email,
      set: {
        failedAttempts: isLocked ? 0 : failedAttempts,
        lockedUntil: isLocked ? now + LOCKOUT_MS : 0,
        lastUpdated: new Date().toISOString(),
      },
    });

  return {
    locked: isLocked,
    retryAfterSeconds: isLocked ? Math.ceil(LOCKOUT_MS / 1000) : 0,
  };
}

export async function clearLoginFailures(email: string): Promise<void> {
  await db
    .delete(authLoginLocksTable)
    .where(eq(authLoginLocksTable.email, email.trim().toLowerCase()));
}
