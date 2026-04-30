import { test } from "node:test";
import assert from "node:assert/strict";
import { QuantumDistributionValidator } from "../src";

test("quantum validator accepts normalized noisy probability distributions", () => {
  const validator = new QuantumDistributionValidator();
  const report = validator.validate({
    name: "route-probabilities",
    tolerance: 1e-3,
    points: [
      { label: "decision", probability: 0.3334 },
      { label: "memory", probability: 0.3333 },
      { label: "personality", probability: 0.3333 }
    ]
  });

  assert.equal(report.valid, true);
  assert.equal(report.normalized.length, 3);
});

test("quantum validator rejects invalid distributions", () => {
  const validator = new QuantumDistributionValidator();
  const report = validator.validate({
    name: "broken",
    points: [
      { label: "a", probability: 0.7 },
      { label: "b", probability: 0.7 }
    ]
  });

  assert.equal(report.valid, false);
  assert.ok(report.issues.length > 0);
});
