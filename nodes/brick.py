from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field


@dataclass
class Brick:
    brick_id: int
    state: str = "operational"
    timestamp: float = field(default_factory=time.time)

    def __post_init__(self) -> None:
        seed = hashlib.sha256(f"brick:{self.brick_id}".encode("utf-8")).digest()
        self._data = seed
        self._last_good = self._data
        self._checksum = self.checksum()

    def checksum(self) -> str:
        return hashlib.sha256(self._data).hexdigest()

    def corrupt(self) -> None:
        blob = bytearray(self._data)
        if blob:
            blob[0] ^= 0xFF
        self._data = bytes(blob)
        self.state = "corrupted"
        self.timestamp = time.time()

    def heal(self) -> None:
        self._data = self._last_good
        self._checksum = self.checksum()
        self.state = "operational"
        self.timestamp = time.time()

    def verify(self) -> bool:
        if self.state not in {"operational", "corrupted", "healing"}:
            return False
        if self.state == "corrupted":
            return self.checksum() != self._checksum
        return self.checksum() == self._checksum

    def get_data(self) -> bytes:
        return self._data

    def set_data(self, data: bytes) -> None:
        self._data = data
        self._last_good = data
        self._checksum = self.checksum()
        self.state = "operational"
        self.timestamp = time.time()
