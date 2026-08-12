# SB689 Braided Runtime

> **"Verification Before Trust."**

A fully autonomous, scalable, and secure TypeScript runtime prototype that merges
**SB688 Verification Law**, **SB689 OMEGA Sovereign Stitch**, and a braided-execution
governance model into a single cohesive operating framework.

[![Version](https://img.shields.io/badge/version-1.1.1-blue)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [Features](#features)
- [Repository Structure](#repository-structure)
- [The Oasis — Clip Brick Deployments](#the-oasis--clip-brick-deployments)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The SB689 Braided Runtime provides an enterprise-grade foundation for ethical automation.
It enforces a **triple-braid verification** model: no data enters the trusted chain until
it has converged across three independent verification paths without contradiction. The
system is governed by an immutable **Spine Proxy** layer — nothing touches the spine
directly, only verified proxy commands relayed through the braid.

---

## Core Architecture

| Layer | Module | Responsibility |
|-------|--------|----------------|
| **Verification** | SB688 | Strict data validity and compliance law enforcement |
| **Sovereign Stitch** | SB689 OMEGA | Ghost-mirror resilience, drift detection, pointer-flip recovery |
| **Runtime** | Spine / Brain / Triad | Braided execution cycles across business and system operations |
| **Governance** | Constitution / Contracts | Immutable laws and sectional policy envelopes |
| **Observability** | Audit Ledger / Evidence | Cryptographically traceable proof chain |
| **Resilience** | Phoenix / Watchdog | Checkpoint recovery and live health monitoring |

### SB689 OMEGA — Sovereign Stitch Bricks

| Brick | Role |
|-------|------|
| **SeedBrick (A)** | Golden Image — read-only, checksum-locked, deep-frozen baseline |
| **GhostBrick (B)** | Shadow Mirror Protocol — atomic clone ring with pointer-flip handle |
| **ArmorBrick (C)** | Self-Healing Daemon — drift and pulse breach detection |
| **CrownBrick (D)** | Elegance UI signal — Green / Gold / Red status reporting |

---

## Features

- **Triple-Braid Verification** — data is admitted only after three independent paths converge.
- **Spine Proxy Intermediary** — no external actor may touch the spine directly.
- **Sovereign Stitch Resilience** — ghost-mirror resurrection rolls back tampered state to the last
  sealed seed before any unauthorized frame re-enters the trusted chain.
- **Audit Ledger** — append-only, cryptographically traceable event record.
- **Phoenix System** — controlled checkpoint recovery with rollback safety.
- **Quarantine System** — failed or unauthorized processes are isolated without halting operations.
- **Clip Brick Modular Deployment** — enterprise and satellite offices connect as discrete bricks,
  each independently operable yet stitched into the shared governance layer.

---

## Repository Structure

```
sb688-public/
├── src/
│   ├── agent/          # Agent execution layer
│   ├── brain/          # Central decision and routing logic
│   ├── conscious/      # Awareness and introspection modules
│   ├── contracts/      # Policy contract definitions
│   ├── evidence/       # Evidence collection and submission
│   ├── failure/        # Failure classification and handling
│   ├── ghost/          # Ghost-mirror and shadow protocol
│   ├── ledger/         # Audit ledger — append-only event store
│   ├── omega/          # SB689 OMEGA Sovereign Stitch (Seed/Ghost/Armor/Crown bricks)
│   ├── paired/         # Paired-verification helpers
│   ├── phoenix/        # Checkpoint recovery system
│   ├── physics/        # Constraint and law engine
│   ├── quantum/        # Quantum-mode execution paths
│   ├── runtime/        # Core braided runtime orchestration
│   ├── server/         # HTTP / API surface
│   ├── spine/          # Immutable governance spine
│   ├── stem/           # Stem-cell bootstrap modules
│   ├── system/         # System-level coordination
│   ├── triad/          # Triple-braid verification engine
│   ├── trust/          # Trust scoring and propagation
│   ├── truth/          # Ground-truth arbitration
│   ├── upload/         # File ingestion and validation
│   └── utils/          # Shared utilities
├── demo/               # Runnable demonstration scenarios
├── benchmark/          # Performance benchmarks
├── test/               # Unit and integration tests
├── scripts/            # Utility and evidence-generation scripts
├── docs/               # Architecture, governance, and operational documentation
├── evidence/           # Generated evidence artifacts
├── types/              # Shared TypeScript type declarations
├── CHANGELOG.md        # Versioned change history
├── CONSTITUTION.md     # Immutable governance laws
├── CONTRIBUTING.md     # Contribution guidelines
├── SECTIONAL_LAWS.md   # Sectional policy law reference
├── STITCH_BRIDGE.md    # Stitch bridge integration notes
└── package.json
```

---

## The Oasis — Clip Brick Deployments

**The Oasis** is the modular business deployment framework built on the Clip Brick architecture.
Each business unit connects as a numbered Clip Brick, operating independently while remaining
stitched into the shared runtime and governance layer. All bricks must pass SB688 verification
before joining the stitch.

| Brick | Business | Status |
|-------|----------|--------|
| **Brick 1** | Jays Graphic Arts | ✅ Active |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **TypeScript** ≥ 7 (installed as a dev dependency)
- **Python** ≥ 3.10 *(optional — for Python utility scripts)*

### Installation

```bash
# Clone the repository
git clone https://github.com/jgaos2026-gif/sb688-public.git
cd sb688-public

# Install Node dependencies
npm install

# (Optional) Install Python dependencies
pip install -r requirements.txt
```

### Running the Demo

```bash
npm run demo
```

### Running the Full System

```bash
npm run system
```

---

## Running Tests

```bash
npm test
```

This command compiles the TypeScript source with `tsc` and then runs all test files
found in `dist/test/*.test.js` using Node's built-in test runner.

### Additional Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Build | `npm run build` | Compile TypeScript to `dist/` |
| Evidence | `npm run evidence` | Generate evidence artifacts |
| Benchmark | `npm run benchmark` | Run performance benchmarks |
| Clean | `npm run clean` | Remove `dist/` output |

---

## Documentation

Full documentation lives in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview |
| [WHITEPAPER.md](docs/WHITEPAPER.md) | Technical whitepaper |
| [SECURITY.md](docs/SECURITY.md) | Security policy and vulnerability reporting |
| [GOVERNANCE.md](docs/GOVERNANCE.md) | Governance model and decision process |
| [OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) | Operational runbook |
| [INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md) | Incident response procedures |
| [RELEASE_GATES.md](docs/RELEASE_GATES.md) | Release criteria and gate checks |

See also:
- [CONSTITUTION.md](CONSTITUTION.md) — Immutable system laws
- [SECTIONAL_LAWS.md](SECTIONAL_LAWS.md) — Sectional policy reference
- [CHANGELOG.md](CHANGELOG.md) — Version history

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
before submitting a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).

&copy; 2026 John Arenz (J.G.A.) — All rights reserved.