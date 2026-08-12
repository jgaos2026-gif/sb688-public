# Production Verification

## Smoke verification (every release candidate)

- `npm ci`
- `npm test`
- `npm run demo`
- `python -m pytest`
- API checks:
  - `GET /api/health`
  - `GET /api/ready`
  - `GET /api/ledger`

## Failure-path / chaos verification

- Simulate drift and pulse loss paths in OMEGA and verify resurrection behavior
- Verify ledger chain integrity before and after failure/recovery scenarios

## Performance baseline

- Define baseline latency and throughput in staging
- Track regressions versus baseline before release

## Go / no-go checklist

- All required CI checks green
- No unresolved Critical/High dependency vulnerabilities
- Readiness endpoint stable in staging
- Incident-response contacts available for release window
- Rollback drill completed for target release

## Post-release verification

- Confirm health/readiness after deploy
- Confirm audit ledger integrity in production
- Confirm alerting and escalation channels are active
