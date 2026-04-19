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
1. Load `examples/sb688_system_prompt.txt` as your system prompt.
2. Apply dual-path verification (`examples/dual_path_verification.py`).
3. Gate major decisions with VERA (`examples/vera_gate.py`).
4. Log material changes to append-only ledger (`examples/ledger_client.py`).
5. Run healing loop when drift appears (`examples/healing_loop.py`).
6. Share a 10-second teaser (`python examples/teaser_snippet.py`).

## Kernel Documents
- [Protected Spine](kernel/SB688_KERNEL.md)
- [Implementation Guide](kernel/IMPLEMENTATION_GUIDE.md)
- [Kernel Manifest](kernel/KERNEL_MANIFEST.json)
- [Constitution](governance/CONSTITUTION.md)
- [VERA Protocol](governance/VERA_PROTOCOL.md)
- [Ledger Protocol](governance/LEDGER_PROTOCOL.md)
- [Healing Loop](governance/HEALING_LOOP.md)
