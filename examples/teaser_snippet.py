#!/usr/bin/env python3

"""Tiny SB-688 teaser run for quick sharing."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kernel.SB688_ENGINE import SB688Engine


def main() -> None:
    engine = SB688Engine()

    engine.inject_corruption(percent=25.0)
    engine.detect_corruption()

    phases = []
    for event in engine.heal_from_spine():
        if event.phase in {"ISOLATE", "ROLLBACK", "HEAL", "VERIFY", "COMPLETE"}:
            phases.append(f"{event.phase}: {event.message}")

    print("SB-688 TEASER")
    print("---------------")
    print("Health after heal:", f"{engine.health():.1f}%")
    print("Braid status:", engine.braid_status())
    print("Events:")
    for line in phases:
        print("  -", line)


if __name__ == "__main__":
    main()
