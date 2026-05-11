"""
BRICK_C_ARMOR — Self-Healing Daemon.

Hardware-level interrupt for zero-time resurrection.
Trigger: drift > 0.01% OR pulse == 0
Action:  immediate kill of the corrupted brick → pointer swap to Ghost.
"""

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict


def _stable_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def _hash_of(data: Any) -> str:
    if isinstance(data, (dict, list)):
        data = _stable_json(data)
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class DriftReport:
    drift: float
    pulse_alive: bool
    breach: bool
    reason: str


class ArmorBrick:
    """BRICK_C_ARMOR — Self-Healing Daemon."""

    IDENT = "BRICK_C_ARMOR"
    STATE = "ACTIVE_MONITOR"
    # Protocol-defined drift threshold: 0.01% expressed as a ratio.
    DRIFT_THRESHOLD = 0.0001

    def measure(
        self,
        *,
        seed_checksum: str,
        live_state: Dict[str, Any],
        pulse_alive: bool,
    ) -> DriftReport:
        """Compute a drift report between live state and the sealed seed."""
        live_hash = _hash_of(_stable_json(live_state))
        matches = live_hash == seed_checksum

        # Drift is binary-by-checksum (1.0 if mismatch, 0.0 if match).
        drift = 0.0 if matches else 1.0

        breach = (not pulse_alive) or (drift > self.DRIFT_THRESHOLD)
        if not pulse_alive:
            reason = "Pulse == 0: live brick is non-responsive."
        elif matches:
            reason = "Live state matches sealed seed checksum within tolerance."
        else:
            reason = (
                f"Drift {drift:.6f} exceeds threshold {self.DRIFT_THRESHOLD}."
            )

        return DriftReport(drift=drift, pulse_alive=pulse_alive, breach=breach, reason=reason)

    def should_resurrect(self, report: DriftReport) -> bool:
        """Decide whether the armor should fire its hardware-interrupt swap."""
        return report.breach
