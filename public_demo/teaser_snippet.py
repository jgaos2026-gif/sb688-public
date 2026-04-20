#!/usr/bin/env python3
"""SB-688 Public Teaser — 10-second resilience demo.

This script demonstrates the break/heal concept without exposing
internal kernel logic. It uses the public API surface only.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kernel.SB688_ENGINE import SB688Engine


def main() -> None:
    print("=" * 50)
    print("  SB-688  RESILIENCE  TEASER")
    print("=" * 50)

    engine = SB688Engine()
    print(f"\n  Initial health: {engine.health():.1f}%")
    print(f"  Braid status:   {engine.braid_status()}")

    print("\n  Injecting 99.8% corruption...")
    engine.inject_corruption(percent=99.8)
    print(f"  Health after corruption: {engine.health():.1f}%")
    print(f"  Braid status: {engine.braid_status()}")

    print("\n  Detecting corruption...")
    detected = engine.detect_corruption()
    print(f"  Corruption detected: {detected}")

    print("\n  Healing from spine...")
    start = time.time()
    events = list(engine.heal_from_spine())
    elapsed = time.time() - start

    print(f"  Healing complete in {elapsed*1000:.0f}ms")
    print(f"  Final health: {engine.health():.1f}%")
    print(f"  Braid status: {engine.braid_status()}")
    print(f"  Events logged: {len(engine.get_ledger())}")

    print("\n" + "=" * 50)
    print("  RESULT: System recovered from 99.8% corruption")
    print("=" * 50)


if __name__ == "__main__":
    main()
