# LocoPrep Release Readiness Checklist

Date: 2026-04-01

## Overall Result

- Status: **PASS (with documented operational risks)**
- Critical gates (`lint`, `build`, auth routes, protected route authz, progress/settings regression) passed.

## Gate Results

### 1) Static Quality

- [x] `npm run lint`
- Result: PASS

### 2) Production Build

- [x] `AUTH_SECRET=... npm run build`
- Result: PASS
- Notes: Next.js build completed including type checks and route generation.

### 3) Protected Route Authorization (Unauthenticated)

Validated all return `401` without session cookie:

- [x] `GET /api/settings`
- [x] `GET /api/browse`
- [x] `GET /api/courses`
- [x] `GET /api/files/test`
- [x] `GET /api/video/test`
- [x] `GET /api/pdf/test`
- [x] `GET /api/progress?lessonId=test-lesson`
- [x] `GET /api/progress/recent`
- [x] `GET /api/stats`

Result: PASS

### 4) Auth Cookie Security Checks

Checked `Set-Cookie` from signup on production server:

- [x] `Secure` present
- [x] `HttpOnly` present
- [x] `SameSite=lax` present
- [x] `Path=/` present

Result: PASS

### 5) Auth + Core Regression Flow

#### A) Production-mode server over plain HTTP (`AUTH_COOKIE_SECURE_MODE=auto`)

- Signup succeeded.
- Session-protected follow-up calls failed with `401` because secure cookie is not sent over plain HTTP.

Result: **EXPECTED BEHAVIOR** (not a code failure)

#### B) Functional flow validation in HTTP test mode (`AUTH_COOKIE_SECURE_MODE=never`)

- [x] Signup
- [x] `GET /api/auth/me` after signup
- [x] `GET /api/settings` authenticated
- [x] `POST /api/settings` authenticated
- [x] `POST /api/progress` save
- [x] `GET /api/progress?lessonId=...` read back
- [x] `POST /api/lessons/complete`
- [x] `GET /api/progress/recent`
- [x] Logout
- [x] `GET /api/auth/me` after logout returns `401`

Result: PASS (10/10)

## Remaining Risks

1. HTTPS dependency in production auth flow:
   - With secure cookies enabled (default production behavior), session cookies will not round-trip on plain HTTP.
   - Mitigation: deploy behind HTTPS (or trusted TLS-terminating proxy with `TRUST_PROXY_HEADERS=true`).

2. SQLite topology limits:
   - Current production architecture is single-node SQLite.
   - Multi-replica deployments require shared DB strategy (or migration to Postgres path documented in `STORAGE_PLAN.md`).

3. Operational verification still recommended per environment:
   - Run one post-deploy smoke test on real HTTPS endpoint to confirm proxy/header/cookie behavior in that environment.

## Release Decision

- Recommended: **GO** for single-node HTTPS deployments with documented env config.
- Conditional: if deployment is HTTP-only or multi-node with local disks, resolve risks above before release.

## Final Quick Checklist (Go/No-Go)

Run this checklist just before release:

- [ ] `npm ci` completed without errors.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `.env.local` (or production env) includes a non-placeholder `AUTH_SECRET`.
- [ ] Login works and `/api/auth/me` returns authenticated user.
- [ ] Settings save works and `COURSES_ROOT_PATH` points to a readable directory.
- [ ] Dashboard shows courses from the configured path.
- [ ] A lesson opens and media loads (video/audio/pdf/document).
- [ ] Progress save works (`/api/progress`) and resume/recent lesson works.
- [ ] Logout clears session and protected endpoints return `401`.
- [ ] SQLite files (`locoprep.db`, `locoprep.config.json`) are backed up or persisted.
- [ ] Production is served behind HTTPS (or trusted proxy with secure cookie config).

If all are checked: **Ready to release**.
