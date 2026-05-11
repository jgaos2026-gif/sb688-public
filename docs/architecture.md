# Architecture — SB689 OMEGA · Sovereign Stitch (Python PC Runtime)

## Module map

```
sovereign_stitch/
├── __init__.py           Public package exports
├── seed_brick.py         BRICK_A_SEED — Golden Image, read-only
├── ghost_brick.py        BRICK_B_GHOST — Shadow Mirror Protocol
├── armor_brick.py        BRICK_C_ARMOR — Self-Healing Daemon
├── crown_brick.py        BRICK_D_CROWN — Elegance UI Crown
├── sovereign_stitch.py   Signed binding chain A→B→C→D
└── omega_supervisor.py   Verify_Stitch → Mirror_State → Monitor_Drift loop

sovereign_stitch_pc.py    PC entry-point CLI
config/
├── config.yaml           Runtime parameters
└── constitution.yaml     Immutable governing principles
scripts/
└── init.sh               One-shot environment bootstrap
tests/
├── __init__.py
└── test_sovereign_stitch.py  pytest suite (45+ assertions)
pytest.ini                pytest configuration
```

## Brick contract diagram

```
[BRICK_A_SEED]──────────────────────────────────────────┐
   Golden Image, Read Only (SHA-256 checksum-locked)     │ STITCH
   forged_at boot, never overwritten.                    │ (signed binding chain)
                                                         │
[BRICK_B_GHOST]◄────────────────────────────────────────┘
   Shadow Mirror — atomic deepcopy of live state per tick.
   Ring buffer (max_frames=8 by default).
   pointer_flip() during resurrection picks the pre-breach frame.
   ▼
[BRICK_C_ARMOR]
   drift > 0.0001 OR pulse==0  →  should_resurrect() = True
   Drift is binary (0.0 if checksum match, 1.0 if mismatch).
   ▼
[BRICK_D_CROWN]
   GREEN  — Stable (Live_Sell mode)
   GOLD   — Resurrection active (Connect_To_Stitch mode)
   RED    — Breach / stitch-signature invalid
```

## Supervisor tick sequence

```python
# OmegaSupervisor.tick(live_state, pulse_alive)

1. Verify_Stitch
   stitch.verify()   →  recompute signature off sealed seed
   FAIL → crown.red() → resurrect()

2. Mirror_State
   ghost.mirror(live_state)   ← captures BEFORE drift check
   prior_clean = ghost.latest()  ← saved as resurrection target

3. Monitor_Drift
   armor.measure(seed_checksum, live_state, pulse_alive)
   armor.should_resurrect(report)
   BREACH → resurrect(prior_clean)
   STABLE → crown.green() → status("SB689_READY")
```

## Resurrection sequence

```
kill(corrupted_brick)           # abandon live pointer
activate(ghost_shadow)          # pointer-flip to prior_clean frame
re-stitch(clean_seed)           # stitch.forge() rebuilds binding chain
signal(crown_gold_flash)        # crown.gold()
append(ResurrectionEvent)       # audit_log entry
return status("SB689_RESURRECTING")
```

## Data flow with the TypeScript layer

The Python PC runtime is a faithful port of the TypeScript `src/omega/`
modules.  The `AuditLedger` integration from the TypeScript layer is
replaced here by the in-memory `_audit_log` list; both expose the same
append-only, label + detail + timestamp contract.

## Governing constitution

`config/constitution.yaml` defines six articles (ART-001 through ART-006)
that are read-only reference truth for auditors.  The runtime never writes
to this file.
