# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased] — red-team round 3 (2026-11-10)

### Fixed
- **Ledger: disk before memory (finding B).** `AuditLedger.append()`
  now writes + fsyncs before publishing to the in-memory store; a
  failed write leaves memory untouched. A torn final line is
  recovered by truncation on load; a corrupt line anywhere else still
  fails closed. Every append syncs with the file under the lock:
  entries recorded by another writer are adopted, entries the file
  lost are repaired from memory, and a true fork fails closed with
  `LEDGER_DIVERGED`.
- **Ledger: multi-process single writer (finding C).** File-backed
  appends serialize through an OS-level lockfile (atomic O_EXCL,
  PID + stale-lock detection — `src/utils/fileLock.ts`). Two
  processes racing an append now produce one clean chain; a process
  that cannot get the lock fails closed with
  `LEDGER_LOCK_TIMEOUT`. Tests spawn two real processes.
- **BCT trust conditional on the durable audit commit (finding D).**
  The registered head advances only after the ledger append
  succeeds; a failed commit returns `trusted: false` (audit layer
  failed, `ledgerAppendFailed: true`) and the head does not move.
- **Rollback modes are explicit (finding E).**
  `NO_MUTABLE_PARTICIPANTS` / `RESTORE_VERIFIED` / `RESTORE_FAILED`
  (`RuntimeResponse.rollbackMode`, ledger detail, and response
  text). A run with no mutable participants never claims a verified
  restore.
- **Braid "signature" renamed to braid binding hash (finding F).**
  `BctVerificationInput.braidBindingHash`,
  `computeBraidBindingHash()` — an unkeyed SHA-256 binding, named
  honestly. No keyed signature/MAC was added: no place in
  `BctVerifier` requires issuer authentication (that lives in the
  Ed25519 permit layer).
- **Shared canonical numbers (finding G).** `stableStringify` /
  `hashOf` implement the cross-language canonical numeric form
  (integer-valued floats as exact integers, other finite floats as
  shortest-digits scientific notation) and reject NaN/Infinity with
  `CANONICAL_NUMBER_REJECTED` instead of hashing them as `null`.
  Test vectors pinned in `test/redteam-round3.test.ts`.
- **Registry validation.** `BctHeadRegistry.register()` /
  `advance()` reject anything but a well-formed `sha256:` + 64
  lowercase hex chars (and a non-empty identity) with
  `REGISTRY_REJECTED`.
- **Schema check uses `Object.hasOwn()`.** An inherited required key
  no longer satisfies `layerSchema()`.
- **Key provisioning fails visibly.** `SpineGovernor({
  requireDurableKey: true })` throws `SPINE_KEY_MISSING` at startup
  when no durable key is configured; `keyProvenance` reports
  `"durable"` vs `"ephemeral"`. `BraidedRuntime` passes
  `requireDurableSpineKey` / `permitReplayStorePath` through to its
  default governor / truth mesh.
- **Durable permit replay protection.** `LiquidTruthNodeMesh({
  replayStorePath })` persists used permit signatures (write +
  fsync, re-checked from disk) — a replay after restart is rejected.
  A failed durable record fails closed (`REPLAY_STORE_FAILED`).
- **Evidence-ledger cross-check (finding H).**
  `verifyHeadAgainstLedger()` + `InMemoryEvidenceLedger`
  (`src/truth/EvidenceLedgerCrossCheck.ts`); `BctVerifier` accepts
  an optional reader and fails the audit layer when the durable
  record disagrees. Not wired to any live Supabase project — see
  `docs/EVIDENCE_LEDGER_CROSS_CHECK.md` for the operator steps.
- **Anchored-verification arguments (checked, no hole in TS).**
  A missing identity fails layer 1 and an unregistered prior is
  rejected — anchoring cannot be silently skipped. Pinned by test.

## [1.1.1] — 2026-04-30

### Fixed
- **OmegaSupervisor resurrection pointer-flip integrity (Class B).**
  `tick()` previously mirrored the live state before drift detection
  and, on breach, passed the just-cloned (potentially tampered) frame
  as the pointer-flip target — contradicting Whitepaper §5 and
  `docs/SECURITY.md` ("Unauthorized state never re-enters the trusted
  chain"). The supervisor now captures the prior known-good shadow
  before mirroring and uses that as the resurrection target. Test
  `omega.test.ts` strengthened to assert the resurrected
  `ghostMirrorHash` equals the sealed seed checksum, not any hash of
  the tampered state.

## [1.1.0] — 2026-04-30

### Added
- **SB689 OMEGA · Sovereign Stitch** layer (`src/omega/`):
  - `SeedBrick` — Brick A, Golden Image read-only with checksum-locked
    deep-frozen state.
  - `GhostBrick` — Brick B, Shadow Mirror Protocol with bounded ring of
    atomic clones and pointer-flip handle.
  - `ArmorBrick` — Brick C, Self-Healing Daemon with drift + pulse
    breach detection.
  - `CrownBrick` — Brick D, Elegance UI signaling Green / Gold / Red.
  - `SovereignStitch` — signed binding chain `A→B→C→D` and remote
    encrypted handshake (`ON_READY` message).
  - `OmegaSupervisor` — `Verify_Stitch → Mirror_State → Monitor_Drift`
    loop with `kill → activate → re-stitch → signal` fail state and
    integration with the `AuditLedger`.
- White paper, architecture, attribution, governance, and security
  documents under `docs/`.
- Test suite for the Omega layer (`test/omega.test.ts`).
- CI workflow, contributing guide, license, and IP-protection files.

### Changed
- `BrainAdapter` relocated to `src/brain/` to match the public surface
  in `src/index.ts` and the architecture document.
- `demo/runDemo.ts` extended to demonstrate stable, drift, and
  pulse-loss cycles plus the `connectToStitch` handshake.

## [1.0.0] — 2026-04-29

### Added
- Initial SB689 Braided Runtime (Spine · Truth · Conscious · Stem ·
  Brain adapter · Ghost · Ledger) and SB688 failure recovery loop.
