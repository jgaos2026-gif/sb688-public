# SB-688 Public Demo
## Python-Based Resilience Pipeline

<p align="center">
  <img src="../logo-banner.svg" alt="Jay's Graphic Arts" width="500"/>
</p>

Scripts in this folder demonstrate the SB-688 resilience system end-to-end
without exposing internal kernel logic.

---

## Scripts

### Teaser (10 seconds)

```bash
python public_demo/teaser_snippet.py
```

Runs a quick break-and-heal cycle and prints resilience metrics to the terminal.
No configuration required.

**Output includes:**
- Initial health status
- Corruption event and health collapse
- Autonomous healing trigger
- Final health, braid status, and ledger event count

### Full Pipeline Demo

```bash
python public_demo/run_demo.py
```

Runs the complete resilience pipeline:

```
INIT → CORRUPT → DETECT → ISOLATE → ROLLBACK → RESTITCH → VERIFY → COMPLETE
```

**Output includes:**
- Phase-by-phase status log
- Brick health summary at each phase
- Ledger event stream
- Final proof metrics

### Export Proof Artifacts

```bash
SB688_SENSITIVE_ACCESS_CODE=<your-code> python public_demo/run_demo.py
```

Writes proof artifacts to the working directory:

| File | Description |
|---|---|
| `proof.json` | Machine-readable full ledger export |
| `proof.csv` | Spreadsheet-ready audit trail |

---

## What This Layer Shows

| Capability | Demonstrated |
|---|---|
| 99.8% corruption survival | ✅ |
| Autonomous cold-stitch recovery | ✅ |
| Zero data loss after healing | ✅ |
| Append-only ledger with chain verification | ✅ |
| VERA gate enforcement | ✅ |
| Proof artifact export | ✅ (requires access code) |

---

*Internal kernel source is not included in the public demo layer.*

---

<p align="center">
  <em>Jay's Graphic Arts / National Resilience Council</em><br/>
  <img src="../demo/logo.svg" alt="JGA Logo" width="80"/>
</p>
