"""
OmegaSupervisor — the Coated AI omni-directive.

  priority:           extreme_hardened
  failure_tolerance:  zero
  resurrection_speed: hardware_interrupt_speed
  loop:               [Verify_Stitch -> Mirror_State -> Monitor_Drift]
  fail_state: kill(corrupted_brick) -> activate(ghost_shadow)
              -> re-stitch(clean_seed) -> signal(crown_gold_flash)
"""

import time
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .seed_brick import SeedBrick
from .ghost_brick import GhostBrick, ShadowFrame
from .armor_brick import ArmorBrick, DriftReport
from .crown_brick import CrownBrick
from .sovereign_stitch import SovereignStitch


TARGETS = {
    "core_os_ram_mb": 32,
    "cpu_chip_gb": 8,
    "hardware_agnostic": True,
    "resurrection_target": "hardware_interrupt_speed",
    "failure_tolerance": "zero",
}


@dataclass
class ResurrectionEvent:
    id: str
    at: float
    from_brick: str
    to_brick: str
    cause: str
    clean_seed_checksum: str
    ghost_mirror_hash: str
    elapsed_ms: float


class OmegaSupervisor:
    """OmegaSupervisor — drives the Verify_Stitch → Mirror_State → Monitor_Drift loop."""

    def __init__(self, seed_state: Dict[str, Any]) -> None:
        self.seed = SeedBrick(seed_state)
        self.ghost = GhostBrick()
        self.armor = ArmorBrick()
        self.crown = CrownBrick("Idle")
        self.stitch = SovereignStitch(self.seed, self.ghost, self.armor, self.crown)

        self._cycle = 0
        self._resurrections: List[ResurrectionEvent] = []
        self._last_drift: Optional[DriftReport] = None
        self._audit_log: List[Dict[str, Any]] = []

        # Prime the ghost so a pointer-flip is always available.
        self.ghost.mirror(seed_state)
        self._last_drift = DriftReport(
            drift=0.0,
            pulse_alive=True,
            breach=False,
            reason="Initialized at sealed seed.",
        )
        self.crown.green("Omega supervisor armed — stable.", "Live_Sell")
        self._audit("omega.boot", {"seed": self.seed.golden()["checksum"]})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def tick(self, live_state: Dict[str, Any], pulse_alive: bool) -> Dict[str, Any]:
        """One supervisor tick: Verify_Stitch → Mirror_State → Monitor_Drift."""
        self._cycle += 1

        # 1) Verify_Stitch
        if not self.stitch.verify():
            self.crown.red("Stitch signature invalid.", "Connect_To_Stitch")
            self._audit("omega.stitch.invalid", {"cycle": self._cycle})
            return self._resurrect("BRICK_C_ARMOR", "Stitch verification failed.", live_state)

        # 2) Mirror_State — capture prior clean before mirroring potentially
        # tampered live state, so a breach never re-enters the trusted chain.
        prior_clean = self.ghost.latest()
        frame = self.ghost.mirror(live_state)

        # 3) Monitor_Drift
        self._last_drift = self.armor.measure(
            seed_checksum=self.seed.golden()["checksum"],
            live_state=live_state,
            pulse_alive=pulse_alive,
        )

        if self.armor.should_resurrect(self._last_drift):
            return self._resurrect("BRICK_C_ARMOR", self._last_drift.reason, live_state, prior_clean)

        self.crown.green(f"Cycle {self._cycle} stable.", "Live_Sell")
        self._audit("omega.tick.stable", {"cycle": self._cycle, "mirror_hash": frame.mirror_hash})
        return self._status("SB689_READY")

    def connect_to_stitch(self) -> Dict[str, Any]:
        """Public handle for the protocol's connect handshake."""
        handshake = self.stitch.connect()
        self._audit("omega.connect", {"signature": handshake["signature"]})
        return handshake

    def resurrection_log(self) -> List[ResurrectionEvent]:
        return list(self._resurrections)

    def audit_log(self) -> List[Dict[str, Any]]:
        return list(self._audit_log)

    def status(self) -> Dict[str, Any]:
        return self._status("SB689_READY")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _resurrect(
        self,
        from_brick: str,
        cause: str,
        live_state: Dict[str, Any],
        pre_frame: Optional[ShadowFrame] = None,
    ) -> Dict[str, Any]:
        start = time.perf_counter()

        # kill(corrupted_brick) — abandon the live pointer.
        # activate(ghost_shadow) — pointer-flip to the latest clean mirror.
        flip = pre_frame or self.ghost.latest() or self.ghost.mirror(self.seed.golden()["state"])

        # re-stitch(clean_seed) — rebuild the binding chain off the sealed seed.
        self.stitch.forge()

        # signal(crown_gold_flash)
        self.crown.gold(f"Resurrection: {cause}", "Connect_To_Stitch")

        elapsed_ms = (time.perf_counter() - start) * 1000.0
        event = ResurrectionEvent(
            id=str(uuid.uuid4()),
            at=time.time(),
            from_brick=from_brick,
            to_brick="BRICK_B_GHOST",
            cause=cause,
            clean_seed_checksum=self.seed.golden()["checksum"],
            ghost_mirror_hash=flip.mirror_hash,
            elapsed_ms=elapsed_ms,
        )
        self._resurrections.append(event)
        self._audit(
            "omega.resurrect",
            {
                "id": event.id,
                "cause": cause,
                "elapsed_ms": event.elapsed_ms,
                "ghost_mirror_hash": event.ghost_mirror_hash,
            },
        )
        return self._status("SB689_RESURRECTING")

    def _status(self, state: str) -> Dict[str, Any]:
        crown_sig = self.crown.state()
        last_res = self._resurrections[-1] if self._resurrections else None
        return {
            "status": state,
            "cycle": self._cycle,
            "crown": {
                "color": crown_sig.color,
                "mode": crown_sig.mode,
                "message": crown_sig.message,
            },
            "last_drift": {
                "drift": self._last_drift.drift if self._last_drift else 0.0,
                "pulse_alive": self._last_drift.pulse_alive if self._last_drift else True,
                "breach": self._last_drift.breach if self._last_drift else False,
                "reason": self._last_drift.reason if self._last_drift else "",
            },
            "last_resurrection": (
                {
                    "id": last_res.id,
                    "cause": last_res.cause,
                    "elapsed_ms": last_res.elapsed_ms,
                    "ghost_mirror_hash": last_res.ghost_mirror_hash,
                }
                if last_res
                else None
            ),
            "stitch_signature": self.stitch.current().stitch_signature,
            "targets": TARGETS,
        }

    def _audit(self, label: str, detail: Dict[str, Any]) -> None:
        self._audit_log.append(
            {
                "label": label,
                "at": time.time(),
                "detail": deepcopy(detail),
            }
        )
