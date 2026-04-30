import type { ProbabilityDistribution, QuantumValidationReport } from "../contracts/runtime";

export class QuantumDistributionValidator {
  validate(distribution: ProbabilityDistribution): QuantumValidationReport {
    const tolerance = distribution.tolerance ?? 1e-6;
    const issues: string[] = [];

    if (distribution.points.length === 0) {
      issues.push("Distribution must contain at least one point.");
    }

    const total = distribution.points.reduce((sum, point) => {
      if (!Number.isFinite(point.probability)) {
        issues.push(`Probability for ${point.label} is not finite.`);
        return sum;
      }

      if (point.probability < 0) {
        issues.push(`Probability for ${point.label} is negative.`);
      }

      return sum + point.probability;
    }, 0);

    const maxDeviation = Math.abs(1 - total);

    if (distribution.points.length > 0 && maxDeviation > tolerance) {
      issues.push(`Distribution total ${total} exceeds tolerance ${tolerance}.`);
    }

    const normalized = total > 0
      ? distribution.points.map((point) => ({
        label: point.label,
        probability: point.probability / total
      }))
      : [];

    return {
      valid: issues.length === 0,
      normalized,
      total,
      maxDeviation,
      issues
    };
  }
}
