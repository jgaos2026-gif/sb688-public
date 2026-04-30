# SB-688 Functional Runtime Guide
## API Reference, Security Model, and Run Guide

<p align="center">
  <img src="./logo-banner.svg" alt="Jay's Graphic Arts" width="500"/>
</p>

---

## Quick Commands

### Run single-node demo

```bash
make run
```

### Run test suite

```bash
python -m pip install -r tests/requirements.txt
make test
```

### Start 5-node Docker testbed

```bash
make docker-up
```

---

## API Reference

Once the node is running (default: `http://localhost:5000`), the following
endpoints are available:

### Health & Status

```bash
# Basic status (public)
curl http://localhost:5000/status

# Full status with sensitive state (requires unlock)
curl http://localhost:5000/status?include_sensitive=true
```

### Corruption & Healing

```bash
# Corrupt the system (inject failures)
curl -X POST http://localhost:5000/corrupt

# Trigger autonomous healing
curl -X POST http://localhost:5000/heal
```

### Ledger

```bash
# Read the append-only ledger
curl http://localhost:5000/ledger
```

### Lock Gate (Sensitive Operations)

All sensitive operations require authentication via the access code configured
in `SB688_SENSITIVE_ACCESS_CODE`.

```bash
# Unlock sensitive access
curl -X POST http://localhost:5000/unlock \
  -H "Content-Type: application/json" \
  -d '{"code": "<your-access-code>"}'

# Lock sensitive access
curl -X POST http://localhost:5000/lock
```

---

## Lock Protection Model

All sensitive operations are protected by the access code set via:

```bash
export SB688_SENSITIVE_ACCESS_CODE=<your-access-code>
```

### Engine-Level Protection

| Operation | Protection |
|---|---|
| `engine.get_state(include_sensitive=True)` | Requires unlock |
| `engine.export_proof()` | Requires unlock |
| Brick data content | Shown as `"LOCKED"` by default |

### Node-Level Protection

| Operation | Protection |
|---|---|
| `node.get_state(include_sensitive=True)` | Requires unlock |
| `node.sync_state_with_peers()` | Requires unlock |
| `node.apply_brick_state()` | Requires unlock |
| `node.participate_in_healing()` | Requires unlock |
| `node.heartbeat()` | Requires unlock |

### API-Level Protection

| Endpoint | Protection |
|---|---|
| `GET /status?include_sensitive=true` | Requires unlock |
| `POST /unlock` | Open — accepts access code |
| `POST /lock` | Open — re-locks access |

---

## Proof Export

The live demo writes proof artifacts to the working directory:

| File | Format | Contents |
|---|---|---|
| `proof.json` | JSON | Machine-readable full ledger export |
| `proof.csv` | CSV | Spreadsheet-ready audit trail |

To trigger export:

```bash
SB688_SENSITIVE_ACCESS_CODE=<your-code> python public_demo/run_demo.py
```

---

## Environment Configuration

| Variable | Description | Default |
|---|---|---|
| `SB688_SENSITIVE_ACCESS_CODE` | Access code for sensitive operations | None (locked) |

Set this variable before starting any node or running demos that export proof artifacts.

---

<p align="center">
  <strong>SB-688 — Sovereign Alignment Kernel</strong><br/>
  <em>Jay's Graphic Arts / National Resilience Council</em>
</p>
