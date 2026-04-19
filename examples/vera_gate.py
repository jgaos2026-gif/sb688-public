"""Standalone VERA gate example for SB-688."""

from dataclasses import dataclass
from typing import List


@dataclass
class VeraDecision:
    status: str
    reasons: List[str]


class VeraGate:
    blocked_risk_categories = {"financial", "legal", "safety", "irreversible"}

    def evaluate(self, claims: List[dict], risk_category: str, owner_override: bool = False) -> VeraDecision:
        reasons: List[str] = []

        for claim in claims:
            if not claim.get("verified", False):
                reasons.append(f"Unsupported claim: {claim.get('text', 'unknown')}")

        if risk_category in self.blocked_risk_categories and not owner_override:
            reasons.append(f"Blocked high-risk category without owner override: {risk_category}")

        return VeraDecision(status="pass" if not reasons else "fail", reasons=reasons)


if __name__ == "__main__":
    gate = VeraGate()
    decision = gate.evaluate(
        claims=[{"text": "Result is guaranteed", "verified": False}],
        risk_category="financial",
    )
    print(decision)
