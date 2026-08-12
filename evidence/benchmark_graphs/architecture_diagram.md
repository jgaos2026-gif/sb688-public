# BCT Architecture Map

**Repository:** jgaos2026-gif/sb688-public  
**Version:** 1.1.1  
**Generated:** 2026-08-06  

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SOVEREIGN OS / BCT REFERENCE IMPLEMENTATION              │
│                                                                                  │
│   SB688 Vocabulary          SB689 Braided Runtime           SB689 OMEGA         │
│   ─────────────────         ──────────────────────          ─────────────────   │
│   • Spine Governance        • BraidedRuntime               • OmegaSupervisor   │
│   • Ghost Node              • LiquidTruthNodeMesh           • SeedBrick         │
│   • Brick Stitch            • StemTriBraid                  • GhostBrick        │
│   • Quarantine              • ConsciousBrick                • ArmorBrick        │
│   • Trusted Restore         • BrainAdapter                  • CrownBrick        │
│   • Verifiable Proof        • FailureManager                • SovereignStitch   │
│                             • AuditLedger                                       │
│                                                                                  │
│   Phoenix Recovery          Triad Recovery             Paired Node System       │
│   ─────────────────         ──────────────────         ──────────────────────   │
│   • PhoenixRecovery         • TriadCoordinator         • PairedNodeSystem      │
│   • PhoenixJournal          • HunterNode logic         • MasterNode logic      │
│   • PhoenixPatrol           • WarriorNode logic        • WitnessNode logic     │
│                             • RepairNode logic                                  │
│                                                                                  │
│   BCT Verification          Upload Subsystem                                   │
│   ─────────────────         ──────────────────                                  │
│   • BctVerifier             • UploadSentinel                                   │
│   • 6 verification layers   • FileUploadManager                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
src/index.ts
├── src/contracts/         (shared type contracts)
│   ├── audit.ts           AuditTransition, AuditEntry
│   ├── result.ts          Result<T>, RuntimeStage, RuntimeErrorCode
│   └── runtime.ts         UserIntent, SpinePermit, TruthReport, ...
│
├── src/utils/
│   ├── hash.ts            hashOf(), makeId(), stableStringify()
│   └── time.ts            Clock, systemClock, fixedClock()
│
├── src/ledger/
│   └── AuditLedger.ts     append(), verifyChain(), entries()
│
├── src/spine/
│   └── SpineGovernor.ts   govern() → Result<SpinePermit>
│
├── src/truth/
│   ├── LiquidTruthNodeMesh.ts  validatePreBrain(), validatePostBrain()
│   └── BctVerifier.ts     verify() → BctVerificationResult (6 layers)
│
├── src/conscious/
│   └── ConsciousBrick.ts  inspect() → Result<ConsciousReport>
│
├── src/stem/
│   ├── StemTriBraid.ts    braid() → Result<StemPacket>
│   ├── DecisionRouter.ts
│   ├── MemoryRouter.ts
│   └── PersonalityRouter.ts
│
├── src/brain/
│   └── BrainAdapter.ts    speak() → BrainOutput
│
├── src/ghost/
│   └── GhostNode.ts       checkpoint() → GhostCheckpoint
│
├── src/failure/
│   └── FailureManager.ts  recover() → RuntimeResponse
│
├── src/runtime/
│   └── BraidedRuntime.ts  run(intent) → RuntimeResponse
│       ├── depends: SpineGovernor
│       ├── depends: LiquidTruthNodeMesh
│       ├── depends: ConsciousBrick
│       ├── depends: StemTriBraid
│       ├── depends: BrainAdapter
│       ├── depends: GhostNode
│       ├── depends: FailureManager
│       └── depends: AuditLedger
│
├── src/omega/
│   ├── OmegaSupervisor.ts tick(), resurrect()
│   ├── SovereignStitch.ts forge(), verify(), connect()
│   ├── SeedBrick.ts       golden(), selfCheck()
│   ├── GhostBrick.ts      mirror(), latest()
│   ├── ArmorBrick.ts      measure(), shouldResurrect()
│   └── CrownBrick.ts      green(), gold(), red()
│
├── src/upload/
│   ├── UploadSentinel.ts  scan() → SentinelScanResult
│   └── FileUploadManager.ts receive(), dispatch(), verifyUploadLog()
│
├── src/phoenix/
│   ├── contracts.ts       PhoenixSnapshot, PhoenixMetrics, PatrolReport ...
│   ├── PhoenixJournal.ts  record(), verify(), all()
│   ├── PhoenixRecovery.ts checkpoint(), rollback(), repair(), restart(), replay()
│   └── PhoenixPatrol.ts   patrol(), quarantineList(), verifyAuditLog()
│
├── src/triad/
│   ├── contracts.ts       CorruptionReport, IsolationReport, ReconstructionReport
│   └── TriadCoordinator.ts run(liveState, referenceState) → TriadCycleResult
│
├── src/paired/
│   ├── contracts.ts       SignedCheckpoint, QuorumResult, PairedAuditEntry
│   └── PairedNodeSystem.ts verify(), authorizeRecovery(), verifyAuditLog()
│
├── src/system/
│   └── IntegratedSystem.ts  process(), tick(), ledgerValid()
│
└── src/quantum/
    └── QuantumDistributionValidator.ts  validate()
