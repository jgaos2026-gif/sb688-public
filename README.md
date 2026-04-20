# SB-688 Sovereign Alignment Kernel

SB-688 is a resilience protocol, not just governance documentation.

## Core Pattern
- **Protected Spine:** canonical directives in `kernel/SB688_KERNEL.md`
- **Brick Isolation:** decomposed, isolated task units
- **Braided Routing:** work path + contradiction path
- **VERA Gate:** mandatory pre-commit verification
- **Append-Only Ledger:** no silent state mutation
- **Cold-Stitch Recovery:** rollback and rebuild from trusted spine

## Quick Start

### CLI Interface
```bash
# Run live demo
python sb688.py demo

# Run tests
python sb688.py test

# Verify system integrity
python sb688.py verify

# Run healing loop with corruption
python sb688.py heal --inject 50

# Quick teaser
python sb688.py teaser

# Show version
python sb688.py version
```

### Integration Examples
1. Load `examples/sb688_system_prompt.txt` as your system prompt.
2. Apply dual-path verification (`examples/dual_path_verification.py`).
3. Gate major decisions with VERA (`examples/vera_gate.py`).
4. Log material changes to append-only ledger (`examples/ledger_client.py`).
5. Run healing loop when drift appears (`examples/healing_loop.py`).
6. Share a 10-second teaser (`python examples/teaser_snippet.py`).

## Documentation

### Kernel Documents
- [Protected Spine](kernel/SB688_KERNEL.md) - Core mission and rules
- [Implementation Guide](kernel/IMPLEMENTATION_GUIDE.md) - How to integrate
- [Kernel Manifest](kernel/KERNEL_MANIFEST.json) - Version and metadata

### Governance
- [Constitution](governance/CONSTITUTION.md) - Supreme governing document
- [VERA Protocol](governance/VERA_PROTOCOL.md) - Verification layer spec
- [Ledger Protocol](governance/LEDGER_PROTOCOL.md) - Append-only audit trail
- [Healing Loop](governance/HEALING_LOOP.md) - Recovery procedures
- [Code of Conduct](governance/CODE_OF_CONDUCT.md) - AI behavior standards

### Guides
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Whitepaper](WHITEPAPER_SB688.md) - System architecture and goals
- [Advanced Applications](docs/ADVANCED_APPLICATIONS.md) - Revolutionary use cases

### Advanced Nodes
- [Ghost Node](nodes/ghost_node.py) - Covert operations module
- [Truth Node](nodes/truth_node.py) - Disinformation detection

## Features

✅ **Resilience**: 99.8% corruption recovery in <5ms
✅ **Verification**: VERA gate blocks unsafe operations
✅ **Auditability**: Complete append-only ledger
✅ **Isolation**: Brick-based failure containment
✅ **Recovery**: Deterministic cold-stitch healing
✅ **Testing**: Comprehensive test suite with >90% coverage
✅ **Deployment**: Single-node and multi-node Docker support
✅ **CLI**: Unified command-line interface

## Architecture

```
┌─────────────────────────────────────────┐
│       Protected Spine (Kernel)          │
│      Immutable Mission & Rules          │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼────────┐
│  Brick System  │  │  VERA Gate    │
│   Isolation    │  │ Verification  │
└───────┬────────┘  └──────┬────────┘
        │                  │
        └────────┬─────────┘
                 │
       ┌─────────▼──────────┐
       │  Append-Only       │
       │     Ledger         │
       └────────────────────┘
```
