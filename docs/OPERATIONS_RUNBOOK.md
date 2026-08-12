# Operations Runbook

## Runtime configuration

System server reads environment-based settings:

- `SB689_ENV` = `development|staging|production`
- `SB689_HOST` (default `127.0.0.1`)
- `SB689_PORT` (default `6890`)
- `SB689_UPLOAD_MAX_BODY_BYTES` (default `11534336`)
- `SB689_GRACEFUL_SHUTDOWN_TIMEOUT_MS` (default `10000`)

## Health and readiness

- Health: `GET /api/health`
- Readiness: `GET /api/ready`
- Ledger export (NDJSON): `GET /api/ledger/export`

## Graceful shutdown

- `SIGINT` / `SIGTERM` trigger graceful close
- If close exceeds timeout, process exits with failure

## Deployment tracks

### Node runtime

1. `npm ci`
2. `npm test`
3. `npm run demo`
4. `npm run system`

### Python runtime

1. `python -m pip install -r requirements.txt pytest`
2. `python -m pytest`
3. `python brick_stitch_sovereign_os.py`

### Android packaging

1. Install Buildozer + Android SDK/NDK
2. `buildozer android debug`
3. Verify app startup + core operator flows

## Backup and restore drill

- Export ledger snapshots regularly via `/api/ledger/export`
- Verify restore by replaying snapshot into staging and checking chain integrity
- Run periodic restore drills and capture recovery times

## On-call and escalation

- Define primary/secondary ownership for production windows
- Escalate unresolved critical incidents immediately to maintainers
