# SB-688 Healing Loop
## Cold-Stitch Recovery Protocol

---

## Overview

The Healing Loop is the autonomous recovery system for SB-688. It executes a
deterministic five-step sequence when corruption, drift, or contamination is
detected beyond safe thresholds. Recovery requires no manual intervention and
produces a complete audit trail.

---

## Five-Step Recovery Sequence

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   DETECT    │ →  │   ISOLATE   │ →  │  ROLL BACK  │ →  │  RESTITCH   │ →  │ RE-VERIFY   │
│             │    │             │    │             │    │             │    │             │
│ VERA flags  │    │ Quarantine  │    │ Restore from│    │ Rebuild from│    │ VERA full   │
│ anomaly or  │    │ bad bricks  │    │ last trusted│    │ protected   │    │ integrity   │
│ checksum    │    │ Block prop- │    │ checkpoint  │    │ spine with  │    │ check       │
│ mismatch    │    │ agation     │    │             │    │ clean bricks│    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                                    │
                                                                          ┌─────────▼──────┐
                                                                          │    COMMIT      │
                                                                          │  (pass only)   │
                                                                          └────────────────┘
```

### Step 1 — Detect

Trigger sources:
- VERA gate scan identifies checksum mismatch on one or more bricks
- Contradiction path (Path B) conflicts with work path (Path A) output
- External signal from operator or peer node reports anomaly
- Periodic integrity scan finds ledger chain break

Action: Log detection event to append-only ledger. Record affected brick IDs,
detection method, and timestamp.

### Step 2 — Isolate

Quarantine all bricks identified as corrupted or contaminated. Isolation prevents
propagation to healthy bricks. Healthy bricks continue operating without interruption.

Action: Set brick `health` to `quarantined`. Append isolation event to ledger with
brick IDs and contamination vector.

### Step 3 — Roll Back

Identify the last known-good checkpoint hash in the ledger. Restore active state
from that checkpoint by replaying ledger entries up to the checkpoint.

Action: Append rollback entry to ledger referencing the corrupted range start hash
and target checkpoint hash. Do not delete any ledger entries.

### Step 4 — Restitch

Rebuild quarantined bricks from the protected spine (`kernel/SB688_KERNEL.md`)
using clean source data. Each rebuilt brick receives a fresh checksum.

Action: Append restitch event for each rebuilt brick. Verify rebuilt checksums
against spine-derived values.

### Step 5 — Re-verify

Execute a full VERA pass on the restored system state. Confirm all brick checksums
match expected values. Validate ledger chain continuity from checkpoint to current.

Action: Append VERA re-verification result to ledger. **Only proceed to commit if
verification passes.** If verification fails, escalate immediately.

---

## Heal vs. Escalate Decision Matrix

| Severity | Condition | Action |
|---|---|---|
| **Minor** | Single brick checksum mismatch, no propagation | Log warning, isolate brick, continue with caution |
| **Moderate** | Contradiction detected in work path output | Isolate affected brick, request owner review before recommit |
| **High** | Multiple bricks corrupted, or braided path conflict | Execute full healing loop, escalate if healing fails |
| **Critical** | Safety / legal / financial risk, or spine integrity breach | Full healing loop, mandatory human escalation, suspend autonomy |
| **Repeated** | Three or more drift episodes in rolling window | Suspend autonomous operation, require manual authorization for all commits |

---

## Healing Telemetry Schema

Each healing cycle exports structured telemetry to the append-only ledger:

```json
{
  "session_id": "uuid",
  "trigger": "vera_scan|contradiction|external|periodic",
  "corrupted_bricks": ["brick_id", ...],
  "checkpoint_hash": "sha256_hash",
  "time_to_detect_ms": 0,
  "time_to_isolate_ms": 0,
  "time_to_recover_ms": 0,
  "total_cycle_ms": 0,
  "rollback_count": 0,
  "escalation_count": 0,
  "repeat_drift_rate": 0.0,
  "vera_recheck_status": "pass|fail|escalate",
  "committed": true
}
```

### Telemetry Fields

| Field | Description |
|---|---|
| `session_id` | Unique identifier for this healing cycle |
| `trigger` | What initiated the healing loop |
| `corrupted_bricks` | List of brick IDs that were quarantined |
| `checkpoint_hash` | Ledger hash of the rollback target |
| `time_to_detect_ms` | Milliseconds from corruption to VERA alert |
| `time_to_isolate_ms` | Milliseconds from detection to quarantine |
| `time_to_recover_ms` | Milliseconds from rollback to verified recommit |
| `total_cycle_ms` | End-to-end healing cycle duration |
| `rollback_count` | Total rollbacks in current session |
| `escalation_count` | Total escalations triggered |
| `repeat_drift_rate` | Fraction of cycles with repeated drift |
| `vera_recheck_status` | Final VERA verdict before commit decision |
| `committed` | Whether the recovered state was committed |

---

## Benchmark Results

| Scenario | Bricks Corrupted | Detection | Full Recovery |
|---|---|---|---|
| Single brick failure | 1 / 64 | < 10 ms | < 200 ms |
| Moderate corruption | 32 / 64 | < 50 ms | < 1 second |
| Maximum corruption | 64 / 64 (99.8%) | < 100 ms | < 2 seconds |

---

*Governed by `governance/CONSTITUTION.md` and `kernel/SB688_KERNEL.md`.*
