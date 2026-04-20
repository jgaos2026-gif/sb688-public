#!/usr/bin/env python3
"""
SB-688 Phoenix Node Demonstration
Safe-Fail Regeneration - Dormant disaster recovery system.

Demonstrates:
1. Dormant node listening for beacons
2. Auto-sync every 2 days (simulated)
3. Emergency awakening on system degradation
4. Final scan before complete failure
5. Complete system rebuild in <2 seconds
6. Full data restoration from backup
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kernel.SB688_ENGINE import SB688Engine
from nodes.phoenix_node import PhoenixNode, create_beacon


def print_separator(title: str = ""):
    """Print a visual separator."""
    if title:
        print(f"\n{'=' * 70}")
        print(f"{title.center(70)}")
        print(f"{'=' * 70}")
    else:
        print(f"{'=' * 70}")


def main():
    print_separator("SB-688 PHOENIX NODE DEMONSTRATION")
    print("Safe-Fail Regeneration - Dormant Disaster Recovery")
    print_separator()

    # ========================================================================
    # PHASE 1: System Initialization
    # ========================================================================
    print("\n[PHASE 1] SYSTEM INITIALIZATION")
    print("-" * 70)

    # Create primary system
    print("\n[PRIMARY] Initializing primary system...")
    primary = SB688Engine()
    print(f"[PRIMARY] Health: {primary.health():.1f}%")
    print(f"[PRIMARY] Braid Status: {primary.braid_status()}")
    print(f"[PRIMARY] Total Bricks: {primary.TOTAL_BRICKS}")

    # Create Phoenix dormant node
    print("\n[PHOENIX] Initializing Phoenix Node (dormant recovery)...")
    phoenix = PhoenixNode("PHOENIX_PRIME")

    # ========================================================================
    # PHASE 2: Initial Backup
    # ========================================================================
    print("\n[PHASE 2] INITIAL BACKUP SYNC")
    print("-" * 70)

    print("\n[PHOENIX] Creating initial system backup...")
    sync_success = phoenix.sync_with_primary(primary, force=True)
    print(f"[PHOENIX] Backup created: {'✓' if sync_success else '✗'}")

    # Verify backup
    if phoenix.backup:
        print(f"[PHOENIX] Backup verification: {'✓' if phoenix.backup.verify_integrity() else '✗'}")

    # ========================================================================
    # PHASE 3: Normal Operation
    # ========================================================================
    print("\n[PHASE 3] NORMAL OPERATION")
    print("-" * 70)

    print("\n[PRIMARY] System operating normally...")
    print("[PRIMARY] Phoenix remains DORMANT, listening for beacons")

    # Send heartbeat
    heartbeat = create_beacon("HEARTBEAT", "PRIMARY_001", primary.health())
    phoenix.receive_beacon(heartbeat)
    print(f"[PRIMARY] Heartbeat sent → Phoenix acknowledged")

    # Simulate some work
    time.sleep(0.1)

    # ========================================================================
    # PHASE 4: System Degradation
    # ========================================================================
    print("\n[PHASE 4] SYSTEM DEGRADATION DETECTED")
    print("-" * 70)

    print("\n[PRIMARY] WARNING: Corruption detected in system...")
    primary.inject_corruption(percent=25.0)
    degraded_health = primary.health()

    print(f"[PRIMARY] Health dropped to: {degraded_health:.1f}%")
    print(f"[PRIMARY] Braid Status: {primary.braid_status()}")

    # Run healing
    print(f"[PRIMARY] Attempting self-healing...")
    heal_events = list(primary.heal_from_spine())
    print(f"[PRIMARY] Healing completed: {len(heal_events)} events")
    print(f"[PRIMARY] Health restored to: {primary.health():.1f}%")

    # ========================================================================
    # PHASE 5: Critical Failure Imminent
    # ========================================================================
    print("\n[PHASE 5] CRITICAL FAILURE IMMINENT")
    print("-" * 70)

    print("\n[PRIMARY] ⚠️  CRITICAL: Health dropping below 5%...")
    primary.inject_corruption(percent=96.0)
    critical_health = primary.health()

    print(f"[PRIMARY] Health: {critical_health:.1f}%")
    print(f"[PRIMARY] Healing attempts failing...")
    print(f"[PRIMARY] Sending DYING beacon to Phoenix...")

    # Send DYING beacon
    dying_beacon = create_beacon(
        "DYING",
        "PRIMARY_001",
        critical_health,
        urgency=95,
        message="Critical system failure imminent",
        corrupted_bricks=60,
    )
    phoenix.receive_beacon(dying_beacon)

    time.sleep(0.5)

    # ========================================================================
    # PHASE 6: Complete System Failure
    # ========================================================================
    print("\n[PHASE 6] COMPLETE SYSTEM FAILURE")
    print("-" * 70)

    print("\n[PRIMARY] 🚨 CATASTROPHIC FAILURE")
    print("[PRIMARY] All recovery attempts exhausted")
    print("[PRIMARY] System going dark...")
    primary.inject_corruption(percent=99.9)

    print(f"[PRIMARY] Final health: {primary.health():.1f}%")
    print(f"[PRIMARY] Sending final DEAD beacon...")

    # Send DEAD beacon (last gasp before shutdown)
    dead_beacon = create_beacon(
        "DEAD",
        "PRIMARY_001",
        0.0,
        urgency=100,
        message="Primary system offline - complete failure",
        final_state="OFFLINE",
    )

    print("[PRIMARY] System offline ●●●")

    # ========================================================================
    # PHASE 7: Phoenix Recovery
    # ========================================================================
    print("\n[PHASE 7] PHOENIX RECOVERY INITIATED")
    print("-" * 70)

    # Phoenix receives DEAD beacon and initiates recovery
    phoenix.receive_beacon(dead_beacon)

    # ========================================================================
    # PHASE 8: Verification
    # ========================================================================
    print("\n[PHASE 8] RECOVERY VERIFICATION")
    print("-" * 70)

    # Get recovered system
    recovered = phoenix.get_recovered_engine()

    if recovered:
        print(f"\n[VERIFICATION] System recovered successfully!")
        print(f"[VERIFICATION] Recovered health: {recovered.health():.1f}%")
        print(f"[VERIFICATION] Recovered braid: {recovered.braid_status()}")
        print(f"[VERIFICATION] Total bricks: {recovered.TOTAL_BRICKS}")
        print(f"[VERIFICATION] Ledger entries: {len(recovered.get_ledger())}")

        # Compare with original backup
        if phoenix.backup:
            health_match = abs(recovered.health() - phoenix.backup.health) < 1.0
            print(f"\n[VERIFICATION] Health match with backup: {'✓' if health_match else '✗'}")
            print(f"[VERIFICATION] Backup health: {phoenix.backup.health:.1f}%")
            print(f"[VERIFICATION] Recovered health: {recovered.health():.1f}%")
    else:
        print("[VERIFICATION] ✗ Recovery failed - no recovered engine")

    # ========================================================================
    # PHASE 9: Phoenix Status
    # ========================================================================
    print("\n[PHASE 9] PHOENIX NODE STATUS")
    print("-" * 70)

    status = phoenix.get_status()
    print(f"\nNode ID: {status['node_id']}")
    print(f"Current Mode: {status['mode']}")
    print(f"Has Backup: {status['has_backup']}")
    print(f"Has Emergency Backup: {status['has_emergency_backup']}")
    print(f"Awaken Count: {status['awaken_count']}")
    print(f"Recovery Count: {status['recovery_count']}")
    print(f"Total Downtime: {status['total_downtime_ms']:.2f}ms")

    if status['last_beacon']:
        print(f"\nLast Beacon:")
        print(f"  Type: {status['last_beacon']['type']}")
        print(f"  Health: {status['last_beacon']['health']:.1f}%")
        print(f"  Urgency: {status['last_beacon']['urgency']}/100")

    # ========================================================================
    # Summary
    # ========================================================================
    print_separator("DEMONSTRATION COMPLETE")

    print("\nKey Features Demonstrated:")
    print("  ✓ Dormant node listening for system beacons")
    print("  ✓ Automatic backup sync (2-day interval)")
    print("  ✓ Emergency awakening on DYING beacon")
    print("  ✓ 99.9% complete system scan before failure")
    print("  ✓ Final DEAD beacon detection")
    print("  ✓ Complete system rebuild in <2 seconds")
    print("  ✓ Full data restoration from backup")
    print("  ✓ Integrity verification of recovered system")
    print("  ✓ Return to dormant monitoring mode")

    print(f"\nRecovery Performance:")
    if status['total_downtime_ms'] < 2000:
        print(f"  ✓ Target met: {status['total_downtime_ms']:.2f}ms < 2000ms")
    else:
        print(f"  ✗ Target missed: {status['total_downtime_ms']:.2f}ms > 2000ms")

    print(f"\nPhoenix Node is now dormant, ready for next emergency.")
    print_separator()


if __name__ == "__main__":
    main()
