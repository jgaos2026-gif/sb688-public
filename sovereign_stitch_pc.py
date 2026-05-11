#!/usr/bin/env python3
"""
sovereign_stitch_pc.py — PC entry-point for SB689 OMEGA · Sovereign Stitch
===========================================================================
Runs the Verify_Stitch → Mirror_State → Monitor_Drift loop interactively on
any desktop / server machine.  No Android or GUI required.

Usage
-----
  python sovereign_stitch_pc.py              # default demo (5 cycles)
  python sovereign_stitch_pc.py --cycles 10  # run N stable cycles
  python sovereign_stitch_pc.py --drift      # inject a drift fault on cycle 3
  python sovereign_stitch_pc.py --dead-pulse # inject a dead-pulse fault on cycle 3
  python sovereign_stitch_pc.py --json       # emit structured JSON output

Config
------
  config/config.yaml        — runtime parameters
  config/constitution.yaml  — immutable governing principles
"""

import argparse
import json
import os
import sys
import time
from typing import Any, Dict

# ---------------------------------------------------------------------------
# Optional YAML loader (graceful fallback if PyYAML is not installed)
# ---------------------------------------------------------------------------
try:
    import yaml as _yaml

    def _load_yaml(path: str) -> Dict[str, Any]:
        with open(path, encoding="utf-8") as fh:
            return _yaml.safe_load(fh) or {}

except ImportError:
    _yaml = None  # type: ignore[assignment]

    def _load_yaml(path: str) -> Dict[str, Any]:  # type: ignore[misc]
        print(f"[WARN] PyYAML not installed — skipping {path}", file=sys.stderr)
        return {}


# ---------------------------------------------------------------------------
# Import the sovereign_stitch package
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from sovereign_stitch import OmegaSupervisor  # noqa: E402

# ---------------------------------------------------------------------------
# ANSI colour helpers (no dependency)
# ---------------------------------------------------------------------------
_ANSI = sys.stdout.isatty()


def _col(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _ANSI else text


def _green(t: str) -> str:
    return _col("32;1", t)


def _gold(t: str) -> str:
    return _col("33;1", t)


def _red(t: str) -> str:
    return _col("31;1", t)


def _cyan(t: str) -> str:
    return _col("36", t)


def _dim(t: str) -> str:
    return _col("2", t)


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------
CONFIG_PATH = os.path.join(_HERE, "config", "config.yaml")
CONST_PATH = os.path.join(_HERE, "config", "constitution.yaml")


def _load_config() -> Dict[str, Any]:
    cfg = _load_yaml(CONFIG_PATH)
    const = _load_yaml(CONST_PATH)
    return {"runtime": cfg, "constitution": const}


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------
def _banner(config: Dict[str, Any]) -> None:
    owner = config.get("runtime", {}).get("owner", "JGA")
    version = config.get("runtime", {}).get("version", "1.0.0")
    print()
    print(_gold("  ╔══════════════════════════════════════════════════╗"))
    print(_gold(f"  ║   SB689 OMEGA · Sovereign Stitch  v{version:<13}║"))
    print(_gold(f"  ║   © 2026 {owner:<41}║"))
    print(_gold('  ║   "Elegance with Consequences."                  ║'))
    print(_gold("  ╚══════════════════════════════════════════════════╝"))
    print()


def _print_tick(cycle: int, result: Dict[str, Any], json_mode: bool) -> None:
    if json_mode:
        print(json.dumps({"cycle": cycle, **result}))
        return

    status = result["status"]
    crown = result["crown"]
    drift = result["last_drift"]
    color_fn = {"GREEN": _green, "GOLD": _gold, "RED": _red}.get(crown["color"], _dim)

    status_str = _green(status) if "READY" in status else _gold(status)
    crown_str = color_fn(f"[{crown['color']}] {crown['message']}")
    drift_str = (
        _red(f"drift={drift['drift']:.4f} BREACH")
        if drift["breach"]
        else _green(f"drift={drift['drift']:.4f} OK")
    )

    print(f"  Cycle {cycle:>3}  {status_str}  |  {crown_str}")
    print(f"           {drift_str}  pulse={drift['pulse_alive']}")
    if result.get("last_resurrection"):
        res = result["last_resurrection"]
        print(_gold(f"           ↳ RESURRECTED in {res['elapsed_ms']:.4f}ms — {res['cause']}"))
    print()


def _print_summary(supervisor: OmegaSupervisor, json_mode: bool) -> None:
    resurrections = supervisor.resurrection_log()
    audit_count = len(supervisor.audit_log())
    if json_mode:
        print(
            json.dumps(
                {
                    "summary": True,
                    "resurrections": len(resurrections),
                    "audit_entries": audit_count,
                    "stitch_valid": supervisor.stitch.verify(),
                }
            )
        )
        return

    print(_cyan("─" * 54))
    print(_cyan(f"  Audit entries : {audit_count}"))
    print(_cyan(f"  Resurrections : {len(resurrections)}"))
    print(_cyan(f"  Stitch valid  : {supervisor.stitch.verify()}"))
    handshake = supervisor.connect_to_stitch()
    print(_gold(f'\n  "{handshake["message"]}"'))
    print(_dim(f"  sig={handshake['signature'][:24]}…"))
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        prog="sovereign_stitch_pc",
        description="SB689 OMEGA · Sovereign Stitch — PC runtime",
    )
    parser.add_argument("--cycles", type=int, default=5, help="Number of tick cycles to run (default: 5)")
    parser.add_argument(
        "--drift",
        action="store_true",
        help="Inject a state-drift fault on cycle 3",
    )
    parser.add_argument(
        "--dead-pulse",
        action="store_true",
        help="Inject a dead-pulse fault on cycle 3",
    )
    parser.add_argument("--json", action="store_true", help="Emit structured JSON output")
    args = parser.parse_args()

    config = _load_config()

    if not args.json:
        _banner(config)

    # Build the initial seed state from config (or defaults).
    runtime_cfg = config.get("runtime", {})
    seed_state: Dict[str, Any] = {
        "protocol": runtime_cfg.get("protocol", "SB689_OMEGA"),
        "owner": runtime_cfg.get("owner", "JGA"),
        "version": runtime_cfg.get("version", "1.0.0"),
        "philosophy": "Elegance with Consequences",
    }

    supervisor = OmegaSupervisor(seed_state=seed_state)

    for i in range(1, args.cycles + 1):
        # Default: live state matches seed (stable)
        live_state: Dict[str, Any] = dict(seed_state)
        pulse_alive = True

        # Fault injection on cycle 3
        if i == 3:
            if args.drift:
                live_state["protocol"] = "TAMPERED"  # drift fault
            if args.dead_pulse:
                pulse_alive = False  # dead-pulse fault

        result = supervisor.tick(live_state=live_state, pulse_alive=pulse_alive)
        _print_tick(i, result, args.json)
        time.sleep(0.05)  # small pause for readability

    _print_summary(supervisor, args.json)


if __name__ == "__main__":
    main()
