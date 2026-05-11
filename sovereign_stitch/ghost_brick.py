"""
BRICK_B_GHOST — Shadow Mirror Protocol.

Maintains an atomic clone of the live state every cycle.  The latest
shadow frame is the pointer-flip target the armor daemon swaps to
during sub-ms resurrection.
"""

import hashlib
import json
import time
from collections import deque
from copy import deepcopy
from typing import Any, Deque, Dict, Optional


def _stable_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def _hash_of(data: Any) -> str:
    if isinstance(data, (dict, list)):
        data = _stable_json(data)
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


class ShadowFrame:
    """An immutable snapshot of a single mirror cycle."""

    def __init__(self, cycle: int, state: Dict[str, Any], latency_ms: float) -> None:
        self.cycle = cycle
        self.state = deepcopy(state)
        self.mirror_hash = _hash_of(_stable_json(state))
        self.captured_at = time.time()
        self.latency_ms = latency_ms

    def __repr__(self) -> str:
        return f"ShadowFrame(cycle={self.cycle}, hash={self.mirror_hash[:12]}…, latency={self.latency_ms:.4f}ms)"


class GhostBrick:
    """BRICK_B_GHOST — Shadow Mirror Protocol."""

    IDENT = "BRICK_B_GHOST"
    STATE = "DORMANT_LIVE"
    TARGET_LATENCY_MS = 0.0001

    def __init__(self, max_frames: int = 8) -> None:
        self._frames: Deque[ShadowFrame] = deque(maxlen=max_frames)
        self._cycle = 0

    def mirror(self, live_state: Dict[str, Any]) -> ShadowFrame:
        """Atomically clone the supplied live state into a new shadow frame."""
        start = time.perf_counter()
        cloned = deepcopy(live_state)
        latency_ms = (time.perf_counter() - start) * 1000.0

        self._cycle += 1
        frame = ShadowFrame(self._cycle, cloned, latency_ms)
        self._frames.append(frame)
        return frame

    def latest(self) -> Optional[ShadowFrame]:
        """Latest shadow frame, or None if no mirror has run yet."""
        if not self._frames:
            return None
        return self._frames[-1]

    def history(self) -> list:
        """Return the bounded ring of shadow frames."""
        return list(self._frames)

    def pointer_flip(self) -> ShadowFrame:
        """Return the most recent frame for resurrection."""
        frame = self.latest()
        if frame is None:
            raise RuntimeError("GhostBrick: pointer flip requested before any mirror cycle.")
        return frame
