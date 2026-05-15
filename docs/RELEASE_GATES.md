# Release Gates

## Required checks for `main`

Configure branch protection for `main` to require the following checks:

- `ci / build-and-test`
- `ci / python-test`
- `triple-check / verify-three-sources`
- `heartbeat / pulse` (for manual verification and scheduled drift detection)
- `pr-checklist-gate / require-pr-checklist`
- `dependency-scan / npm-audit`
- `dependency-scan / pip-audit`
- `codeql / analyze (javascript-typescript)`
- `codeql / analyze (python)`

Also enforce:

- Require pull request before merge
- Require approvals
- Dismiss stale approvals on new commits
- Require conversation resolution
- Restrict direct pushes to `main`

## PR checklist gate

The workflow `pr-checklist-gate.yml` enforces that all required items in the PR template checklist are checked before merge.

## Reproducible release gate

CI uses `npm ci` (not fallback install) to keep deterministic dependency resolution for release candidates.
