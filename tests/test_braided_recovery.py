from __future__ import annotations

import time

from kernel.SB688_ENGINE import SB688Engine
from nodes.node import Node


def test_5_node_braided_recovery() -> None:
    nodes = [Node(i, SB688Engine(), []) for i in range(5)]
    for n in nodes:
        n.join_network([nd for nd in nodes if nd.node_id != n.node_id])

    for n in nodes:
        assert n.get_state()["health"] == 100.0

    nodes[0].engine.inject_corruption(percent=99.8)
    assert nodes[0].get_state()["health"] < 1.0

    nodes[0].report_corruption(brick_id=1)

    for i in range(1, 5):
        assert nodes[i].engine.detect_corruption()

    start = time.time()
    for node in nodes:
        for _ in node.engine.heal_from_spine():
            pass
    heal_time = time.time() - start

    for n in nodes:
        assert n.get_state()["health"] == 100.0

    assert heal_time < 2.0


def test_node_failure_doesnt_stop_healing() -> None:
    nodes = [Node(i, SB688Engine(), []) for i in range(5)]
    for n in nodes:
        n.join_network([nd for nd in nodes if nd.node_id != n.node_id])

    nodes[4].join_network([])

    nodes[0].engine.inject_corruption(percent=99.8)

    for node in nodes[:4]:
        for _ in node.engine.heal_from_spine():
            pass

    for n in nodes[:4]:
        assert n.get_state()["health"] == 100.0
