"""
BRICK_A_SEED — Golden Image, Read Only.

The seed is the only truth when the pulse fails.  It is forged once,
checksum-locked, and exposed as a deep-frozen, immutable artifact.
"""

import hashlib
import json
import time
from copy import deepcopy
from typing import Any, Dict


def _stable_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def _hash_of(data: Any) -> str:
    if isinstance(data, (dict, list)):
        data = _stable_json(data)
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


def _deep_freeze(obj: Any) -> Any:
    """Return a recursively tuple-frozen version of a dict/list/scalar."""
    if isinstance(obj, dict):
        return {k: _deep_freeze(v) for k, v in sorted(obj.items())}
    if isinstance(obj, list):
        return tuple(_deep_freeze(v) for v in obj)
    return obj


class SeedBrick:
    """BRICK_A_SEED — Golden Image, Read Only."""

    IDENT = "BRICK_A_SEED"
    STATE = "STATIC_HARDENED"
    RECOVERY_POINTER = "0x8000"

    def __init__(self, state: Dict[str, Any]) -> None:
        frozen = _deep_freeze(state)
        checksum = _hash_of(_stable_json(frozen))
        self._image: Dict[str, Any] = {
            "recovery_pointer": self.RECOVERY_POINTER,
            "checksum": checksum,
            "state": deepcopy(state),
            "forged_at": time.time(),
        }

    def golden(self) -> Dict[str, Any]:
        """Return the read-only golden image (a copy)."""
        return deepcopy(self._image)

    def verify(self, candidate: Dict[str, Any]) -> bool:
        """Verify a candidate state payload matches the sealed checksum."""
        frozen = _deep_freeze(candidate)
        return _hash_of(_stable_json(frozen)) == self._image["checksum"]

    def self_check(self) -> bool:
        """Self-check the seed has not been tampered with in memory."""
        frozen = _deep_freeze(self._image["state"])
        return _hash_of(_stable_json(frozen)) == self._image["checksum"]
