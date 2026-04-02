# LocoPrep

Local-first, self-hosted learning platform for offline course archives.

## Features

- Multi-format lesson discovery: video, audio, text/html, pdf, doc/docx/rtf.
- Per-user signup/login with isolated progress and streak data.
- Resume from recent lesson and track completion/XP/streaks.
- Directory browser to choose course root paths from UI.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Run

```bash
npm install
npm run build
npm run start
```

## Docker Run

This project is set up for a single Docker container with persistent storage for SQLite and config files.

```bash
docker compose up -d --build
```

Default mounted paths in the container:

- database: `/data/locoprep.db`
- config: `/data/locoprep.config.json`

The app’s Settings page includes a directory browser. On Windows, it starts at your drives, so you can choose any folder on your machine without copying files into the project.

## Production Checklist

### 1) Environment

Create `.env.local` (or copy from `.env.example`) with:

```env
AUTH_SECRET=replace-with-a-long-random-secret
# Optional: if not set, app uses locoprep.config.json value
COURSES_ROOT_PATH=D:/Courses
# Optional: auto | always | never (default: auto)
AUTH_COOKIE_SECURE_MODE=auto
# Optional: true to trust X-Forwarded-Proto from a trusted reverse proxy
TRUST_PROXY_HEADERS=true
```

`AUTH_SECRET` is mandatory. The app will fail fast with a clear error if it is missing.

Checklist:

- Set strong `AUTH_SECRET` in every environment.
- Confirm `COURSES_ROOT_PATH` points to readable course storage.
- Ensure Node version supports Next.js 15 runtime.
- For Docker, keep `locoprep.db` and `locoprep.config.json` on persistent mounted storage.

### 2) Data & Storage

LocoPrep stores:

- app DB: `locoprep.db`
- app config: `locoprep.config.json`

Storage architecture decision: **SQLite single-node (Option A)**.

For deployment constraints, backup/restore runbook, and migration notes, see [STORAGE_PLAN.md](./STORAGE_PLAN.md).

On startup, the app automatically migrates legacy progress rows from scoped `lesson_id` values (for example `12::lesson-abc`) to relational columns:

- `user_id = 12`
- `lesson_id = lesson-abc`

Rows without a scoped prefix are migrated to `user_id = 0` as a legacy fallback.

### 3) Backup

PowerShell example:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item .\locoprep.db ".\backups\locoprep-$ts.db"
Copy-Item .\locoprep.config.json ".\backups\locoprep-config-$ts.json" -ErrorAction SilentlyContinue
```

### 4) Restore

PowerShell example:

```powershell
# Stop app first
Copy-Item .\backups\locoprep-YYYYMMDD-HHMMSS.db .\locoprep.db -Force
Copy-Item .\backups\locoprep-config-YYYYMMDD-HHMMSS.json .\locoprep.config.json -Force
```

Then restart:

```bash
npm run start
```

### 5) Health Check

Endpoint:

```text
GET /api/health
```

Expected response:

```json
{ "status": "healthy" }
```

### 6) Security Hardening Notes

- Login and signup endpoints include request rate limiting.
- Login includes account lockout after repeated failures.
- Rate-limit and lockout state are persisted in DB tables (`auth_rate_limits`, `auth_login_locks`) so protections survive process restarts and work across app instances sharing the same database.
- Session cookie remains `httpOnly`, `sameSite=lax`, and `path=/`.
- Secure cookie behavior is proxy-aware and configurable (`AUTH_COOKIE_SECURE_MODE`, `TRUST_PROXY_HEADERS`) so HTTPS deployments behind reverse proxies still set secure cookies correctly.
End of production checklist.
