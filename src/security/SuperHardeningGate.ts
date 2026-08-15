import {
  UniversalHardeningGate,
  type ArtifactCandidate,
  type EnvironmentId,
  type EnvironmentProfile,
  type PurificationDecision,
  type ThreatSignal
} from "./UniversalHardening";

/**
 * SUPER HARD policy layer.
 *
 * Purification is still not trust. This wrapper adds a stricter detector rule:
 * every high-confidence threat signal fails closed unless the selected
 * environment explicitly tolerates that exact condition (currently transport
 * partition/reorder in partition-tolerant profiles).
 */
export class SuperHardeningGate extends UniversalHardeningGate {
  constructor(environment: EnvironmentId | EnvironmentProfile = "GENERAL") {
    super(environment);
  }

  override inspect(candidate: ArtifactCandidate, signals: readonly ThreatSignal[] = []): PurificationDecision {
    const base = super.inspect(candidate, signals);
    const reasons = [...base.reasons];

    for (const signal of signals) {
      if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) continue;
      if (signal.type === "TRANSPORT_PARTITION_OR_REORDER" && this.environment.tolerateNetworkPartition) continue;
      if (signal.confidence >= 0.7) {
        const reason = `super-hard blocking signal: ${signal.type}`;
        if (!reasons.includes(reason)) reasons.push(reason);
      }
    }

    return Object.freeze({
      state: reasons.length === 0 ? "PURIFIED_CANDIDATE" : "QUARANTINED",
      reasons: Object.freeze(reasons),
      canTouchSpine: false,
      trusted: false,
      requiresAssurance: true
    });
  }
}
