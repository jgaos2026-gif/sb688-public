# Changelog — SB689 OMEGA · Sovereign Stitch (Python PC Runtime)

All notable changes to the Python PC runtime are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-05-11

### Added

- `sovereign_stitch/` Python package:
  - `SeedBrick` — Golden Image, SHA-256 checksum-locked, read-only.
  - `GhostBrick` — Shadow Mirror with bounded ring buffer (`max_frames=8`).
  - `ArmorBrick` — Drift measure + `should_resurrect()` (threshold 0.0001).
  - `CrownBrick` — GREEN / GOLD / RED signal with full trail history.
  - `SovereignStitch` — Signed binding chain A→B→C→D with `connect()` handshake.
  - `OmegaSupervisor` — `Verify_Stitch → Mirror_State → Monitor_Drift` loop with resurrection and in-memory audit log.
- `sovereign_stitch_pc.py` — PC CLI entry-point (`--cycles`, `--drift`, `--dead-pulse`, `--json`).
- `config/config.yaml` — Runtime parameters.
- `config/constitution.yaml` — Six governing articles (ART-001 through ART-006).
- `scripts/init.sh` — One-shot venv bootstrap script.
- `tests/test_sovereign_stitch.py` — 45+ pytest assertions covering all bricks, stitch, and supervisor.
- `pytest.ini` — pytest configuration.
- `docs/overview.md`, `docs/architecture.md`, `docs/getting-started.md`, `docs/contributing.md`.
- PyYAML added to `requirements.txt` for config loading.

### Notes

- Python PC runtime is a faithful port of the TypeScript `src/omega/` modules.
- No Android, Kivy, or GUI dependency required for PC use.
- All 45+ tests pass in < 1 second on Python 3.9+.
