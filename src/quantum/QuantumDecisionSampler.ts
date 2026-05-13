import type { ProbabilityDistribution, ProbabilityPoint } from "../contracts/runtime";
import { QuantumDistributionValidator } from "./QuantumDistributionValidator";

export interface QuantumSampleReport {
  readonly ok: boolean;
  readonly chosen?: ProbabilityPoint;
  readonly roll?: number;
  readonly normalized: readonly ProbabilityPoint[];
  readonly issues: readonly string[];
}

export class QuantumDecisionSampler {
  private readonly validator = new QuantumDistributionValidator();

  sample(distribution: ProbabilityDistribution, rng: () => number = Math.random): QuantumSampleReport {
    const validation = this.validator.validate(distribution);
    if (!validation.valid) {
      return { ok: false, normalized: validation.normalized, issues: validation.issues };
    }

    if (validation.normalized.length === 0) {
      return { ok: false, normalized: validation.normalized, issues: ["No selectable points after normalization."] };
    }

    const rawRoll = rng();
    const clampedRoll = Number.isFinite(rawRoll)
      ? Math.min(Math.max(rawRoll, 0), 0.999999999999)
      : 0;

    let cumulative = 0;
    for (const point of validation.normalized) {
      cumulative += point.probability;
      if (clampedRoll <= cumulative) {
        return {
          ok: true,
          chosen: point,
          roll: clampedRoll,
          normalized: validation.normalized,
          issues: []
        };
      }
    }

    const fallback = validation.normalized[validation.normalized.length - 1];
    return {
      ok: true,
      chosen: fallback,
      roll: clampedRoll,
      normalized: validation.normalized,
      issues: []
    };
  }
}

