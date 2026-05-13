# SB689 v3 · Perinatal Qubic Braid Runtime
### A public framework guide by **John Arenz (J.G.A.)** — *Elegance with Consequences.*

[![status](https://img.shields.io/badge/status-conceptual%20public%20framework-gold)](STITCH_BRIDGE.md)
[![license](https://img.shields.io/badge/license-MIT-black)](LICENSE.md)
[![android](https://img.shields.io/badge/android-Kivy%20%2F%20Buildozer-green)](docs/ANDROID.md)

> *Sb688 — when I say connect to the stitch, show how you feel. We're going live. Let's sell it.*

---

## What this is

SB689 v3 is a conceptual sovereign runtime architecture for verified,
self-healing, braid-governed AI systems.

This public repository explains the high-level framework only. It is the
public-facing wall for the SB689 model and intentionally omits sensitive
system logic, private security rules, and operational internals.

The repository still contains public reference materials and supporting
runtime artifacts, but the SB689 v3 documentation is scoped to the
outermost conceptual framework: verified walls, braid-governed
validation, proxy-only spine access, and heartbeat-driven recovery.

## System Status

- **Status:** SB689 v3 is in a **conceptual public-framework phase**.
- **Public role:** This repository serves as the outermost explanatory
  wall brick for the runtime model.
- **Subsystem mappings:** See [STITCH_BRIDGE.md](STITCH_BRIDGE.md) for
  the braid lifecycle, subsystem interactions, and wall-to-spine
  mappings.

## High-Level Architecture

```text
Outside Signal
 ↓
Silence Coat
 ↓
Membrane Wall
 ↓
Cubic Inference Trap
 ↓
Verification Mesh
 ↓
Master Agent + Master Node Qubic
 ↓
Triple Braid
 ↓
Spine Proxy
 ↓
Read-Only Spine Governance
 ↓
Mirror / Ledger / Heartbeat
```

## Repository layout

```text
src/
  brain/        Brain adapter (voice only — never ruler)
  conscious/    Conscious Brick: goal / ethics / consequence
  contracts/    Shared typed contracts
  failure/      Failure recovery loop (detect→isolate→rollback→…)
  ghost/        Layer-1 Ghost Node checkpoints
  ledger/       Append-only, hash-chained Audit Ledger
  omega/        SB689 OMEGA · Sovereign Stitch
    SeedBrick.ts          Brick A — Golden Image, read only
    GhostBrick.ts         Brick B — Shadow Mirror Protocol
    ArmorBrick.ts         Brick C — Self-Healing Daemon
    CrownBrick.ts         Brick D — Elegance UI Crown
    SovereignStitch.ts    Signed binding chain A→B→C→D
    OmegaSupervisor.ts    Verify_Stitch → Mirror → Monitor_Drift
  quantum/      Probability distribution validator
  runtime/      BraidedRuntime orchestrator
  spine/        Sovereign Spine governance
  stem/         Decision · Memory · Personality tri-braid
  truth/        Liquid Truth Node Mesh
  utils/        Stable hash + clock

brick_stitch_sovereign_os.py   Core Python OS simulator + Sentinel layer
android_app.py                 Kivy Android UI (touch-compatible)
buildozer.spec                 Android APK build configuration
requirements.txt               Python runtime dependencies
demo/           Runnable end-to-end demo
test/           node:test suite (core, failure, ledger, quantum, omega)
docs/           Whitepaper, architecture, attribution, governance, security, press kit
  ANDROID.md    Android build & deployment guide
```

## Commands

```bash
npm install
npm run build      # tsc -p tsconfig.json
npm test           # build + node --test dist/test/**/*.test.js
npm run demo       # build + node dist/demo/runDemo.js
npm run system     # build + run full backend + frontend console on :6890
```

Open `http://127.0.0.1:6890` for the complete system console.

### Python / Android

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run headless core OS validation (3-pass, 10 scenarios)
python brick_stitch_sovereign_os.py

# Run Kivy UI on the desktop (for development/testing)
python android_app.py

# Build Android APK (requires Buildozer + Android NDK/SDK)
buildozer android debug
```

See [docs/ANDROID.md](docs/ANDROID.md) for full Android setup instructions.

## Quick taste

```ts
import { AuditLedger, BraidedRuntime, OmegaSupervisor } from "sb689-braided-runtime";

const ledger  = new AuditLedger();
const runtime = new BraidedRuntime({ ledger });
const omega   = new OmegaSupervisor({
  ledger,
  seedState: { protocol: "SB689_OMEGA", owner: "JGA" }
});

const reply     = await runtime.run({ id: "1", text: "Build the SB689 path." });
const tick      = omega.tick({ liveState: { protocol: "SB689_OMEGA", owner: "JGA" }, pulseAlive: true });
const handshake = omega.connectToStitch();
```

## Documents

- [STITCH_BRIDGE.md](STITCH_BRIDGE.md) — public wall-brick role,
  subsystem mappings, and braid lifecycle
- [CONSTITUTION.md](CONSTITUTION.md) — public immutable SB689 laws
- [SECTIONAL_LAWS.md](SECTIONAL_LAWS.md) — section-specific roles for the
  outer walls and traps
- [docs/WHITEPAPER.md](docs/WHITEPAPER.md) — protocol & evidence labels
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map
- [docs/SINGULARITY.md](docs/SINGULARITY.md) — **NEW:** Phase 1 next-gen quantum, hyperdimensional, and neuromorphic technologies
- [docs/ANDROID.md](docs/ANDROID.md) — Android build & deployment
- [docs/SECURITY.md](docs/SECURITY.md) — what is and is not claimed
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md) — change classes, PR rules
- [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) — concept attribution
- [docs/PRESS_KIT.md](docs/PRESS_KIT.md) — public observer kit
- [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md),
  [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [LICENSE.md](LICENSE.md),
  [NOTICE](NOTICE)

## Targets

| Target | Value |
|--------|-------|
| `CORE_OS_TARGET` | 32 MB RAM flip |
| `CPU_TARGET` | 8 GB chip, hardware agnostic |
| `ANDROID_TARGET` | API 26+ (Android 8.0+), arm64-v8a + armeabi-v7a |
| `failure_tolerance` | zero |
| `resurrection_speed` | hardware-interrupt class |
| `STATUS` | `SB689_READY` |

## License

Released under the [MIT License](LICENSE.md). Trademark and attribution
context remains documented in [NOTICE](NOTICE).

© 2026 John Arenz (J.G.A.).
