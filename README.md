# SB-688 Sovereign Alignment Kernel

<p align="center">
  <img src="./logo-banner.svg" alt="Jay's Graphic Arts" width="600"/>
</p>

<p align="center">
  <strong>Resilience-first AI alignment protocol.</strong><br/>
  <em>Break it. Heal it. Prove it.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0-gold" alt="Version 1.0"/>
  <img src="https://img.shields.io/badge/resilience-99.8%25-brightgreen" alt="99.8% Resilience"/>
  <img src="https://img.shields.io/badge/recovery-%3C2s-brightgreen" alt="Recovery < 2s"/>
  <img src="https://img.shields.io/badge/data_loss-0%25-brightgreen" alt="0% Data Loss"/>
  <img src="https://img.shields.io/badge/license-proprietary-gold" alt="Proprietary"/>
</p>

---

## Table of Contents

1. [What Is SB-688?](#what-is-sb-688)
2. [Core Patterns](#core-patterns)
3. [Proven Metrics](#proven-metrics)
4. [Quick Start](#quick-start)
5. [Repository Structure](#repository-structure)
6. [Documentation](#documentation)
7. [Kernel & Governance](#kernel--governance)
8. [Live Demo](#live-demo)
9. [Proof of Concept](#proof-of-concept)

---

## What Is SB-688?

SB-688 is a **Sovereign Alignment Kernel** — a resilience protocol that embeds
governance, verification, and autonomous recovery directly into the AI execution
model. Rather than treating these as optional documentation layers, SB-688
operationalizes them as mandatory, runtime-enforced controls.

It is designed for environments where **correctness, traceability, and controlled
autonomy** are more valuable than raw throughput.

> SB-688 survives **99.8% corruption** and recovers to **100% health**  
> with zero data loss — autonomously, in under 2 seconds.

---

## Core Patterns

| Pattern | Role | Guarantee |
|---|---|---|
| **Protected Spine** | Immutable canonical directives | Trusted state is never silently overwritten |
| **Brick Isolation** | 64 isolated computational units | Local failures cannot propagate to neighbors |
| **Braided Routing** | Dual-path work + contradiction scan | Contradictions caught before commit |
| **VERA Gate** | Pre-commit safety verification | Unsafe state changes are blocked automatically |
| **Append-Only Ledger** | Cryptographically chained event log | Complete, tamper-evident audit trail |
| **Cold-Stitch Recovery** | Autonomous rebuild from protected spine | Full recovery with no data loss |

---

## Proven Metrics

| Metric | Result |
|---|---|
| Maximum survivable corruption | **99.8%** |
| Recovery time (64 bricks) | **< 2 seconds** |
| Data loss after full recovery | **0%** |
| Ledger integrity after recovery | **100%** |
| Autonomous healing | **Yes — no manual intervention required** |
| VERA detection latency | **< 100 ms** |

---

## Quick Start

### Run the teaser (10 seconds)

```bash
python public_demo/teaser_snippet.py
```

### Run the full pipeline demo

```bash
python public_demo/run_demo.py
```

### Export proof artifacts

```bash
SB688_SENSITIVE_ACCESS_CODE=<your-code> python public_demo/run_demo.py
```

Writes `proof.json` and `proof.csv` to the working directory.

### Start the browser-based live demo

```bash
# Open in any modern browser (no server required):
open demo/index.html

# Or serve from repo root:
python -m http.server 8080
```

### Run the test suite

```bash
pip install -r tests/requirements.txt
make test
```

### Start the 5-node Docker testbed

```bash
make docker-up
curl http://localhost:5000/status
curl -X POST http://localhost:5000/corrupt
curl -X POST http://localhost:5000/heal
curl http://localhost:5000/ledger
```

---

## Repository Structure

```
sb688-public/
├── README.md                   ← This file
├── README_FUNCTIONAL.md        ← API reference and runtime guide
├── WHITEPAPER_SB688.md         ← Full technical whitepaper
├── BRANDING.md                 ← Jay's Graphic Arts brand guidelines
│
├── kernel/                     ← Core engine (source-controlled)
│   ├── SB688_KERNEL.md         ← Protected spine (supreme governing document)
│   ├── IMPLEMENTATION_GUIDE.md ← Integration reference
│   ├── KERNEL_MANIFEST.json    ← Versioning and checksum
│   ├── SB688_ENGINE.py         ← Core runtime engine
│   ├── VERA_GATE_RUNTIME.py    ← VERA verification gate
│   └── LEDGER_STORE.py         ← Append-only ledger storage
│
├── governance/                 ← Governance and protocol documents
│   ├── CONSTITUTION.md         ← Supreme governance charter
│   ├── VERA_PROTOCOL.md        ← Pre-commit verification protocol
│   ├── LEDGER_PROTOCOL.md      ← Append-only ledger protocol
│   ├── HEALING_LOOP.md         ← Cold-stitch recovery protocol
│   └── CODE_OF_CONDUCT.md      ← Contributor and AI behavior standards
│
├── nodes/                      ← Node network layer
│   ├── node.py                 ← Node implementation
│   └── brick.py                ← Brick isolation unit
│
├── public_observer/            ← Observer-facing public proof layer
│   ├── README.md               ← Observer guide
│   ├── architecture_overview.md← System architecture summary
│   └── resilience_proof.md     ← Verified resilience metrics and proof
│
├── public_demo/                ← Sanitized public demo scripts
│   ├── README.md               ← Demo guide
│   ├── run_demo.py             ← Full pipeline demo
│   └── teaser_snippet.py       ← Quick 10-second teaser
│
├── docs_public/                ← Public-facing documentation
│   ├── WHITEPAPER.md           ← Public whitepaper
│   └── CODE_OF_CONDUCT.md      ← Public code of conduct
│
├── demo/                       ← Browser-based live resilience demo
│   ├── index.html              ← Demo entry point
│   ├── README.md               ← Demo usage guide
│   └── styles.css              ← Black & gold themed UI
│
├── examples/                   ← Integration examples
│   ├── vera_gate.py            ← VERA API wrapper example
│   ├── dual_path_verification.py ← Braided routing example
│   ├── ledger_client.py        ← Ledger integration example
│   └── healing_loop.py         ← Healing loop integration example
│
├── deploy/                     ← Docker deployment
│   ├── Dockerfile              ← Container definition
│   └── docker-compose.yml      ← Multi-node orchestration
│
└── tests/                      ← Automated test suite
    ├── test_vera_gate.py
    ├── test_node_lock.py
    ├── test_braided_recovery.py
    ├── test_corruption.py
    └── test_lock_gate_cli.py
```

---

## Documentation

| Document | Description |
|---|---|
| [Observer Mode](public_observer/README.md) | Public proof-layer overview for external reviewers |
| [Architecture Overview](public_observer/architecture_overview.md) | System layers and component summary |
| [Resilience Proof](public_observer/resilience_proof.md) | Verified break/heal metrics |
| [Public Whitepaper](docs_public/WHITEPAPER.md) | Design philosophy and capabilities |
| [Code of Conduct](docs_public/CODE_OF_CONDUCT.md) | Contributor and AI behavior standards |
| [Functional Runtime Guide](README_FUNCTIONAL.md) | API reference, lock protection, and run guide |
| [Full Whitepaper](WHITEPAPER_SB688.md) | Complete technical whitepaper |

---

## Kernel & Governance

| Document | Description |
|---|---|
| [Protected Spine](kernel/SB688_KERNEL.md) | Supreme governing document — immutable directives |
| [Implementation Guide](kernel/IMPLEMENTATION_GUIDE.md) | Step-by-step kernel integration reference |
| [Kernel Manifest](kernel/KERNEL_MANIFEST.json) | Version, checksum, and usage metrics |
| [Constitution](governance/CONSTITUTION.md) | Governance charter and chain of authority |
| [VERA Protocol](governance/VERA_PROTOCOL.md) | Pre-commit verification layer specification |
| [Ledger Protocol](governance/LEDGER_PROTOCOL.md) | Append-only ledger schema and rollback procedure |
| [Healing Loop](governance/HEALING_LOOP.md) | Cold-stitch recovery protocol and telemetry |

---

## Live Demo

Open `demo/index.html` in any modern browser.

**Demo Controls:**

| Button | Action |
|---|---|
| `CORRUPT SYSTEM` | Corrupts 99.8% of bricks — health collapses to 0.2% |
| `WATCH RECOVERY` | Triggers autonomous cold-stitch recovery |
| `KILL & RESET` | Hard stop and full reset to 100% health |
| `DOWNLOAD LEDGER` | Export the full audit trail as JSON or CSV |

See [Demo README](demo/README.md) for full usage documentation.

---

## Proof of Concept

The system demonstrates end-to-end resilience under adversarial conditions:

- ✅ **99.8% corruption survival** — verified in automated tests
- ✅ **Autonomous healing** from protected spine without manual intervention
- ✅ **Zero data loss** after full recovery cycle
- ✅ **Append-only ledger** with cryptographic chain verification
- ✅ **Multi-node distributed healing** across 5-node testbed
- ✅ **VERA gate enforcement** — unsafe commits blocked and logged
- ✅ **< 100 ms detection** latency for corruption events
- ✅ **< 2 second full recovery** for 64-brick system

---

<p align="center">
  <strong>SB-688 — Sovereign Alignment Kernel</strong><br/>
  <em>Jay's Graphic Arts / National Resilience Council</em><br/>
  Resilience · Governance · Innovation
</p>

<p align="center">
  <img src="./demo/logo.svg" alt="JGA Logo" width="100"/>
</p>
