from __future__ import annotations

from collections import Counter
from typing import Any

from kernel.SB688_ENGINE import SB688Engine


class Node:
    def __init__(self, node_id: int, engine: SB688Engine, peers: list["Node"]) -> None:
        self.node_id = node_id
        self.engine = engine
        self.peers = peers

    def join_network(self, peers: list["Node"]) -> None:
        self.peers = peers

    def get_state(self) -> dict[str, Any]:
        state = self.engine.get_state()
        state["node_id"] = self.node_id
        return state

    def sync_state_with_peers(self) -> bool:
        active_nodes = [self] + [p for p in self.peers if p.peers or p is self]
        if len(active_nodes) < 3:
            return False

        changed = False
        for brick_id in range(self.engine.TOTAL_BRICKS):
            checksums = [n.engine.bricks[brick_id].checksum() for n in active_nodes]
            checksum, votes = Counter(checksums).most_common(1)[0]
            if votes < 3:
                continue
            if self.engine.bricks[brick_id].checksum() != checksum:
                source = next(n for n in active_nodes if n.engine.bricks[brick_id].checksum() == checksum)
                self.engine.bricks[brick_id].set_data(source.engine.bricks[brick_id].get_data())
                changed = True
        return changed

    def apply_brick_state(self, brick_id: int, state: dict[str, Any]) -> None:
        if "data" in state:
            self.engine.bricks[brick_id].set_data(bytes.fromhex(state["data"]))
        self.engine.bricks[brick_id].state = state.get("state", self.engine.bricks[brick_id].state)

    def heartbeat(self) -> None:
        self.sync_state_with_peers()

    def participate_in_healing(self, contaminated: set[int]) -> None:
        for brick_id in sorted(contaminated):
            for peer in self.peers:
                peer_brick = peer.engine.bricks[brick_id]
                if peer_brick.state == "operational":
                    self.engine.bricks[brick_id].set_data(peer_brick.get_data())
                    break

    def report_corruption(self, brick_id: int) -> None:
        for peer in self.peers:
            peer.engine.bricks[brick_id].corrupt()
            peer.engine._braid_a = "RED"
            peer.engine._braid_b = "RED"

    def get_braid_path_status(self) -> str:
        return "GREEN" if self.engine.braid_status() == "GREEN" else "RED"
