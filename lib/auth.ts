import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "locoprep_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type CookieSecureMode = "auto" | "always" | "never";

function getCookieSecureMode(): CookieSecureMode {
  const mode = (process.env.AUTH_COOKIE_SECURE_MODE ?? "auto").trim().toLowerCase();
  if (mode === "always" || mode === "never" || mode === "auto") {
    return mode;
  }

  return "auto";
}

function shouldTrustProxyHeaders(): boolean {
  return (process.env.TRUST_PROXY_HEADERS ?? "").trim().toLowerCase() === "true";
}

function getForwardedProto(request: NextRequest): string | null {
  const raw = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}

function getRequiredAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required but missing. Set AUTH_SECRET in your environment (for local dev, define it in .env.local).",
    );
  }

  return secret;
}

const AUTH_SECRET = getRequiredAuthSecret();

function getAuthSecret(): string {
  return AUTH_SECRET;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHash] = stored.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const hash = scryptSync(password, salt, 64).toString("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

export function createSessionCookieValue(userId: number): string {
  const expiresAt = Date.now() + (SESSION_TTL_SECONDS * 1000);
  const payload = `${userId}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function parseSessionCookieValue(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const [userIdPart, expiresAtPart, signature] = value.split(".");
  if (!userIdPart || !expiresAtPart || !signature) {
    return null;
  }

  const payload = `${userIdPart}.${expiresAtPart}`;
  const expectedSignature = sign(payload);

  const expected = Buffer.from(expectedSignature, "hex");
  const actual = Buffer.from(signature, "hex");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const userId = Number(userIdPart);
  const expiresAt = Number(expiresAtPart);

  if (!Number.isInteger(userId) || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  return userId;
}

export function getUserIdFromRequest(request: NextRequest): number | null {
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return parseSessionCookieValue(cookieValue);
}

export function shouldUseSecureCookies(request: NextRequest): boolean {
  const secureMode = getCookieSecureMode();

  if (secureMode === "always") {
    return true;
  }

  if (secureMode === "never") {
    return false;
  }

  if (request.nextUrl.protocol === "https:") {
    return true;
  }

  if (shouldTrustProxyHeaders() && getForwardedProto(request) === "https") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

export function getAuthCookieOptions(
  request: NextRequest,
  overrides?: { maxAge?: number },
): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: overrides?.maxAge ?? SESSION_TTL_SECONDS,
  };
}

export const authCookie = {
  name: AUTH_COOKIE_NAME,
  maxAge: SESSION_TTL_SECONDS,
};

