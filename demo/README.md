# SB-688 Live Resilience Demo
## Browser-Based Visualization Guide

<p align="center">
  <img src="../logo-banner.svg" alt="Jay's Graphic Arts" width="500"/>
</p>

---

## Overview

The SB-688 Live Resilience Demo is a browser-based interactive visualization of
the complete break-and-heal lifecycle. It runs entirely in the browser — no server
or backend required.

**Open the demo:**
```bash
open demo/index.html
# or serve from repo root:
python -m http.server 8080
```

---

## Demo Flow

### Step 1 — Corrupt System

Click **`CORRUPT SYSTEM`**

What happens:
- 99.8% of the 64 bricks are simultaneously corrupted
- Health metric collapses from **100.0%** → **0.2%**
- Braid status transitions: **GREEN** → **RED**
- Ledger streams live corruption events with microsecond-precision timestamps
- Each corrupted brick lights up red in the grid visualization

### Step 2 — Watch Recovery

Click **`WATCH RECOVERY`**

What happens:
1. **DETECT phase** — VERA gate flags all corrupted bricks via checksum scan
2. **ISOLATE phase** — Contaminated bricks are quarantined (shown as ghost nodes)
3. **ROLLBACK phase** — System state rolls back to last clean checkpoint
4. **RESTITCH phase** — Scan wave rebuilds the grid from the protected spine
5. **VERIFY phase** — Full VERA re-check confirms integrity (turns yellow)
6. **COMPLETE** — Health returns to **100.0%**, braid returns to **GREEN**

Total elapsed time: typically **< 2 seconds** across all phases.

### Step 3 — Kill & Reset (Optional)

Click **`KILL & RESET`**

What happens:
- Hard stop of all simulation activity
- Ghost node rebuild and reset back to 100% health
- Ledger is preserved (not cleared)

---

## Controls Reference

| Button | Class | Action |
|---|---|---|
| `CORRUPT SYSTEM` | `danger` (red) | Injects 99.8% corruption across all bricks |
| `WATCH RECOVERY` | `healing` (green) | Triggers autonomous cold-stitch recovery |
| `KILL & RESET` | `neutral` (gold) | Hard stop and reset to 100% |
| `DOWNLOAD LEDGER` | `neutral` (gold) | Download the full ledger (see Export) |
| `Export JSON` | panel button | Export ledger as machine-readable JSON |
| `Export CSV` | panel button | Export ledger as spreadsheet-ready CSV |

---

## Status Indicators

| Indicator | Values | Meaning |
|---|---|---|
| **HEALTH %** | 0.0% – 100.0% | Fraction of bricks in healthy state |
| **BRAID STATUS** | `GREEN` / `RED` / `HEALING` | Overall system integrity state |
| **PHASE** | `INIT` / `CORRUPT` / `DETECT` / `ISOLATE` / `ROLLBACK` / `HEAL` / `VERIFY` / `COMPLETE` | Current healing loop step |
| **CLOCK** | `HH:MM:SS.mmm` | Real-time session clock |
| **CHAIN** | `VALID` / `BROKEN` | Ledger chain integrity status |

---

## Color System

| Color | Hex | Meaning |
|---|---|---|
| Gold | `#D4AF37` | `INIT` — operational, baseline |
| Red | `#FF0000` | `CORRUPT` / `DETECT` / `ISOLATE` — failure states |
| Green | `#00FF00` | `ROLLBACK` / `HEAL` / `COMPLETE` — recovery and healthy |
| Yellow | `#FFFF00` | `VERIFY` — verification in progress |
| Black | `#000000` | Primary background |

---

## Ledger Export

The export captures the complete append-only audit trail from the current session.

### JSON Format

```json
[
  {
    "timestamp": "2026-04-30T05:55:20.512Z",
    "type": "fact",
    "source": "spine",
    "content": "System initialized. 64 bricks operational.",
    "verified": true,
    "checksum": "sha256_hash_of_previous_entry"
  },
  ...
]
```

### CSV Format

Columns: `timestamp`, `type`, `source`, `content`, `verified`, `checksum`

Suitable for spreadsheet review and compliance audit workflows.

---

## Architecture

The demo is built as a pure JavaScript ES module application:

| File | Role |
|---|---|
| `index.html` | Entry point and UI structure |
| `styles.css` | Black & gold themed stylesheet |
| `animation-controller.js` | Demo orchestration and phase sequencing |
| `simulator.js` | Brick corruption and healing simulation engine |
| `ledger.js` | Append-only ledger with chain verification |
| `visualization.js` | Canvas-based 64-brick grid renderer |

---

<p align="center">
  <strong>SB-688 — Sovereign Alignment Kernel</strong><br/>
  <em>Jay's Graphic Arts / National Resilience Council</em><br/>
  Resilience · Governance · Innovation
</p>

<p align="center">
  <img src="../demo/logo.svg" alt="JGA Logo" width="80"/>
</p>
