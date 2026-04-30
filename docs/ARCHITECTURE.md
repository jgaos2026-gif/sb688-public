# Architecture — SB689 OMEGA

The runtime is composed of two cooperating layers.

## Layer 1 · SB689 Braided Runtime (governed request path)

```
User Intent → Spine → Truth Fluid → Conscious Brick → Stem (Decision/Memory/Personality)
            → Brain (adapter only) → Truth Fluid → Ghost Node → Ledger → Response
```

- **Spine** — admission control, signed permits.
- **Liquid Truth Node Mesh** — pre-brain and post-brain verification,
  with quantum-ready distribution validation for probabilistic traces.
- **Conscious Brick** — goal extraction, ethics gate, consequence review.
- **Stem Tri-Braid** — Decision · Memory · Personality routing.
- **Brain Adapter** — bound to the approved braid signature; cannot rule.
- **Ghost Node** — checkpoints verified outputs and recovered failures.
- **Audit Ledger** — append-only, hash-chained transition record.
- **Failure Manager** — `detect → isolate → rollback → restitch → verify
  → log → checkpoint`.

## Layer 2 · SB689 OMEGA · Sovereign Stitch (resilience supervisor)

```
[BRICK_A_SEED]──┐
   Golden       │ STITCH
   Image RO     ▼
[BRICK_B_GHOST]──► Shadow Mirror, atomic clone every cycle
   ▼
[BRICK_C_ARMOR]──► Drift > 0.0001 OR Pulse==0  → resurrect
   ▼
[BRICK_D_CROWN]──► Green / Gold / Red (Live_Sell / Connect_To_Stitch)
```

Supervisor tick: `Verify_Stitch → Mirror_State → Monitor_Drift`.
Fail state: `kill → activate → re-stitch → signal`.

## Cross-layer contract

- The OMEGA supervisor accepts an `AuditLedger` — the same ledger used
  by the Braided Runtime. Resurrection events and stitch handshakes
  appear as ledger entries alongside braided-runtime transitions, so a
  single chain proves both governed responses and resilience actions.
- The OMEGA bricks never call into the Brain. The Brain remains
  adapter-only at all times.

## Files

| Path | Role |
|------|------|
| [src/runtime/BraidedRuntime.ts](sb689-braided-runtime/src/runtime/BraidedRuntime.ts) | Layer 1 orchestrator |
| [src/spine/SpineGovernor.ts](sb689-braided-runtime/src/spine/SpineGovernor.ts) | Spine admission |
| [src/truth/LiquidTruthNodeMesh.ts](sb689-braided-runtime/src/truth/LiquidTruthNodeMesh.ts) | Truth verification |
| [src/conscious/ConsciousBrick.ts](sb689-braided-runtime/src/conscious/ConsciousBrick.ts) | Goal/ethics/consequence |
| [src/stem/StemTriBraid.ts](sb689-braided-runtime/src/stem/StemTriBraid.ts) | Decision/Memory/Personality braid |
| [src/brain/BrainAdapter.ts](sb689-braided-runtime/src/brain/BrainAdapter.ts) | Voice adapter |
| [src/ghost/GhostNode.ts](sb689-braided-runtime/src/ghost/GhostNode.ts) | Layer-1 checkpoints |
| [src/ledger/AuditLedger.ts](sb689-braided-runtime/src/ledger/AuditLedger.ts) | Append-only hash chain |
| [src/failure/FailureManager.ts](sb689-braided-runtime/src/failure/FailureManager.ts) | Layer-1 recovery loop |
| [src/omega/SeedBrick.ts](sb689-braided-runtime/src/omega/SeedBrick.ts) | Brick A — Golden Image RO |
| [src/omega/GhostBrick.ts](sb689-braided-runtime/src/omega/GhostBrick.ts) | Brick B — Shadow Mirror |
| [src/omega/ArmorBrick.ts](sb689-braided-runtime/src/omega/ArmorBrick.ts) | Brick C — Self-Healing daemon |
| [src/omega/CrownBrick.ts](sb689-braided-runtime/src/omega/CrownBrick.ts) | Brick D — Elegance UI |
| [src/omega/SovereignStitch.ts](sb689-braided-runtime/src/omega/SovereignStitch.ts) | Binding chain + signature |
| [src/omega/OmegaSupervisor.ts](sb689-braided-runtime/src/omega/OmegaSupervisor.ts) | Resilience supervisor |
