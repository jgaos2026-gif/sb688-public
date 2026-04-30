# Governance

## Roles

| Role | Holder | Authority |
|------|--------|-----------|
| Architect & Owner | John Arenz (J.G.A.) | Final say on protocol, stitch, brand, IP. |
| Spine Maintainer | J.G.A. (delegate as needed) | Approves changes to `src/spine`, `src/omega/SovereignStitch.ts`, ledger format. |
| Truth Maintainer | J.G.A. (delegate as needed) | Approves changes to `src/truth`, `src/quantum`. |
| Brain Maintainer | J.G.A. | Approves changes to the Brain adapter contract; brain content is private. |

## Change classes

- **Class A — Protocol-touching.** Modifies Spine, Stitch signature
  shape, Ledger entry shape, or Brick boundaries. Requires the
  Architect's signature and a white-paper version bump.
- **Class B — Behavioral.** Adjusts heuristics, routing, or UI without
  changing protocol surface. Requires a Maintainer review and a passing
  test run.
- **Class C — Editorial.** Docs, formatting, comments. Single-reviewer.

## Pull-request rules

1. Every PR must reference an issue or change-class.
2. Class A and Class B PRs must include or update tests under `test/`.
3. The audit ledger format must remain append-only and hash-chained.
4. The Brain must remain adapter-only — no PR may grant the Brain
   authority over Spine, Truth, Conscious, Stem, Ledger, or Stitch.
5. No PR may weaken evidence labeling in the white paper.
6. Private files listed in `.gitignore` and `.gitattributes` (export-ignore)
   must not be added to the public repository.

## Release flow

- `main` is protected. Direct pushes are forbidden.
- Releases are tagged `vX.Y.Z` after the test suite passes and the
  white paper version matches `package.json`.
