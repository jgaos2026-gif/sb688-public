from __future__ import annotations

import json
import math
import random
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator

from kernel.LEDGER_STORE import LedgerStore
from kernel.VERA_GATE_RUNTIME import VERAGate
from nodes.brick import Brick


@dataclass
class HealEvent:
    timestamp: str
    phase: str
    message: str
    data: dict


class SB688Engine:
    TOTAL_BRICKS = 64

    def __init__(self) -> None:
        self.bricks = {i: Brick(i) for i in range(self.TOTAL_BRICKS)}
        self._braid_a = "GREEN"
        self._braid_b = "GREEN"
        self.ledger_store = LedgerStore()
        self.vera = VERAGate()
        self._checkpoints: list[tuple[str, dict]] = []
        self._corruption_seed = 0
        self._log("INIT", "SYSTEM_INIT", "System initialized")
        self._save_checkpoint()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    def _state_snapshot(self) -> dict:
        return {
            "timestamp": self._now(),
            "health": self.health(),
            "braid_status": self.braid_status(),
            "bricks": {
                i: {
                    "state": brick.state,
                    "checksum": brick.checksum(),
                    "timestamp": brick.timestamp,
                    "data": brick.get_data().hex(),
                }
                for i, brick in self.bricks.items()
            },
            "ledger": self.get_ledger(),
        }

    def _log(self, phase: str, event_type: str, message: str, data: dict | None = None) -> None:
        self.ledger_store.append(
            {
                "phase": phase,
                "event_type": event_type,
                "health": self.health(),
                "braid_status": self.braid_status(),
                "message": message,
                "data": data or {},
            }
        )

    def _save_checkpoint(self) -> None:
        snapshot = self._state_snapshot()
        ts = snapshot["timestamp"]
        cp = deepcopy(snapshot)
        cp["ledger"] = []
        self._checkpoints.append((ts, cp))
        self.ledger_store.append(
            {
                "phase": "INIT",
                "event_type": "CHECKPOINT_SAVED",
                "health": self.health(),
                "braid_status": self.braid_status(),
                "message": "Checkpoint saved",
                "data": {"checkpoint": cp},
            }
        )

    def health(self) -> float:
        healthy = sum(1 for b in self.bricks.values() if b.state == "operational")
        return round((healthy / self.TOTAL_BRICKS) * 100, 4)

    def braid_status(self) -> str:
        if self._braid_a == "GREEN" and self._braid_b == "GREEN":
            return "GREEN"
        if self._braid_a == "HEALING" or self._braid_b == "HEALING":
            return "HEALING"
        return "RED"

    def inject_corruption(self, percent: float = 99.8) -> None:
        self._save_checkpoint()
        self._corruption_seed += 1
        rng = random.Random(int(percent * 1000) + self._corruption_seed)
        count = min(self.TOTAL_BRICKS, max(0, math.ceil(self.TOTAL_BRICKS * (percent / 100.0))))
        selected = sorted(rng.sample(list(self.bricks.keys()), count)) if count else []
        self._braid_a = "RED"
        self._braid_b = "RED"
        self._log("CORRUPT", "CORRUPTION_START", f"Injecting corruption into {count} bricks", {"percent": percent})
        for brick_id in selected:
            self.bricks[brick_id].corrupt()
            self._log("CORRUPT", "BRICK_CORRUPTED", f"Brick {brick_id} corrupted", {"brick_id": brick_id})

    def detect_corruption(self) -> bool:
        anomalies = self.vera.scan_for_anomalies(self)
        detected = bool(anomalies) or self.health() < 100.0
        self._log("DETECT", "VERA_DETECT", "Corruption detected" if detected else "No corruption", {"anomalies": len(anomalies)})
        return detected

    def isolate_contamination(self) -> set[int]:
        contaminated = {i for i, b in self.bricks.items() if b.state == "corrupted"}
        self._log("ISOLATE", "CONTAMINATION_ISOLATED", "Contamination isolated", {"count": len(contaminated)})
        return contaminated

    def rollback_to_checkpoint(self, timestamp: str) -> bool:
        chosen = None
        for ts, cp in self._checkpoints:
            if ts <= timestamp:
                chosen = cp
        if not chosen:
            return False
        for brick_id in range(self.TOTAL_BRICKS):
            data = bytes.fromhex(chosen["bricks"][brick_id]["data"])
            self.bricks[brick_id].set_data(data)
        self._braid_a = "HEALING"
        self._braid_b = "HEALING"
        self._log("ROLLBACK", "ROLLBACK_CHECKPOINT", "Rollback to checkpoint complete", {"timestamp": timestamp})
        return True

    def heal_from_spine(self) -> Iterator[HealEvent]:
        contaminated = self.isolate_contamination()
        yield HealEvent(self._now(), "ISOLATE", "Contamination isolated", {"count": len(contaminated)})

        if self._checkpoints:
            checkpoint_ts = self._checkpoints[-1][0]
            self.rollback_to_checkpoint(checkpoint_ts)
            yield HealEvent(self._now(), "ROLLBACK", "Rollback complete", {"checkpoint": checkpoint_ts})

        for brick_id in sorted(contaminated):
            brick = self.bricks[brick_id]
            brick.state = "healing"
            self._log("HEAL", "BRICK_HEALING", f"Brick {brick_id} healing", {"brick_id": brick_id})
            brick.heal()
            self._log("HEAL", "BRICK_HEALED", f"Brick {brick_id} healed", {"brick_id": brick_id})
            yield HealEvent(self._now(), "HEAL", f"Brick {brick_id} healed", {"brick_id": brick_id})

        integrity = self.verify_integrity()
        self._braid_a = "GREEN" if integrity else "RED"
        self._braid_b = "GREEN" if integrity else "RED"
        self._log("VERIFY", "INTEGRITY_CHECK", "Integrity verified" if integrity else "Integrity failed", {"integrity": integrity})
        yield HealEvent(self._now(), "VERIFY", "Integrity verified" if integrity else "Integrity failed", {"integrity": integrity})

        self._log("COMPLETE", "HEAL_COMPLETE", "Healing complete", {"health": self.health()})
        yield HealEvent(self._now(), "COMPLETE", "Healing complete", {"health": self.health()})

    def verify_integrity(self) -> bool:
        brick_integrity = all(b.verify() and b.state == "operational" for b in self.bricks.values())
        return brick_integrity and self.ledger_store.verify_chain()

    def get_ledger(self) -> list[dict]:
        return self.ledger_store.get_all()

    def export_proof(self, format: str = "json") -> str:
        if format == "csv":
            return self.ledger_store.export_csv()
        return self.ledger_store.export_json()

    def get_state(self) -> dict:
        return self._state_snapshot()
