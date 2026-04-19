"""Standalone braided routing example for SB-688."""

from dataclasses import dataclass
from typing import List


@dataclass
class VerificationResult:
    passed: bool
    contradictions: List[str]
    unsupported_claims: List[str]


class DualPathVerifier:
    def work_path(self, objective: str) -> str:
        return f"Proposed answer for objective: {objective}"

    def contradiction_path(self, candidate: str) -> VerificationResult:
        contradictions = []
        unsupported_claims = []
        if "guaranteed" in candidate.lower():
            unsupported_claims.append("Guarantee language requires evidence.")
        if "always" in candidate.lower() and "never" in candidate.lower():
            contradictions.append("Self-contradictory absolute claims detected.")
        return VerificationResult(
            passed=not contradictions and not unsupported_claims,
            contradictions=contradictions,
            unsupported_claims=unsupported_claims,
        )

    def run(self, objective: str) -> dict:
        candidate = self.work_path(objective)
        verification = self.contradiction_path(candidate)
        return {
            "candidate": candidate,
            "verification": verification,
            "commit_allowed": verification.passed,
        }


if __name__ == "__main__":
    verifier = DualPathVerifier()
    result = verifier.run("Draft a compliant update summary")
    print(result)
