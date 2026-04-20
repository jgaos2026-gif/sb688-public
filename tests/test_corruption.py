from __future__ import annotations

import time

import pytest

from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate, VeraBlockedError


def test_inject_99_8_percent_corruption() -> None:
    engine = SB688Engine()
    assert engine.health() == 100.0

    engine.inject_corruption(percent=99.8)
    assert engine.health() < 1.0
    assert engine.braid_status() == "RED"

    start = time.time()
    is_corrupted = engine.detect_corruption()
    detect_time = time.time() - start
    assert is_corrupted
    assert detect_time < 0.1

    start = time.time()
    events = list(engine.heal_from_spine())
    heal_time = time.time() - start
    assert all(e.phase in ["ISOLATE", "ROLLBACK", "HEAL", "VERIFY", "COMPLETE"] for e in events)

    assert engine.health() == 100.0
    assert engine.braid_status() == "GREEN"
    assert heal_time < 2.0

    ledger = engine.get_ledger()
    assert len(ledger) >= 60
    assert ledger[-1]["phase"] == "COMPLETE"


def test_no_data_loss() -> None:
    engine = SB688Engine()

    before = engine.get_state()

    engine.inject_corruption(percent=99.8)
    for _ in engine.heal_from_spine():
        pass

    after = engine.get_state()

    for i in range(64):
        assert before["bricks"][i]["checksum"] == after["bricks"][i]["checksum"]

    vera = VERAGate()
    assert vera.verify_ledger_chain(engine.get_ledger())


def test_vera_blocks_unsafe_commit() -> None:
    engine = SB688Engine()
    vera = VERAGate()

    engine.inject_corruption(percent=75)

    with pytest.raises(VeraBlockedError):
        vera.can_commit_state(engine.get_state())

    for _ in engine.heal_from_spine():
        pass
    assert vera.can_commit_state(engine.get_state())


def test_sensitive_state_and_export_locked_by_code() -> None:
    engine = SB688Engine()

    state = engine.get_state()
    assert state["bricks"][0]["data"] == "LOCKED"

    with pytest.raises(PermissionError):
        engine.get_state(include_sensitive=True)

    with pytest.raises(PermissionError):
        engine.export_proof(format="json")

    assert not engine.unlock_sensitive_access("bad-code")
    assert engine.unlock_sensitive_access("1211")

    unlocked_state = engine.get_state(include_sensitive=True)
    assert unlocked_state["bricks"][0]["data"] != "LOCKED"
    assert engine.export_proof(format="json").startswith("[")
