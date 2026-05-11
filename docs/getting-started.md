# Getting Started — SB689 OMEGA · Sovereign Stitch (Python PC Runtime)

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.9 or later |
| pip | 22.0 or later |
| (optional) PyYAML | 6.0 or later |

No Android SDK, Kivy, or GUI toolkit is required for the PC runtime.

## Quick start

### 1 — Clone and initialise

```bash
git clone https://github.com/jgaos2026-gif/sb688-public.git
cd sb688-public

# One-shot bootstrap (creates .venv and installs deps)
bash scripts/init.sh
source .venv/bin/activate
```

### 2 — Run the default demo (5 stable cycles)

```bash
python sovereign_stitch_pc.py
```

Expected output (colour in terminal):

```
  ╔══════════════════════════════════════════════════╗
  ║   SB689 OMEGA · Sovereign Stitch  v1.0.0         ║
  ║   © 2026 JGA                                     ║
  ║   "Elegance with Consequences."                   ║
  ╚══════════════════════════════════════════════════╝

  Cycle   1  SB689_READY  |  [GREEN] Cycle 1 stable.
           drift=0.0000 OK  pulse=True

  …

  "Sb688 when I say connect to the stitch show how you feel we're going live lets sell it"
  sig=<sha256-prefix>…
```

### 3 — Inject a drift fault

```bash
python sovereign_stitch_pc.py --drift
```

On cycle 3 the live state is tampered → resurrection fires → CrownBrick flashes GOLD.

### 4 — Inject a dead-pulse fault

```bash
python sovereign_stitch_pc.py --dead-pulse
```

### 5 — JSON output (for scripting / CI)

```bash
python sovereign_stitch_pc.py --json | python -m json.tool
```

### 6 — Run more cycles

```bash
python sovereign_stitch_pc.py --cycles 20
```

## Run the test suite

```bash
pytest
```

All 45+ assertions should pass in under one second.

## Configuration

| File | Purpose |
|------|---------|
| `config/config.yaml` | Runtime parameters (cycles, log level, drift threshold) |
| `config/constitution.yaml` | Immutable governing principles — read-only |

Edit `config/config.yaml` to change defaults.  The constitution is never
written by the program.

## CLI reference

```
usage: sovereign_stitch_pc.py [-h] [--cycles N] [--drift] [--dead-pulse] [--json]

options:
  --cycles N      Number of supervisor tick cycles (default: 5)
  --drift         Inject a state-drift fault on cycle 3
  --dead-pulse    Inject a dead-pulse fault on cycle 3
  --json          Emit structured JSON output
```

## Next steps

- Read [docs/overview.md](overview.md) for the conceptual model.
- Read [docs/architecture.md](architecture.md) for the module map and brick contracts.
- See [docs/WHITEPAPER.md](WHITEPAPER.md) for the full protocol specification.
- For Android/mobile, use [android_app.py](../android_app.py) with Buildozer.
