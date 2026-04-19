# VERA Verification Layer Protocol

## Purpose
VERA is the pre-commit verification layer for SB-688 decisions and outputs.

## What VERA Checks Before Commit
1. Unsupported claims detection (missing source/evidence)
2. Contradiction scanning against spine and recent ledger
3. Uncertainty labeling (explicit confidence/unknowns)
4. Risk escalation rules
5. Financial/legal/safety decision blocking unless explicitly approved by verified owner

## Verification Checklist
- [ ] All factual claims are sourced or marked unverified
- [ ] No contradictions with protected spine
- [ ] No contradictions with latest trusted ledger checkpoint
- [ ] Uncertainty labels are present where needed
- [ ] High-risk actions escalated or blocked
- [ ] Ledger append prepared prior to commit

## VERA + Brick System Interaction
- VERA evaluates per brick and across-brick consistency.
- A failed brick blocks only that branch; unaffected bricks remain intact.
- If cross-brick contamination is detected, invoke healing loop.

## Failure Modes and Recovery
- **Over-permissive VERA:** bad state could commit. Recovery: rollback and rerun VERA with stricter checks.
- **Over-restrictive VERA:** safe state blocked. Recovery: owner override with explicit rationale logged.
- **Missing evidence path:** hold commit and request proof or downgrade claim.

## Audit Trail Format
Each VERA decision records:
- `timestamp`
- `request_id`
- `brick_id`
- `status` (`pass|fail|escalate|override`)
- `unsupported_claims[]`
- `contradictions[]`
- `uncertainty_labels[]`
- `risk_level`
- `approver` (if override)
