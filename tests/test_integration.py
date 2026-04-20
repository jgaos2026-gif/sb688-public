"""Integration tests for the complete SB-688 system."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate
from kernel.LEDGER_STORE import LedgerStore
from nodes.brick import Brick
from nodes.node import Node


def test_full_system_lifecycle():
    """Test complete system lifecycle: init -> corrupt -> detect -> heal -> verify."""
    engine = SB688Engine()
    vera = VERAGate()

    # Phase 1: Initialize
    initial_health = engine.health()
    assert initial_health == 100.0, "Initial health should be 100%"
    assert engine.braid_status() == "GREEN", "Initial braid should be GREEN"

    # Phase 2: Corrupt
    engine.inject_corruption(percent=75.0)
    corrupted_health = engine.health()
    assert corrupted_health < 50.0, "Health should drop after corruption"
    assert engine.braid_status() == "RED", "Braid should be RED after corruption"

    # Phase 3: Detect
    is_corrupted = engine.detect_corruption()
    assert is_corrupted, "Corruption should be detected"

    # Phase 4: Heal
    events = list(engine.heal_from_spine())
    assert len(events) > 0, "Healing should generate events"

    phases_seen = {event.phase for event in events}
    required_phases = {"ISOLATE", "ROLLBACK", "VERIFY", "COMPLETE"}
    assert required_phases.issubset(phases_seen), f"Missing healing phases: {required_phases - phases_seen}"

    # Phase 5: Verify
    final_health = engine.health()
    assert final_health == 100.0, "Health should be restored to 100%"
    assert engine.braid_status() == "GREEN", "Braid should be GREEN after healing"

    ledger = engine.get_ledger()
    is_valid = vera.verify_ledger_chain(ledger)
    assert is_valid, "Ledger chain should be valid"


def test_brick_isolation():
    """Test that brick failures don't contaminate other bricks."""
    brick1 = Brick(brick_id=1)
    brick2 = Brick(brick_id=2)

    # Corrupt brick1
    brick1.corrupt()

    # brick2 should remain intact
    assert brick2.state == "operational", "Brick 2 should remain operational"
    assert brick2.verify(), "Brick 2 should verify successfully"


def test_vera_gate_integration():
    """Test VERA gate with actual engine."""
    vera = VERAGate()
    engine = SB688Engine()

    # Test scanning for anomalies in healthy engine
    anomalies = vera.scan_for_anomalies(engine)
    assert len(anomalies) == 0, "Healthy engine should have no anomalies"

    # Test threshold breach detection
    assert not vera.detect_threshold_breach(1.0), "1.0 (100%) health should not breach threshold"
    assert vera.detect_threshold_breach(0.5), "0.5 (50%) health should breach threshold"

    # Test can_commit_state
    safe_state = {
        "health": 100.0,
        "ledger": [],
        "bricks": {},
    }
    assert vera.can_commit_state(safe_state), "Safe state should be committable"


def test_ledger_append_only():
    """Test that ledger maintains append-only invariant."""
    ledger_store = LedgerStore()

    # Append some events
    event1_id = ledger_store.append({
        "event_type": "TEST",
        "message": "Test event 1",
        "data": {"test": True},
    })
    event2_id = ledger_store.append({
        "event_type": "TEST",
        "message": "Test event 2",
        "data": {"test": True},
    })

    assert event1_id, "Event 1 should have an ID"
    assert event2_id, "Event 2 should have an ID"

    # Verify chain
    ledger = ledger_store.get_all()
    assert len(ledger) >= 2, "Ledger should contain at least 2 events"

    # Verify hash chain
    for i in range(1, len(ledger)):
        current = ledger[i]
        assert "previous_hash" in current, "Each entry should have previous_hash"
        assert current["previous_hash"] != "GENESIS" or i == 0, "Only first entry can have GENESIS"

    # Verify chain integrity
    assert ledger_store.verify_chain(), "Ledger chain should be valid"


def test_kernel_manifest_integrity():
    """Test kernel manifest exists and is valid."""
    manifest_path = Path(__file__).parents[1] / "kernel" / "KERNEL_MANIFEST.json"
    assert manifest_path.exists(), "Kernel manifest should exist"

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    required_keys = ["kernel_version", "creation_date", "checksum_sha256", "self_contained"]
    for key in required_keys:
        assert key in manifest, f"Manifest missing required key: {key}"

    assert manifest["self_contained"], "Kernel should be self-contained"


def test_node_state_management():
    """Test node state management and peer coordination."""
    engine = SB688Engine()
    node = Node(node_id=1, engine=engine, peers=[2, 3, 4])

    state = node.get_state()
    assert "node_id" in state, "State should include node_id"
    assert "health" in state, "State should include health"
    assert "braid_status" in state, "State should include braid_status"
    assert state["node_id"] == 1, "Node ID should match"


def test_export_proof():
    """Test proof export in multiple formats."""
    engine = SB688Engine()

    # Generate some events
    engine.inject_corruption(percent=10.0)
    list(engine.heal_from_spine())

    # Export JSON
    json_proof = engine.export_proof(format="json")
    json_data = json.loads(json_proof)
    assert isinstance(json_data, list), "JSON proof should be a list"
    assert len(json_data) > 0, "JSON proof should contain events"

    # Export CSV
    csv_proof = engine.export_proof(format="csv")
    assert "timestamp" in csv_proof, "CSV should contain timestamp header"
    assert "\n" in csv_proof, "CSV should have multiple lines"


def test_system_prompt_exists():
    """Test that system prompt file exists and is readable."""
    prompt_path = Path(__file__).parents[1] / "examples" / "sb688_system_prompt.txt"
    assert prompt_path.exists(), "System prompt should exist"

    content = prompt_path.read_text(encoding="utf-8")
    assert "SB-688" in content, "System prompt should mention SB-688"
    assert "MISSION" in content, "System prompt should define mission"
    assert "VERA" in content, "System prompt should mention VERA"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
