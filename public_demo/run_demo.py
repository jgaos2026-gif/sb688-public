#!/usr/bin/env python3
"""SB-688 Public Demo — Full resilience cycle.

Demonstrates:
  1. System initialization
  2. 99.8% corruption injection
  3. VERA detection
  4. Autonomous healing
  5. Integrity verification
  6. Proof export (requires access code via environment variable)

Usage:
    python public_demo/run_demo.py

To export proof artifacts, set the SB688_SENSITIVE_ACCESS_CODE
environment variable before running.
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate


def print_status(engine: SB688Engine, label: str) -> None:
    print(f"\n[{label}]")
    print(f"  Health: {engine.health():.4f}%")
    print(f"  Braid: {engine.braid_status()}")
    print(f"  Timestamp: {engine.get_state()['timestamp']}")


def main() -> None:
    print("=" * 60)
    print("SB-688 LIVE RESILIENCE DEMO")
    print("=" * 60)

    engine = SB688Engine()
    vera = VERAGate()
    print_status(engine, "System initialized")

    print("\n[PHASE 2: CORRUPTION]")
    print("Injecting 99.8% corruption...")
    engine.inject_corruption(percent=99.8)
    print_status(engine, "System corrupted")

    print("\n[PHASE 3: DETECTION]")
    detect_start = time.time()
    is_corrupted = engine.detect_corruption()
    detect_time = time.time() - detect_start
    print(f"VERA detected corruption: {is_corrupted} ({detect_time*1000:.2f}ms)")

    print("\n[PHASE 4: HEALING]")
    heal_start = time.time()
    for event in engine.heal_from_spine():
        if event.phase in {"ISOLATE", "ROLLBACK", "VERIFY", "COMPLETE"}:
            print(f"  {event.phase}: {event.message}")
    heal_time = time.time() - heal_start
    print_status(engine, "System healing complete")

    ledger = engine.get_ledger()
    is_valid = vera.verify_ledger_chain(ledger)

    print("\n" + "=" * 60)
    print("PROOF OF CONCEPT RESULTS")
    print("=" * 60)
    print(f"Detection time: {detect_time*1000:.2f}ms")
    print(f"Healing time: {heal_time*1000:.2f}ms")
    print(f"Total events: {len(ledger)}")
    print(f"Final health: {engine.health():.1f}%")
    print(f"Braid status: {engine.braid_status()}")
    print(f"Data integrity: {'VERIFIED' if is_valid else 'FAILED'}")

    # Proof export requires access code via environment variable
    access_code = os.environ.get("SB688_SENSITIVE_ACCESS_CODE")
    if access_code:
        if engine.unlock_sensitive_access(access_code):
            with open("proof.json", "w", encoding="utf-8") as handle:
                handle.write(engine.export_proof(format="json"))
            with open("proof.csv", "w", encoding="utf-8") as handle:
                handle.write(engine.export_proof(format="csv"))
            print("Proof exported: proof.json, proof.csv")
        else:
            print("Unlock failed: incorrect access code or attempt limit reached.")
    else:
        print("Set SB688_SENSITIVE_ACCESS_CODE to export proof artifacts.")


if __name__ == "__main__":
    main()
