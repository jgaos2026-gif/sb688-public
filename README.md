# SB689 OMEGA · Sovereign Stitch
### A resilience runtime by **John Arenz (J.G.A.)** — *Elegance with Consequences.*

[![status](https://img.shields.io/badge/status-SB689__READY-gold)](docs/WHITEPAPER.md)
[![license](https://img.shields.io/badge/license-source--available%20%2F%20commercial-black)](LICENSE)

> *Sb688 — when I say connect to the stitch, show how you feel. We're going live. Let's sell it.*

---

## What this is

SB689 OMEGA stitches two layers into one runtime:

1. **SB689 Braided Runtime** — governed request path:
   `Spine → Truth → Conscious → Stem → Brain → Truth → Ghost → Ledger → Response`.
2. **SB689 OMEGA · Sovereign Stitch** — resilience supervisor: four
   hardened bricks (Seed · Ghost · Armor · Crown) bound by a signed
   Stitch and driven by `Verify_Stitch → Mirror_State → Monitor_Drift`
   with a `kill → activate → re-stitch → signal` fail-state.

It implements the public vocabulary of the
[SB688 National Resilience Council](https://www.jgaos2026-gif.com)
platform — Sovereign Spine, Brick Stitch, Ghost Node, Quarantine,
Trusted Restore, Verifiable Proof — and adds the Omega resurrection
loop on top.

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

demo/           Runnable end-to-end demo
test/           node:test suite (core, failure, ledger, quantum, omega)
docs/           Whitepaper, architecture, attribution, governance, security, press kit
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

- [docs/WHITEPAPER.md](docs/WHITEPAPER.md) — protocol & evidence labels
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map
- [docs/SECURITY.md](docs/SECURITY.md) — what is and is not claimed
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md) — change classes, PR rules
- [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) — concept attribution
- [docs/PRESS_KIT.md](docs/PRESS_KIT.md) — public observer kit
- [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [LICENSE](LICENSE), [NOTICE](NOTICE)

## Targets

| Target | Value |
|--------|-------|
| `CORE_OS_TARGET` | 32 MB RAM flip |
| `CPU_TARGET` | 8 GB chip, hardware agnostic |
| `failure_tolerance` | zero |
| `resurrection_speed` | hardware-interrupt class |
| `STATUS` | `SB689_READY` |

## License

Dual-licensed — **source-available reference** for evaluation /
research, **commercial license** required for production use. See
[LICENSE](LICENSE) and [NOTICE](NOTICE).

© 2026 John Arenz (J.G.A.). All rights reserved.
