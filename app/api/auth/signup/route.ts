import { NextRequest, NextResponse } from "next/server";
import { authCookie, createSessionCookieValue, getAuthCookieOptions, hashPassword } from "@/lib/auth";
import { checkSignupRateLimit } from "@/lib/auth-guard";
import { createUser, findUserByEmail } from "@/lib/users-db";

export async function POST(request: NextRequest): Promise<Response> {
  const signupRate = await checkSignupRateLimit(request);
  if (!signupRate.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(signupRate.retryAfterSeconds) },
      },
    );
  }

  const body = (await request.json()) as {
    email?: unknown;
    password?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  const user = await createUser(email, passwordHash);
  const response = NextResponse.json({ id: user.id, email: user.email });
  response.cookies.set({
    name: authCookie.name,
    value: createSessionCookieValue(user.id),
    ...getAuthCookieOptions(request, { maxAge: authCookie.maxAge }),
  });

  return response;
}
