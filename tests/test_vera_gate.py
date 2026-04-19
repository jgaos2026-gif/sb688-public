from __future__ import annotations

import pytest

from kernel.SB688_ENGINE import SB688Engine
from kernel.VERA_GATE_RUNTIME import VERAGate, VeraBlockedError


def test_vera_scan_and_threshold() -> None:
    engine = SB688Engine()
    vera = VERAGate()

    assert vera.scan_for_anomalies(engine) == []
    assert not vera.detect_threshold_breach(engine.health())

    engine.inject_corruption(percent=99.8)
    anomalies = vera.scan_for_anomalies(engine)
    assert len(anomalies) > 0
    assert vera.detect_threshold_breach(engine.health())


def test_vera_blocks_and_override() -> None:
    engine = SB688Engine()
    engine.inject_corruption(percent=75)

    with pytest.raises(VeraBlockedError):
        VERAGate().can_commit_state(engine.get_state())

    assert VERAGate(owner_approved=True).can_commit_state(engine.get_state())
