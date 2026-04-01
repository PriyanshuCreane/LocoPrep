# LocoPrep Production Storage Plan

## Architecture Decision

Chosen path: **Option A (SQLite, single-node production)**.

Rationale:

- Current codebase already uses `better-sqlite3` + drizzle with startup migrations.
- Lowest operational complexity for self-hosted and edge-light deployments.
- Fast local reads/writes with predictable behavior for one app instance.

## Deployment Topology (Supported)

Supported topology:

- Exactly one app process/container writing to one local SQLite file (`locoprep.db`).
- Shared course storage mounted at `COURSES_ROOT_PATH`.
- Optional reverse proxy in front of the app.

Not supported for this architecture:

- Multiple app replicas writing to different local DB files.
- Ephemeral containers without persistent volume for `locoprep.db`.

## Single-Node Constraints

- SQLite is file-based; horizontal scaling with per-node local disks will diverge data.
- Durable auth throttling/lockouts are process-independent only when all traffic shares the same DB file.
- Place `locoprep.db` on persistent storage and keep one writer instance.

## Backup Strategy

Minimum baseline:

- Frequency: hourly snapshot for `locoprep.db`, daily retention for 14-30 days.
- Also back up `locoprep.config.json`.
- Store backups off-node (network storage/object storage) for host-failure recovery.

PowerShell backup example:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item .\locoprep.db ".\backups\locoprep-$ts.db"
Copy-Item .\locoprep.config.json ".\backups\locoprep-config-$ts.json" -ErrorAction SilentlyContinue
```

## Restore Procedure

1. Stop app process.
2. Restore DB and config from the same timestamp.
3. Start app and run health check (`GET /api/health`).
4. Validate login and recent progress reads.

PowerShell restore example:

```powershell
Copy-Item .\backups\locoprep-YYYYMMDD-HHMMSS.db .\locoprep.db -Force
Copy-Item .\backups\locoprep-config-YYYYMMDD-HHMMSS.json .\locoprep.config.json -Force
```

## Migration Notes (Schema)

- Startup migrations run automatically in app boot path (for example, progress schema normalization and auth guard tables).
- Always take a backup before upgrading application versions.
- Upgrade order:
  1. Backup current DB.
  2. Deploy new app version.
  3. Start app once to apply migrations.
  4. Validate health, login, and progress endpoints.

## Future Path to Postgres (When Needed)

Trigger conditions:

- Need multi-replica write scaling.
- Need managed HA/failover beyond single-node constraints.

Recommended migration sequence:

1. Add Postgres adapter and migration tooling in a feature branch.
2. Create equivalent schema and constraints in Postgres.
3. Export/import data from SQLite to Postgres.
4. Run dual-environment verification (auth, progress, settings, media APIs).
5. Cut over with rollback plan and final backup.
