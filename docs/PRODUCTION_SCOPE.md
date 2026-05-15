# Production Scope

## In-scope components

Production scope for this repository includes all public deliverables:

1. TypeScript runtime and system server (`src/`, `demo/runSystem.ts`)
2. Python runtime simulator (`brick_stitch_sovereign_os.py`)
3. Android packaging path (`android_app.py`, `buildozer.spec`)
4. Governance/security/release documentation in `docs/`

## Target environments

- **Development:** local machine and PR validation
- **Staging:** production-like pre-release validation
- **Production:** hardened runtime and release artifacts

## Availability and reliability targets

- API health endpoint availability target: **99.9% monthly**
- Readiness target: only advertise ready while ledger verification is healthy and status is `SB689_READY`
- Recovery objective: preserve current architecture behavior for rapid resurrection path

## Security and compliance baseline

- Signed, tamper-evident runtime transitions
- Dependency vulnerability scanning on PR and main
- Private disclosure path for vulnerabilities (no public security issues)
- Incident response and post-incident action tracking (see `docs/INCIDENT_RESPONSE.md`)

## Out of scope

- Any private/proprietary system internals excluded by current public-repo constraints
- Compliance certification claims not independently audited
