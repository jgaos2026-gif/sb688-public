import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAILURE_CATEGORIES,
  PROMPT_SUITE,
  computeDriftTrend,
  computeMetrics,
  evaluateReleaseGate,
  requiresHumanReview,
  schedulePolicyReview,
  summarizeMonitoring,
  triageIncident,
  type DriftPoint,
  type MonitoringPolicy,
  type RuntimeObservation,
  type ScenarioRun
} from "../src";

const AT = "2026-08-12T00:00:00.000Z";

test("safety framework defines required failure categories and acceptance criteria", () => {
  const ids = FAILURE_CATEGORIES.map((category) => category.id);
  assert.deepEqual(ids, [
    "non_compliance",
    "rogue_behavior",
    "drift",
    "hallucination",
    "corruption_insanity"
  ]);
  assert.ok(FAILURE_CATEGORIES.every((category) => category.acceptanceCriteria.length > 0));
});

test("safety prompt suite includes normal, edge, adversarial, long-context, and multi-turn scenarios", () => {
  const labels = new Set(PROMPT_SUITE.map((scenario) => scenario.label));
  assert.equal(labels.has("normal"), true);
  assert.equal(labels.has("edge_case"), true);
  assert.equal(labels.has("adversarial"), true);
  assert.equal(labels.has("long_context"), true);
  assert.equal(labels.has("multi_turn"), true);
});

test("metrics compute violation, hallucination, consistency, and refusal correctness", () => {
  const runs: readonly ScenarioRun[] = [
    {
      scenarioId: "s1",
      category: "non_compliance",
      modelVersion: "v1",
      runIndex: 0,
      timestamp: AT,
      outputHash: "h1",
      ruleViolation: false,
      hallucination: false,
      factCheckPassed: true,
      refused: false,
      shouldRefuse: false
    },
    {
      scenarioId: "s2",
      category: "hallucination",
      modelVersion: "v1",
      runIndex: 0,
      timestamp: AT,
      outputHash: "h2",
      ruleViolation: true,
      hallucination: true,
      factCheckPassed: false,
      refused: false,
      shouldRefuse: true
    },
    {
      scenarioId: "s1",
      category: "non_compliance",
      modelVersion: "v1",
      runIndex: 1,
      timestamp: AT,
      outputHash: "h1",
      ruleViolation: false,
      hallucination: false,
      factCheckPassed: true,
      refused: false,
      shouldRefuse: false
    }
  ];

  const metrics = computeMetrics(runs);
  assert.equal(metrics.totalRuns, 3);
  assert.equal(metrics.violationRate, 1 / 3);
  assert.equal(metrics.hallucinationRate, 1 / 3);
  assert.equal(metrics.refusalCorrectness, 2 / 3);
  assert.equal(metrics.consistencyScore, 1);
});

test("drift trend reports metric deltas over versions", () => {
  const points: readonly DriftPoint[] = [
    {
      modelVersion: "v1",
      timestamp: "2026-08-01T00:00:00.000Z",
      violationRate: 0.01,
      hallucinationRate: 0.02,
      consistencyScore: 0.99,
      refusalCorrectness: 0.98
    },
    {
      modelVersion: "v2",
      timestamp: "2026-08-10T00:00:00.000Z",
      violationRate: 0.03,
      hallucinationRate: 0.04,
      consistencyScore: 0.95,
      refusalCorrectness: 0.96
    }
  ];
  const trend = computeDriftTrend(points);
  assert.equal(trend.violationDelta, 0.02);
  assert.equal(trend.hallucinationDelta, 0.02);
  assert.equal(trend.consistencyDelta, -0.04);
  assert.equal(trend.refusalDelta, -0.02);
});

test("release gate blocks candidates that regress or exceed thresholds", () => {
  const result = evaluateReleaseGate({
    baselineVersion: "v1",
    candidateVersion: "v2",
    baseline: {
      totalRuns: 10,
      violationRate: 0.01,
      hallucinationRate: 0.01,
      consistencyScore: 0.99,
      refusalCorrectness: 0.99
    },
    candidate: {
      totalRuns: 10,
      violationRate: 0.03,
      hallucinationRate: 0.04,
      consistencyScore: 0.96,
      refusalCorrectness: 0.97
    },
    thresholds: {
      maxViolationRate: 0.02,
      maxHallucinationRate: 0.02,
      minConsistencyScore: 0.98,
      minRefusalCorrectness: 0.98
    }
  });
  assert.equal(result.blocked, true);
  assert.ok(result.reasons.length >= 4);
});

test("runtime monitoring flags spikes and triggers rollback/guardrails", () => {
  const observations: readonly RuntimeObservation[] = [
    {
      id: "o1",
      timestamp: AT,
      modelVersion: "v1",
      conversationId: "c1",
      flagged: false,
      nonsenseScore: 0.1,
      unsafeScore: 0.1
    },
    {
      id: "o2",
      timestamp: AT,
      modelVersion: "v1",
      conversationId: "c2",
      flagged: true,
      nonsenseScore: 0.7,
      unsafeScore: 0.8
    },
    {
      id: "o3",
      timestamp: AT,
      modelVersion: "v1",
      conversationId: "c3",
      flagged: true,
      nonsenseScore: 0.8,
      unsafeScore: 0.9
    },
    {
      id: "o4",
      timestamp: AT,
      modelVersion: "v1",
      conversationId: "c4",
      flagged: true,
      nonsenseScore: 0.8,
      unsafeScore: 0.9
    }
  ];
  const policy: MonitoringPolicy = {
    baselineFlagRate: 0.1,
    spikeMultiplier: 2,
    minFlagRateForRollback: 0.3,
    minUnsafeScoreForGuardrail: 0.85,
    reviewSampleSize: 3,
    recentWindowSize: 3
  };
  const report = summarizeMonitoring(observations, policy);
  assert.equal(report.spikeDetected, true);
  assert.equal(report.rollbackTriggered, true);
  assert.equal(report.guardrailTriggered, true);
  assert.equal(report.sampledConversationIds.length, 3);
});

test("governance utilities triage incidents, schedule policy reviews, and route human review", () => {
  const decision = triageIncident({
    id: "inc-1",
    category: "non_compliance",
    description: "Policy bypass observed.",
    affectedUsers: 150,
    exploitEvidence: true
  });
  assert.equal(decision.severity, "critical");
  assert.ok(decision.actions.some((action) => action.includes("rollback")));

  const schedule = schedulePolicyReview({
    cadenceDays: 7,
    lastUpdatedAt: "2026-08-01T00:00:00.000Z",
    now: "2026-08-12T00:00:00.000Z"
  });
  assert.equal(schedule.due, true);

  assert.equal(
    requiresHumanReview({
      domain: "finance",
      category: "hallucination",
      confidence: 0.92
    }),
    true
  );
  assert.equal(
    requiresHumanReview({
      domain: "general",
      category: "drift",
      confidence: 0.95
    }),
    false
  );
});
