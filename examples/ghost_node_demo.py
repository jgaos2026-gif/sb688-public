#!/usr/bin/env python3
"""
Example: Ghost Node for Classified Operations
Demonstrates compartmentalized, self-destructing execution environment.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nodes.ghost_node import GhostNode
import hashlib


def main():
    print("=" * 70)
    print("SB-688 GHOST NODE DEMONSTRATION")
    print("Compartmentalized Execution for Classified Operations")
    print("=" * 70)

    # Create authorized operators (in real scenario, these would be PKI certificates)
    operator_001 = "operator_001"
    operator_002 = "operator_002"
    unauthorized = "intruder_999"

    authorized_users = [
        hashlib.sha256(operator_001.encode()).hexdigest(),
        hashlib.sha256(operator_002.encode()).hexdigest(),
    ]

    # Create ghost node for cyber operations
    print("\n[INITIALIZING] Ghost Node: TOP SECRET // CYBER OPS")
    ghost = GhostNode(
        clearance_level="TOP_SECRET",
        compartment="CYBER_OPS",
        authorized_users=authorized_users,
        mission_directives={
            "objective": "Network reconnaissance and threat assessment",
            "rules_of_engagement": "Passive observation only - no active exploitation",
            "authorization_level": "TIER_1",
            "time_window": "72_hours",
        },
    )

    print(f"[STATUS] Ghost node initialized")
    print(f"         Compartment: {ghost.compartment}")
    print(f"         Clearance: {ghost.clearance_level}")
    print(f"         Isolated: {ghost.isolated}")
    print(f"         Air-gapped: {ghost.air_gapped}")

    # Authorized operation 1: Reconnaissance
    print("\n[OPERATION 1] Authorized reconnaissance by operator_001")
    result1 = ghost.execute_classified_operation(
        user_id=operator_001,
        operation={
            "type": "RECON",
            "target": "adversary_network_segment_alpha",
            "method": "PASSIVE_SCAN",
        },
    )
    print(f"[RESULT] Status: {result1['status']}")
    if result1['status'] == 'SUCCESS':
        print(f"         Operation acknowledged")

    # Authorized operation 2: Threat assessment
    print("\n[OPERATION 2] Threat assessment by operator_002")
    result2 = ghost.execute_classified_operation(
        user_id=operator_002,
        operation={
            "type": "THREAT_ASSESS",
            "indicators": ["suspicious_traffic", "anomalous_behavior"],
            "priority": "HIGH",
        },
    )
    print(f"[RESULT] Status: {result2['status']}")

    # Unauthorized attempt
    print("\n[OPERATION 3] Unauthorized access attempt by intruder")
    result3 = ghost.execute_classified_operation(
        user_id=unauthorized,
        operation={
            "type": "EXFILTRATE",
            "target": "classified_database",
        },
    )
    print(f"[RESULT] Status: {result3['status']}")
    print(f"         Reason: {result3.get('reason', 'N/A')}")

    # Check status after unauthorized attempt
    status = ghost.get_status()
    print(f"\n[SECURITY] Ghost node status after intrusion attempt:")
    print(f"           Health: {status['health']:.1f}%")
    print(f"           Anomaly count: {status['anomaly_count']}")
    print(f"           Compromised: {status['compromised']}")

    # Multiple unauthorized attempts to trigger self-destruct
    print("\n[SIMULATION] Multiple intrusion attempts to demonstrate self-destruct...")
    for i in range(3):
        result = ghost.execute_classified_operation(
            user_id=f"attacker_{i}",
            operation={"type": "ATTACK", "target": "classified_system"},
        )
        print(f"[ATTEMPT {i+1}] Status: {result['status']}, Anomalies: {ghost.anomaly_count}")

        if result['status'] == 'TERMINATED':
            print("\n[ALERT] SELF-DESTRUCT INITIATED")
            print("        All classified data erased")
            print("        Ledger compartment purged")
            print("        Ghost node neutralized")
            break

    # Final status
    final_status = ghost.get_status()
    print(f"\n[FINAL STATUS]")
    print(f"  Compromised: {final_status['compromised']}")
    print(f"  Isolated: {final_status['isolated']}")
    print(f"  Total anomalies: {final_status['anomaly_count']}")

    print("\n" + "=" * 70)
    print("Ghost Node demonstration complete")
    print("Key features demonstrated:")
    print("  ✓ Compartmentalized access control")
    print("  ✓ Encrypted audit trail")
    print("  ✓ Unauthorized access detection")
    print("  ✓ Automatic self-destruct on compromise")
    print("=" * 70)


if __name__ == "__main__":
    main()
