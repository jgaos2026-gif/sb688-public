#!/usr/bin/env bash
# scripts/init.sh — SB689 OMEGA · Sovereign Stitch  PC initialiser
# -----------------------------------------------------------------
# Sets up a Python virtual environment and installs runtime deps.
# Run from the repo root:
#   bash scripts/init.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$REPO_ROOT/.venv"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  SB689 OMEGA · Sovereign Stitch — init.sh   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Python check ──────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install Python 3.9+ and retry." >&2
    exit 1
fi

PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "[INFO]  Found Python $PY_VER"

# ── Virtual environment ───────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "[INFO]  Creating virtual environment at .venv …"
    python3 -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
echo "[INFO]  Activated virtual environment"

# ── Install Python dependencies ───────────────────────────────────
echo "[INFO]  Installing Python dependencies …"
pip install --quiet --upgrade pip
pip install --quiet -r "$REPO_ROOT/requirements.txt"

echo ""
echo "[OK]    Setup complete."
echo ""
echo "  To run the Sovereign Stitch PC program:"
echo "    source .venv/bin/activate"
echo "    python sovereign_stitch_pc.py"
echo ""
echo "  Run with fault injection:"
echo "    python sovereign_stitch_pc.py --drift"
echo "    python sovereign_stitch_pc.py --dead-pulse"
echo ""
echo "  Run pytest suite:"
echo "    pytest"
echo ""
