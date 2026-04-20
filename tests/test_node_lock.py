"""Tests for Node-level lock protection."""

from __future__ import annotations

import pytest

from kernel.SB688_ENGINE import SB688Engine
from nodes.node import Node
from tests.conftest import TEST_ACCESS_CODE


def test_node_get_state_respects_lock() -> None:
    """Test that Node.get_state() respects the sensitive access lock."""
    engine = SB688Engine()
    node = Node(0, engine, [])

    # Default state should not include sensitive data
    state = node.get_state()
    assert state["bricks"][0]["data"] == "LOCKED"

    # Should fail without unlock
    with pytest.raises(PermissionError):
        node.get_state(include_sensitive=True)

    # Unlock and verify sensitive data is accessible
    assert engine.unlock_sensitive_access(TEST_ACCESS_CODE)
    sensitive_state = node.get_state(include_sensitive=True)
    assert sensitive_state["bricks"][0]["data"] != "LOCKED"
    assert bytes.fromhex(sensitive_state["bricks"][0]["data"])


def test_node_sync_state_requires_lock() -> None:
    """Test that sync_state_with_peers requires sensitive access."""
    nodes = [Node(i, SB688Engine(), []) for i in range(3)]
    for n in nodes:
        n.join_network([nd for nd in nodes if nd.node_id != n.node_id])

    # Should fail without unlock
    with pytest.raises(PermissionError, match="sync_state_with_peers requires sensitive access"):
        nodes[0].sync_state_with_peers()

    # Should succeed after unlock
    for n in nodes:
        n.engine.unlock_sensitive_access(TEST_ACCESS_CODE)

    # Now should work
    result = nodes[0].sync_state_with_peers()
    assert result is False  # No changes needed as all are healthy


def test_node_apply_brick_state_requires_lock() -> None:
    """Test that apply_brick_state requires sensitive access."""
    engine = SB688Engine()
    node = Node(0, engine, [])

    brick_state = {
        "state": "operational",
        "data": engine.bricks[0].get_data().hex()
    }

    # Should fail without unlock
    with pytest.raises(PermissionError, match="apply_brick_state requires sensitive access"):
        node.apply_brick_state(0, brick_state)

    # Should succeed after unlock
    assert engine.unlock_sensitive_access(TEST_ACCESS_CODE)
    node.apply_brick_state(0, brick_state)
    assert engine.bricks[0].state == "operational"


def test_node_participate_in_healing_requires_lock() -> None:
    """Test that participate_in_healing requires sensitive access."""
    nodes = [Node(i, SB688Engine(), []) for i in range(2)]
    for n in nodes:
        n.join_network([nd for nd in nodes if nd.node_id != n.node_id])

    nodes[0].engine.bricks[0].corrupt()
    contaminated = {0}

    # Should fail without unlock
    with pytest.raises(PermissionError, match="participate_in_healing requires sensitive access"):
        nodes[0].participate_in_healing(contaminated)

    # Should succeed after unlock
    for n in nodes:
        n.engine.unlock_sensitive_access(TEST_ACCESS_CODE)

    nodes[0].participate_in_healing(contaminated)
    # Brick should be healed from peer
    assert nodes[0].engine.bricks[0].state == "operational"


def test_node_heartbeat_requires_lock() -> None:
    """Test that heartbeat (which calls sync_state_with_peers) requires sensitive access."""
    nodes = [Node(i, SB688Engine(), []) for i in range(3)]
    for n in nodes:
        n.join_network([nd for nd in nodes if nd.node_id != n.node_id])

    # heartbeat calls sync_state_with_peers, which requires lock
    with pytest.raises(PermissionError, match="sync_state_with_peers requires sensitive access"):
        nodes[0].heartbeat()

    # Should succeed after unlock
    for n in nodes:
        n.engine.unlock_sensitive_access(TEST_ACCESS_CODE)

    nodes[0].heartbeat()  # Should not raise