```

---

## Execution Pipeline — BraidedRuntime

```
UserIntent
    │
    ▼
[SPINE] SpineGovernor.govern()
    │  ← validates: non-empty, max-length, no-bypass
    │  → SpinePermit { intentId, spineSignature, constraints }
    │
    ▼
[TRUTH.PRE] LiquidTruthNodeMesh.validatePreBrain()
    │  ← checks: intent integrity, spine signature, constraints
    │  → TruthReport { verified, confidence, meshSignature }
    │
    ▼
[CONSCIOUS] ConsciousBrick.inspect()
    │  ← checks: ethical pass, consequence pass
    │  → ConsciousReport { consciousSignature }
    │
    ▼
[STEM] StemTriBraid.braid()
    │  ← Decision + Memory + Personality routing
    │  → StemPacket { decision, memory, personality, braidSignature }
    │
    ▼
[BRAIN] BrainAdapter.speak()
    │  ← adapter-only, uses stem braid
    │  → BrainOutput { text, adapterOnly, usedStemSignature }
    │
    ▼
[TRUTH.POST] LiquidTruthNodeMesh.validatePostBrain()
    │  ← checks: adapter-only, non-empty, no-override
    │  → TruthReport { verified, confidence }
    │
    ▼
[GHOST] GhostNode.checkpoint()
    │  ← state snapshot
    │  → GhostCheckpoint { id, stateHash, label: "verified-output" }
    │
    ▼
[LEDGER] AuditLedger.verifyChain()
    │  ← hash chain integrity
    │
    ▼
RuntimeResponse { traceId, output, verified: true, auditHash, checkpoint }
```

### Failure Recovery Pipeline

```
Any stage failure
    │
    ▼
[FAILURE.DETECT] → [FAILURE.ISOLATE] → [FAILURE.ROLLBACK]
    │                    │                    │
    │              Quarantine stage     Restore last stable
    │              and error            snapshot
    ▼
[FAILURE.RESTITCH] → [FAILURE.VERIFY] → [FAILURE.LOG] → [FAILURE.CHECKPOINT]
    │                      │                  │                   │
  Rebuild response   Truth validation    Audit append     Ghost checkpoint
  in degraded mode   of recovery text    (chain valid)    label: "failure-recovery"
    │
    ▼
RuntimeResponse { verified: true (if recovery truth passed), checkpoint.label: "failure-recovery" }
```

---

## OmegaSupervisor Tick Loop

```
OmegaSupervisor.tick(liveState, pulseAlive)
    │
    ├─[1] Verify_Stitch
    │       SovereignStitch.verify()
    │       ├── PASS → continue
    │       └── FAIL → resurrect("BRICK_C_ARMOR", "Stitch invalid")
    │
    ├─[2] Mirror_State
    │       priorClean = ghost.latest()
    │       frame = ghost.mirror(liveState)   ← pre-breach frame saved first
    │
    └─[3] Monitor_Drift
            armor.measure(seedChecksum, liveState, pulseAlive)
            ├── breach=false → crown.green() → SB689_READY
            └── breach=true  → resurrect(cause, priorClean)
                                 │
                                 ├── kill(corrupted_brick)
                                 ├── activate(ghost_shadow) → pointer-flip to clean mirror
                                 ├── re-stitch(clean_seed)
                                 └── signal(crown_gold_flash) → SB689_RESURRECTING
