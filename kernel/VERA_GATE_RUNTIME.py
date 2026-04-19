from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class VeraBlockedError(RuntimeError):
    pass


@dataclass
class Anomaly:
    brick_id: int
    reason: str


class VERAGate:
    def __init__(self, owner_approved: bool = False) -> None:
        self.owner_approved = owner_approved
        self.block_log: list[dict[str, str]] = []
        self.escalations: list[str] = []

    def scan_for_anomalies(self, engine: Any) -> list[Anomaly]:
        anomalies: list[Anomaly] = []
        for brick_id, brick in engine.bricks.items():
            if not self.verify_brick_state(brick):
                anomalies.append(Anomaly(brick_id=brick_id, reason="brick checksum/state mismatch"))
        return anomalies

    @staticmethod
    def detect_threshold_breach(health: float) -> bool:
        return health < 1.0

    @staticmethod
    def verify_brick_state(brick: Any) -> bool:
        return brick.verify() and brick.state in {"operational", "corrupted", "healing"}

    @staticmethod
    def verify_ledger_chain(ledger: list[dict[str, Any]]) -> bool:
        from kernel.LEDGER_STORE import LedgerStore

        verifier = LedgerStore()
        verifier._entries = ledger  # type: ignore[attr-defined]
        return verifier.verify_chain()

    def can_commit_state(self, new_state: dict[str, Any]) -> bool:
        health = float(new_state.get("health", 0.0))
        ledger = new_state.get("ledger", [])
        brick_states = new_state.get("bricks", {})

        if health < 50:
            self.block_unsafe_action("commit", "health below 50%")
        if not self.verify_ledger_chain(ledger):
            self.block_unsafe_action("commit", "ledger chain broken")
        inconsistent = [b for b in brick_states.values() if b.get("state") not in {"operational", "corrupted", "healing"}]
        if inconsistent:
            self.block_unsafe_action("commit", "brick state inconsistent")
        return True

    def block_unsafe_action(self, action: str, reason: str) -> None:
        self.block_log.append({"action": action, "reason": reason})
        if not self.owner_approved:
            raise VeraBlockedError(f"VERA blocked {action}: {reason}")

    def escalate_to_owner(self, issue: str) -> None:
        self.escalations.append(issue)

    def generate_verification_report(self) -> str:
        report = ["VERA Verification Report", f"Blocks: {len(self.block_log)}", f"Escalations: {len(self.escalations)}"]
        for block in self.block_log:
            report.append(f"- BLOCK: {block['action']} ({block['reason']})")
        for escalation in self.escalations:
            report.append(f"- ESCALATE: {escalation}")
        return "\n".join(report)
