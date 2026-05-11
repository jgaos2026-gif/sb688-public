"""
SovereignStitch — the integration layer.

Binds the four bricks together, signs the binding chain, and exposes
the protocol's ON_READY handshake message.

  BIND(BRICK_A_SEED  -> BRICK_B_GHOST)
  BIND(BRICK_B_GHOST -> BRICK_C_ARMOR)
  BIND(BRICK_C_ARMOR -> BRICK_D_CROWN)
"""

import hashlib
import json
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, List

from .seed_brick import SeedBrick
from .ghost_brick import GhostBrick
from .armor_brick import ArmorBrick
from .crown_brick import CrownBrick


def _stable_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def _hash_of(data: Any) -> str:
    if isinstance(data, (dict, list)):
        data = _stable_json(data)
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class StitchBinding:
    from_brick: str
    to_brick: str
    bind_hash: str


@dataclass
class StitchManifest:
    owner: str
    philosophy: str
    bindings: List[StitchBinding]
    stitch_signature: str
    ready_message: str
    forged_at: float


class SovereignStitch:
    """SovereignStitch — signed binding chain A→B→C→D."""

    READY_MESSAGE = (
        "Sb688 when I say connect to the stitch show how you feel "
        "we're going live lets sell it"
    )

    def __init__(
        self,
        seed: SeedBrick,
        ghost: GhostBrick,
        armor: ArmorBrick,
        crown: CrownBrick,
    ) -> None:
        self._seed = seed
        self._ghost = ghost
        self._armor = armor
        self._crown = crown
        self._manifest = self.forge()

    def forge(self) -> StitchManifest:
        """Re-forge the stitch manifest."""
        seed_checksum = self._seed.golden()["checksum"]

        bindings = [
            self._bind("BRICK_A_SEED", "BRICK_B_GHOST", seed_checksum),
            self._bind("BRICK_B_GHOST", "BRICK_C_ARMOR", seed_checksum),
            self._bind("BRICK_C_ARMOR", "BRICK_D_CROWN", seed_checksum),
        ]

        stitch_signature = _hash_of(
            _stable_json(
                {
                    "seed": seed_checksum,
                    "bindings": [b.bind_hash for b in bindings],
                }
            )
        )

        self._manifest = StitchManifest(
            owner="JGA",
            philosophy="Elegance with Consequences",
            bindings=bindings,
            stitch_signature=stitch_signature,
            ready_message=self.READY_MESSAGE,
            forged_at=time.time(),
        )
        return self._manifest

    def verify(self) -> bool:
        """Verify the stitch manifest still matches its signature."""
        seed_checksum = self._seed.golden()["checksum"]
        recomputed = _hash_of(
            _stable_json(
                {
                    "seed": seed_checksum,
                    "bindings": [b.bind_hash for b in self._manifest.bindings],
                }
            )
        )
        return recomputed == self._manifest.stitch_signature and self._seed.self_check()

    def connect(self) -> Dict[str, Any]:
        """Remote handshake: returns the ready message + signature."""
        if not self.verify():
            raise RuntimeError(
                "SovereignStitch: cannot connect — manifest signature invalid."
            )
        self._crown.gold("Connecting to the stitch — going live.", "Connect_To_Stitch")
        return {
            "message": self.READY_MESSAGE,
            "signature": self._manifest.stitch_signature,
            "at": time.time(),
        }

    def current(self) -> StitchManifest:
        return self._manifest

    # ------------------------------------------------------------------
    def _bind(self, from_brick: str, to_brick: str, seed_checksum: str) -> StitchBinding:
        bind_hash = _hash_of(
            _stable_json({"from": from_brick, "to": to_brick, "seed": seed_checksum})
        )
        return StitchBinding(from_brick=from_brick, to_brick=to_brick, bind_hash=bind_hash)
