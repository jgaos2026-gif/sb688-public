#!/usr/bin/env python3
"""
SB-688 Unified CLI Interface
Provides a single entry point for all SB-688 operations.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate
from kernel.LEDGER_STORE import LedgerStore


def cmd_demo(args):
    """Run the live resilience demo."""
    from examples.run_live_demo import main
    main()


def cmd_test(args):
    """Run test suite."""
    import subprocess
    result = subprocess.run(
        ["python", "-m", "pytest", "tests/", "-v", "--tb=short"],
        cwd=Path(__file__).parent,
    )
    sys.exit(result.returncode)


def cmd_verify(args):
    """Verify system integrity."""
    engine = SB688Engine()
    vera = VERAGate()

    print("Running VERA verification...")
    ledger = engine.get_ledger()
    is_valid = vera.verify_ledger_chain(ledger)

    print(f"Health: {engine.health():.1f}%")
    print(f"Braid Status: {engine.braid_status()}")
    print(f"Ledger Valid: {is_valid}")
    print(f"Total Events: {len(ledger)}")

    sys.exit(0 if is_valid and engine.health() == 100.0 else 1)


def cmd_heal(args):
    """Run healing loop."""
    engine = SB688Engine()

    if args.inject:
        print(f"Injecting {args.inject}% corruption...")
        engine.inject_corruption(percent=args.inject)

    is_corrupted = engine.detect_corruption()
    if not is_corrupted:
        print("No corruption detected. System is healthy.")
        return

    print("Corruption detected. Running healing loop...")
    for event in engine.heal_from_spine():
        if event.phase in {"ISOLATE", "ROLLBACK", "VERIFY", "COMPLETE"}:
            print(f"  {event.phase}: {event.message}")

    print(f"\nFinal health: {engine.health():.1f}%")
    print(f"Braid status: {engine.braid_status()}")


def cmd_teaser(args):
    """Run 10-second teaser."""
    from examples.teaser_snippet import main
    main()


def cmd_version(args):
    """Show version information."""
    import json
    manifest_path = Path(__file__).parent / "kernel" / "KERNEL_MANIFEST.json"
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"SB-688 {manifest['kernel_version']}")
    print(f"Created: {manifest['creation_date']}")
    print(f"Last Verified: {manifest['last_verified_date']}")
    print(f"Checksum: {manifest['checksum_sha256'][:16]}...")


def cmd_ghost_demo(args):
    """Run Ghost Node demonstration."""
    from examples.ghost_node_demo import main
    main()


def cmd_truth_demo(args):
    """Run Truth Node demonstration."""
    from examples.truth_node_demo import main
    main()


def cmd_phoenix_demo(args):
    """Run Phoenix Node demonstration."""
    from examples.phoenix_node_demo import main
    main()


def main():
    parser = argparse.ArgumentParser(
        description="SB-688 Sovereign Alignment Kernel",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  sb688.py demo              Run live resilience demo
  sb688.py test              Run test suite
  sb688.py verify            Verify system integrity
  sb688.py heal --inject 50  Inject corruption and heal
  sb688.py teaser            Run 10-second teaser
  sb688.py ghost             Ghost Node demo (covert ops)
  sb688.py truth             Truth Node demo (disinformation)
  sb688.py phoenix           Phoenix Node demo (disaster recovery)
  sb688.py version           Show version info
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    subparsers.add_parser("demo", help="Run live resilience demo")
    subparsers.add_parser("test", help="Run test suite")
    subparsers.add_parser("verify", help="Verify system integrity")

    heal_parser = subparsers.add_parser("heal", help="Run healing loop")
    heal_parser.add_argument(
        "--inject",
        type=float,
        metavar="PERCENT",
        help="Inject corruption percentage (0-100)",
    )

    subparsers.add_parser("teaser", help="Run 10-second teaser")
    subparsers.add_parser("version", help="Show version information")
    subparsers.add_parser("ghost", help="Run Ghost Node demo (covert ops)")
    subparsers.add_parser("truth", help="Run Truth Node demo (disinformation detection)")
    subparsers.add_parser("phoenix", help="Run Phoenix Node demo (disaster recovery)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "demo": cmd_demo,
        "test": cmd_test,
        "verify": cmd_verify,
        "heal": cmd_heal,
        "teaser": cmd_teaser,
        "version": cmd_version,
        "ghost": cmd_ghost_demo,
        "truth": cmd_truth_demo,
        "phoenix": cmd_phoenix_demo,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
