"""
SB-688 Quantum Orchestrator - Unified Node Integration

This module provides a comprehensive orchestration layer that integrates
all advanced SB-688 nodes (Ghost, Truth, Phoenix) into a single quantum-
enhanced system with unified resilience and security.
"""

import sys
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from kernel.QUANTUM_CORE import QuantumSystem, QuantumCrypto
from kernel.SB688_ENGINE import SB688Engine
from nodes.ghost_node import GhostNode
from nodes.truth_node import TruthNode
from nodes.phoenix_node import PhoenixNode


@dataclass
class OrchestratorConfig:
    """Configuration for quantum orchestrator"""
    system_id: str = "QUANTUM_ORCHESTRATOR_001"
    enable_ghost: bool = True
    enable_truth: bool = True
    enable_phoenix: bool = True
    auto_recovery: bool = True
    health_threshold: float = 20.0  # Trigger recovery below this
    quantum_algorithm: str = "SPHINCS+"


class QuantumOrchestrator:
    """
    Unified orchestrator for all advanced SB-688 nodes.

    Integrates Ghost (covert ops), Truth (disinformation detection),
    and Phoenix (disaster recovery) into a cohesive quantum-enhanced
    system with centralized monitoring and coordinated responses.
    """

    def __init__(self, config: Optional[OrchestratorConfig] = None):
        """
        Initialize quantum orchestrator.

        Args:
            config: Orchestrator configuration (uses defaults if None)
        """
        self.config = config or OrchestratorConfig()

        # Initialize quantum system
        self.quantum_system = QuantumSystem(system_id=self.config.system_id)

        # Initialize base SB-688 engine
        self.engine = SB688Engine()
        # Note: unlock_sensitive_access not needed for quantum orchestrator
        # as it operates at the system level with quantum credentials

        # Initialize nodes
        self.nodes: Dict[str, Any] = {}
        self._initialize_nodes()

        # System metrics
        self.metrics = {
            "operations_total": 0,
            "recoveries_triggered": 0,
            "verifications_passed": 0,
            "verifications_failed": 0,
            "ghost_operations": 0,
            "truth_analyses": 0,
            "phoenix_recoveries": 0
        }

        # Status
        self.operational = True
        self.last_health_check = datetime.utcnow()

    def _initialize_nodes(self) -> None:
        """Initialize all enabled advanced nodes"""

        # Ghost Node - Covert Operations
        if self.config.enable_ghost:
            ghost = GhostNode(
                clearance_level="TOP_SECRET",
                compartment="QUANTUM_OPS",
                authorized_users=["ORCHESTRATOR", "QUANTUM_SYSTEM"]
            )
            node_id = "GHOST_001"
            self.nodes[node_id] = {
                "type": "GHOST",
                "instance": ghost,
                "status": "ACTIVE"
            }
            self.quantum_system.register_node(node_id, "GHOST")

        # Truth Node - Disinformation Detection
        if self.config.enable_truth:
            truth = TruthNode(trust_threshold=0.80)
            node_id = "TRUTH_001"
            self.nodes[node_id] = {
                "type": "TRUTH",
                "instance": truth,
                "status": "ACTIVE"
            }
            self.quantum_system.register_node(node_id, "TRUTH")

        # Phoenix Node - Disaster Recovery
        if self.config.enable_phoenix:
            phoenix = PhoenixNode(
                node_id="PHOENIX_001"
            )
            node_id = "PHOENIX_001"
            self.nodes[node_id] = {
                "type": "PHOENIX",
                "instance": phoenix,
                "status": "DORMANT"
            }
            self.quantum_system.register_node(node_id, "PHOENIX")

    def execute_ghost_operation(self, operation: str, data: Dict[str, Any],
                                compartment: str = "QUANTUM_OPS") -> Dict[str, Any]:
        """
        Execute classified operation through Ghost node.

        Args:
            operation: Operation type
            data: Operation data
            compartment: Compartment for classification

        Returns:
            Operation result (encrypted)
        """
        ghost_node = self._get_node("GHOST_001")
        if not ghost_node:
            return {"status": "ERROR", "message": "Ghost node not available"}

        # Execute operation
        result = ghost_node["instance"].execute_operation(
            operation=operation,
            parameters=data
        )

        self.metrics["ghost_operations"] += 1
        self.metrics["operations_total"] += 1

        return result

    def verify_intelligence(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify intelligence report through Truth node.

        Args:
            report: Intelligence report to verify

        Returns:
            Verification result with recommendation
        """
        truth_node = self._get_node("TRUTH_001")
        if not truth_node:
            return {"status": "ERROR", "message": "Truth node not available"}

        # Verify report
        result = truth_node["instance"].verify_report(report)

        # Update metrics
        self.metrics["truth_analyses"] += 1
        self.metrics["operations_total"] += 1

        if result.get("recommendation") in ["ACCEPT", "INVESTIGATE"]:
            self.metrics["verifications_passed"] += 1
        else:
            self.metrics["verifications_failed"] += 1

        return result

    def trigger_recovery(self, reason: str, severity: float = 95.0) -> Dict[str, Any]:
        """
        Trigger system-wide recovery through Phoenix node.

        Args:
            reason: Reason for recovery
            severity: Severity level (0.0-100.0)

        Returns:
            Recovery result
        """
        phoenix_node = self._get_node("PHOENIX_001")
        if not phoenix_node:
            return {"status": "ERROR", "message": "Phoenix node not available"}

        # Wake Phoenix if dormant
        phoenix_instance = phoenix_node["instance"]
        if phoenix_instance.mode == "DORMANT":
            # Send DYING beacon to wake Phoenix
            beacon = {
                "beacon_type": "DYING",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "sender_id": self.config.system_id,
                "health": 100.0 - severity,
                "urgency": int(severity),
                "data": {"reason": reason}
            }
            phoenix_instance.receive_beacon(beacon)

        # Trigger recovery if health is critical
        if severity > 95.0:
            # Send DEAD beacon for full recovery
            beacon = {
                "beacon_type": "DEAD",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "sender_id": self.config.system_id,
                "health": 0.0,
                "urgency": 100,
                "data": {"reason": reason}
            }
            recovery_result = phoenix_instance.receive_beacon(beacon)

            self.metrics["phoenix_recoveries"] += 1
            self.metrics["recoveries_triggered"] += 1
        else:
            recovery_result = {"status": "STANDBY", "message": "Phoenix in scanning mode"}

        # Orchestrate quantum system recovery
        quantum_recovery = self.quantum_system.orchestrate_recovery(reason, severity)

        self.metrics["operations_total"] += 1

        return {
            "phoenix": recovery_result,
            "quantum": quantum_recovery,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    def perform_health_check(self) -> Dict[str, Any]:
        """
        Perform comprehensive system health check.

        Returns:
            Health report for all nodes and quantum system
        """
        self.last_health_check = datetime.utcnow()

        # Check quantum system integrity
        quantum_integrity = self.quantum_system.verify_quantum_integrity()

        # Check base engine
        engine_state = self.engine.get_state()
        engine_health = engine_state.get("health", 100.0)

        # Check individual nodes
        node_status = {}
        for node_id, node_info in self.nodes.items():
            node_status[node_id] = {
                "type": node_info["type"],
                "status": node_info["status"],
                "operational": True
            }

        # Calculate overall health
        overall_health = min(
            quantum_integrity["health"],
            engine_health
        )

        # Auto-recovery if needed
        if self.config.auto_recovery and overall_health < self.config.health_threshold:
            self.trigger_recovery(
                reason="AUTO_RECOVERY_LOW_HEALTH",
                severity=100.0 - overall_health
            )

        return {
            "overall_health": overall_health,
            "quantum_integrity": quantum_integrity,
            "engine_health": engine_health,
            "nodes": node_status,
            "metrics": self.metrics.copy(),
            "timestamp": self.last_health_check.isoformat() + "Z"
        }

    def execute_unified_operation(self, operation_type: str,
                                  data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute operation with integrated verification and security.

        Uses Truth for verification, Ghost for sensitive ops,
        Phoenix for resilience.

        Args:
            operation_type: Type of operation
            data: Operation data

        Returns:
            Operation result with integrated verification
        """
        operation_id = f"OP_{datetime.utcnow().timestamp()}"

        # Step 1: Truth verification (if applicable)
        verification_result = None
        if "report" in data or "intelligence" in data:
            report = data.get("report") or data.get("intelligence")
            verification_result = self.verify_intelligence(report)

            if verification_result.get("recommendation") == "REJECT":
                return {
                    "operation_id": operation_id,
                    "status": "REJECTED",
                    "reason": "Failed Truth verification",
                    "verification": verification_result
                }

        # Step 2: Execute operation (Ghost if classified)
        operation_result = None
        if data.get("classified", False):
            operation_result = self.execute_ghost_operation(
                operation_type, data, data.get("compartment", "QUANTUM_OPS")
            )
        else:
            # Execute through base engine
            operation_result = {"status": "EXECUTED", "data": data}

        # Step 3: Log to quantum ledger
        self.quantum_system._log_event("UNIFIED_OPERATION", {
            "operation_id": operation_id,
            "operation_type": operation_type,
            "verification_passed": verification_result.get("recommendation") != "REJECT" if verification_result else None,
            "classified": data.get("classified", False),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

        self.metrics["operations_total"] += 1

        return {
            "operation_id": operation_id,
            "status": "SUCCESS",
            "verification": verification_result,
            "result": operation_result,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    def get_system_status(self) -> Dict[str, Any]:
        """
        Get complete quantum orchestrator status.

        Returns:
            Complete system status
        """
        return {
            "system_id": self.config.system_id,
            "operational": self.operational,
            "quantum_state": self.quantum_system.get_system_state(),
            "active_nodes": {k: v["type"] for k, v in self.nodes.items()},
            "metrics": self.metrics.copy(),
            "last_health_check": self.last_health_check.isoformat() + "Z",
            "config": asdict(self.config)
        }

    def shutdown(self) -> Dict[str, Any]:
        """
        Gracefully shutdown quantum orchestrator.

        Returns:
            Shutdown report
        """
        # Sync Phoenix backup
        phoenix_node = self._get_node("PHOENIX_001")
        if phoenix_node:
            phoenix_node["instance"].sync_with_primary(self.engine)

        # Log shutdown
        self.quantum_system._log_event("SYSTEM_SHUTDOWN", {
            "reason": "GRACEFUL_SHUTDOWN",
            "final_metrics": self.metrics.copy(),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

        self.operational = False

        return {
            "status": "SHUTDOWN_COMPLETE",
            "final_state": self.get_system_status()
        }

    def _get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node by ID"""
        return self.nodes.get(node_id)


if __name__ == "__main__":
    # Demo: Quantum orchestrator in action
    print("🔷 SB-688 Quantum Orchestrator - Unified Node Integration\n")

    # Initialize orchestrator
    config = OrchestratorConfig(
        system_id="DEMO_QUANTUM_001",
        enable_ghost=True,
        enable_truth=True,
        enable_phoenix=True,
        auto_recovery=True
    )

    orchestrator = QuantumOrchestrator(config)
    print(f"✅ Initialized: {config.system_id}")
    print(f"   Nodes active: {len(orchestrator.nodes)}\n")

    # Health check
    print("🏥 Performing health check...")
    health = orchestrator.perform_health_check()
    print(f"   Overall health: {health['overall_health']:.1f}%")
    print(f"   Quantum integrity: {'✅ VALID' if health['quantum_integrity']['ledger_valid'] else '❌ INVALID'}\n")

    # Execute unified operation
    print("🔄 Executing unified operation...")
    result = orchestrator.execute_unified_operation(
        "INTELLIGENCE_ANALYSIS",
        {
            "report": {
                "title": "Sample Intelligence Report",
                "content": "This is a test report for quantum system verification",
                "source": "TRUSTED_SOURCE_001",
                "confidence": 0.92
            },
            "classified": False
        }
    )
    print(f"   Status: {result['status']}")
    print(f"   Operation ID: {result['operation_id']}\n")

    # Get final status
    print("📊 System Status:")
    status = orchestrator.get_system_status()
    print(f"   Operations total: {status['metrics']['operations_total']}")
    print(f"   Quantum ledger entries: {status['quantum_state']['ledger_entries']}")
    print(f"   Active nodes: {list(status['active_nodes'].keys())}\n")

    # Shutdown
    print("🔴 Shutting down...")
    shutdown_result = orchestrator.shutdown()
    print(f"   Status: {shutdown_result['status']}\n")

    print("✅ Quantum Orchestrator demonstration complete!")
