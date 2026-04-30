# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

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
