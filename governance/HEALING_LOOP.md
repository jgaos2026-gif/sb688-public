# SB-688 Healing Loop (Cold-Stitch Recovery)

## Five-Step Healing Process
1. **Detect** drift, contradiction, or contamination.
2. **Isolate** the bad segment/brick to prevent propagation.
3. **Roll back** to the last trusted checkpoint.
4. **Restitch** from the protected spine with clean bricks.
5. **Re-verify** via VERA before commit.

## Heal vs Escalate Decision Tree
- Minor inconsistency: log note and continue with caution.
- Moderate contradiction: isolate affected brick, request owner review.
- Critical drift or safety/legal/financial risk: execute full healing loop and escalate.
- Repeated drift episodes: suspend autonomy and require manual authorization.

## Healing Telemetry
Track:
- time_to_detect
- time_to_isolate
- time_to_recover
- rollback_count
- escalation_count
- repeat_drift_rate
