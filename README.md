# SB-688 Sovereign Alignment Kernel

<p align="center">
  <img src="./logo-banner.svg" alt="Jay's Graphic Arts" width="600"/>
</p>

> **Resilience-first AI alignment protocol.**
> Break it. Heal it. Prove it.

---

## What Is SB-688?

SB-688 is a resilience protocol that embeds governance, verification,
and autonomous recovery directly into the AI execution model.

It survives **99.8% corruption** and recovers to **100% health**
with zero data loss — autonomously, in under 2 seconds.

## Core Patterns

| Pattern | Purpose |
|---|---|
| **Protected Spine** | Immutable canonical directives |
| **Brick Isolation** | 64 isolated computational units |
| **Braided Routing** | Dual-path verification |
| **VERA Gate** | Pre-commit safety verification |
| **Append-Only Ledger** | Immutable event log |
| **Cold-Stitch Recovery** | Autonomous rebuild from spine |

## Quick Start

Run the public teaser:

```bash
python public_demo/teaser_snippet.py
```

Run the full demo:

```bash
python public_demo/run_demo.py
```

## Repository Structure

```
├── public_observer/    # Observer-facing proof layer
├── public_demo/        # Sanitized demo scripts
├── docs_public/        # Public whitepapers and docs
├── kernel/             # Core engine (source-controlled)
├── nodes/              # Node network layer
├── governance/         # Governance documents
├── deploy/             # Docker deployment
├── demo/               # Browser-based live resilience demo
└── tests/              # Test suite
```

## Documentation

- [Observer Mode](public_observer/README.md)
- [Architecture Overview](public_observer/architecture_overview.md)
- [Resilience Proof](public_observer/resilience_proof.md)
- [Whitepaper](docs_public/WHITEPAPER.md)
- [Code of Conduct](docs_public/CODE_OF_CONDUCT.md)
- [Functional Runtime](README_FUNCTIONAL.md)

## Kernel Documents
- [Protected Spine](kernel/SB688_KERNEL.md)
- [Implementation Guide](kernel/IMPLEMENTATION_GUIDE.md)
- [Kernel Manifest](kernel/KERNEL_MANIFEST.json)
- [Constitution](governance/CONSTITUTION.md)
- [VERA Protocol](governance/VERA_PROTOCOL.md)
- [Ledger Protocol](governance/LEDGER_PROTOCOL.md)
- [Healing Loop](governance/HEALING_LOOP.md)

## Live Demo
- [SB-688 Live Resilience Demo](demo/index.html)
- [Demo Usage Guide](demo/README.md)

## Proof of Concept

The system demonstrates:
- ✅ 99.8% corruption survival
- ✅ Autonomous healing from protected spine
- ✅ Zero data loss after recovery
- ✅ Append-only ledger with chain verification
- ✅ Multi-node distributed healing
- ✅ VERA gate enforcement

---

<p align="center">
  <strong>SB-688 — Sovereign Alignment Kernel</strong><br/>
  <em>Jay's Graphic Arts / National Resilience Council</em>
</p>

<p align="center">
  <img src="./demo/logo.svg" alt="JGA Logo" width="100"/>
</p>