```

---

## Phoenix Recovery State Machine

```
           checkpoint()
  idle ──────────────────► checkpointing ──► verified
    │                                           │
    │         rollback()                        │ rollback(id)
    ◄───────────────────── rolling_back ◄───────┘
    │
    │         repair()
    ├────────────────────► repairing ──► verified
    │
    │         restart()
    ├────────────────────► restarting ──► verified / failed (no snaps)
    │
    │         replay()
    └────────────────────► replaying ──► verified (deterministic)
                                     └► failed (non-deterministic)
```

---

## Triad Recovery Flow

```
TriadCoordinator.run(liveState, referenceState)
    │
    ├── [SPINE] SpineGovernor.govern()  ← all nodes route through Spine
    │       └── FAIL → return { success: false }
    │
    ├── [HUNTER] hunterScan()
    │       Compare liveState keys against referenceState
    │       ├── No corruption → return { success: true, isolation: null, reconstruction: null }
    │       └── Corruption found → CorruptionReport { corruptedKeys, severity }
    │
    ├── [WARRIOR] warriorIsolate()
    │       Hash-isolate the corrupted entries
    │       └── IsolationReport { isolatedKeys, blockedStateHash }
    │
    └── [REPAIR] repairReconstruct()
            Rebuild corrupted keys from reference
            Verify: hashOf(rebuilt) === hashOf(refSlice)
            └── ReconstructionReport { reconstructedKeys, finalStateHash, verifiedBySpine }
```

---

## Paired Node Verification Flow

```
PairedNodeSystem.verify(masterState, witnessState)
    │
    ├── Master independently signs its state
    │       SignedCheckpoint { role: "master", stateHash, signature }
    │
    ├── Witness independently verifies and signs its own state
    │       SignedCheckpoint { role: "witness", stateHash, signature }
    │       ← Witness NEVER copies master's hash
    │
    ├── Quorum check: masterCheckpoint.stateHash === witnessCheckpoint.stateHash
    │       ├── AGREE  → decision: "agree"  | disagreementHash: null
    │       └── DISAGREE → decision: "disagree" | disagreementHash: hashOf({master, witness})
    │
    └── Tamper-evident audit entry appended
            PairedAuditEntry { decision, authorizedBy: "quorum" | "none", hash }
```

---

## BCT Verification Layers

```
BctVerifier.verify(input)
    │
    ├── [Layer 1] IDENTITY    identity.trim().length > 0
    ├── [Layer 2] SCHEMA      all requiredKeys present in state
    ├── [Layer 3] CRYPTO      hashOf(state) === declaredHash
    ├── [Layer 4] BRAID       braidSignature === hashOf({stateHash, spineSignature})
    ├── [Layer 5] TRANSACTION priorStateHash is well-formed (sha256: or GENESIS or absent)
    └── [Layer 6] AUDIT       ledger.verifyChain() && latestHash === priorAuditHash
    │
    └── trusted = ALL 6 layers passed
        failedLayers = list of layer names that failed
        finalHash = hashOf({ identity, declaredHash, layers })
```

---

## Hash Chain Architecture

All three append-only structures use the same pattern:

```
GENESIS
  │
  └─ entry[1] = { ...data, previousHash: "GENESIS", hash: sha256({seq:1, previousHash, data}) }
                  │
                  └─ entry[2] = { ...data, previousHash: entry[1].hash, hash: sha256({seq:2, ...}) }
                                  │
                                  └─ entry[N] = ...

Used by:
  • AuditLedger         (audit transitions)
  • PhoenixJournal      (recovery operations)
  • PhoenixPatrol       (patrol audit log)
  • PairedNodeSystem    (quorum audit log)
  • FileUploadManager   (upload log)
  • PhoenixRecovery     (snapshot chain)
```

---

*This diagram was generated from live code analysis of the repository at commit HEAD.*
