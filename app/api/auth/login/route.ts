import { NextRequest, NextResponse } from "next/server";
import { authCookie, createSessionCookieValue, getAuthCookieOptions, verifyPassword } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getLoginLockStatus,
  registerFailedLoginAttempt,
} from "@/lib/auth-guard";
import { findUserByEmail } from "@/lib/users-db";

export async function POST(request: NextRequest): Promise<Response> {
  const loginRate = await checkLoginRateLimit(request);
  if (!loginRate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(loginRate.retryAfterSeconds) },
      },
    );
  }

  const body = (await request.json()) as {
    email?: unknown;
    password?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const lockStatus = await getLoginLockStatus(email);
  if (lockStatus.locked) {
    return NextResponse.json(
      { error: "Account temporarily locked due to repeated failed login attempts." },
      {
        status: 423,
        headers: { "Retry-After": String(lockStatus.retryAfterSeconds) },
      },
    );
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await registerFailedLoginAttempt(email);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await clearLoginFailures(email);
  const response = NextResponse.json({ id: user.id, email: user.email });
  response.cookies.set({
    name: authCookie.name,
    value: createSessionCookieValue(user.id),
    ...getAuthCookieOptions(request, { maxAge: authCookie.maxAge }),
  });

  return response;
}
