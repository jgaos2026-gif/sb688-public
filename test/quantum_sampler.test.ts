import { test } from "node:test";
import assert from "node:assert/strict";
import { QuantumDecisionSampler } from "../src";

test("quantum sampler selects deterministically with seeded rng", () => {
  const sampler = new QuantumDecisionSampler();
  const dist = {
    name: "routes",
    tolerance: 1e-6,
    points: [
      { label: "a", probability: 0.5 },
      { label: "b", probability: 0.25 },
      { label: "c", probability: 0.25 }
    ]
  } as const;

  const first = sampler.sample(dist, () => 0);
  assert.equal(first.ok, true);
  assert.equal(first.chosen?.label, "a");

  const last = sampler.sample(dist, () => 0.999);
  assert.equal(last.ok, true);
  assert.equal(last.chosen?.label, "c");
});

test("quantum sampler refuses invalid distributions", () => {
  const sampler = new QuantumDecisionSampler();
  const report = sampler.sample({
    name: "broken",
    points: [
      { label: "a", probability: 0.7 },
      { label: "b", probability: 0.7 }
    ]
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.length > 0);
});

