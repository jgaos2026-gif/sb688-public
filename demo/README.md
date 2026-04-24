# SB-688 Live Resilience Demo

## Run

Open `demo/index.html` in any modern browser (or serve repo root with a static server).

## Demo flow

1. Click **CORRUPT SYSTEM**
   - Health collapses to **0.2%**
   - Braid transitions **GREEN → RED**
   - Ledger streams corruption events with microsecond-formatted timestamps
2. Click **WATCH RECOVERY**
   - Rollback starts (ghost nodes appear)
   - Scan wave reconstructs the grid
   - Braid returns **RED/HEALING → GREEN**
   - Verification and final ledger seal complete in under 2 seconds total phase timeline
3. Click **KILL & RESET**
   - Hard-stop simulation
   - Ghost node rebuild + reset back to 100%

## Validation & proof

- Append-only ledger with checksum chaining (`checksum` links previous entry)
- Final verification recalculates chain integrity in-browser
- Export full audit trail from UI:
  - **JSON** for machine-readable validation
  - **CSV** for spreadsheet/audit review

## Color system

- `INIT` = Blue (`#0080FF`)
- `CORRUPT/DETECT/ISOLATE` = Red (`#FF0000`)
- `ROLLBACK/HEAL/COMPLETE` = Green (`#00FF00`)
- `VERIFY` = Yellow (`#FFFF00`)
