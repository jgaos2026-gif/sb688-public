# Contributing

Thank you for considering a contribution to SB689 OMEGA.

## Before you start

- Read [docs/GOVERNANCE.md](docs/GOVERNANCE.md). Most changes are
  Class B (behavioral) or Class C (editorial). Class A
  (protocol-touching) changes require the Architect.
- Read [docs/SECURITY.md](docs/SECURITY.md). Do **not** file public
  issues for vulnerabilities.

## Workflow

1. Fork the repository.
2. Create a topic branch: `feat/<short-name>` or `fix/<short-name>`.
3. Run the build and tests locally:
   ```bash
   npm install
   npm run build
   npm test
   ```
4. Open a pull request against `main`. Include:
   - The change class (A / B / C).
   - A short rationale.
   - Test additions or updates for Class A and Class B.
5. The maintainer will request a review from the relevant Brick owner.

## Code style

- TypeScript strict mode, no `any` unless justified.
- All new modules must be re-exported from `src/index.ts` only when
  they are intended to be public API.
- Public types live in `src/contracts/` or `src/omega/contracts.ts`.
- Tests use `node --test` and `node:assert/strict`.

## What is **out of scope** for public PRs

The following are proprietary to John Arenz and will not be merged
through public PRs:

- Production brain content, prompts, or model weights.
- Production cryptographic schemes, signing keys, or HSM/KMS bindings.
- Customer-specific Sovereign Stitch deployments.
- Anything labeled "PRIVATE" in the repository or marked
  `export-ignore` in `.gitattributes`.

If your contribution touches one of these areas, contact the
Architect first.
