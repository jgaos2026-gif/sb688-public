import { test } from "node:test";
import assert from "node:assert/strict";
import { SentinelLayer } from "../src/omega/SentinelLayer";
import { AuditLedger, OmegaSupervisor } from "../src";
import { fixedClock } from "../src/utils/time";

// ── shared fixtures ───────────────────────────────────────────────────────────

const stableDrift = Object.freeze({ drift: 0, pulseAlive: true, breach: false, reason: "stable" });
const breachDrift = Object.freeze({ drift: 1, pulseAlive: true, breach: true, reason: "drift exceeded" });
const pulseLostDrift = Object.freeze({ drift: 0, pulseAlive: false, breach: true, reason: "pulse lost" });

const seedState = {
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
} as const;

function newOmega(): OmegaSupervisor {
  let t = 0;
  return new OmegaSupervisor({
    ledger: new AuditLedger(),
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });
}

// ── unit tests for SentinelLayer ──────────────────────────────────────────────

test("Sentinel: empty window returns NOMINAL with zero counts and valid chain", () => {
  const sentinel = new SentinelLayer();
  const diag = sentinel.diagnose();

  assert.equal(diag.recommendation, "NOMINAL");
  assert.equal(diag.windowSize, 0);
  assert.equal(diag.breachCount, 0);
  assert.equal(diag.breachRate, 0);
  assert.equal(diag.consecutiveBreaches, 0);
  assert.equal(diag.selfIntegrityOk, true);
});

test("Sentinel: nominal health — all stable ticks → NOMINAL", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 10; i++) sentinel.observe(i, stableDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.recommendation, "NOMINAL");
  assert.equal(diag.breachCount, 0);
  assert.equal(diag.breachRate, 0);
  assert.equal(diag.selfIntegrityOk, true);
});

test("Sentinel: 20%+ breach rate escalates to MONITOR", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 8; i++) sentinel.observe(i, stableDrift);
  sentinel.observe(9, breachDrift);
  sentinel.observe(10, breachDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.recommendation, "MONITOR");
  assert.equal(diag.breachCount, 2);
});

test("Sentinel: 40%+ breach rate escalates to ESCALATE", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 6; i++) sentinel.observe(i, stableDrift);
  for (let i = 7; i <= 10; i++) sentinel.observe(i, breachDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.recommendation, "ESCALATE");
  assert.equal(diag.breachCount, 4);
});

test("Sentinel: 60%+ breach rate escalates to QUARANTINE", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 4; i++) sentinel.observe(i, stableDrift);
  for (let i = 5; i <= 10; i++) sentinel.observe(i, breachDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.recommendation, "QUARANTINE");
  assert.equal(diag.breachCount, 6);
});

test("Sentinel: 80%+ breach rate escalates to FAILSAFE", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  // 8 breaches at the start then 2 stable ticks: rate = 0.8, consecutive = 0
  for (let i = 1; i <= 8; i++) sentinel.observe(i, breachDrift);
  for (let i = 9; i <= 10; i++) sentinel.observe(i, stableDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.recommendation, "FAILSAFE");
  assert.equal(diag.breachCount, 8);
});

test("Sentinel: 100% consecutive breaches triggers FAILSAFE regardless of rate path", () => {
  const sentinel = new SentinelLayer({ windowSize: 5 });
  for (let i = 1; i <= 5; i++) sentinel.observe(i, breachDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.consecutiveBreaches, 5);
  assert.equal(diag.recommendation, "FAILSAFE");
});

test("Sentinel: 80% consecutive breaches triggers QUARANTINE via consecutive path", () => {
  const sentinel = new SentinelLayer({ windowSize: 5 });
  sentinel.observe(1, stableDrift);
  for (let i = 2; i <= 5; i++) sentinel.observe(i, breachDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.consecutiveBreaches, 4);
  assert.equal(diag.recommendation, "QUARANTINE");
});

test("Sentinel: pulse-loss breaches are recorded correctly", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 7; i++) sentinel.observe(i, stableDrift);
  sentinel.observe(8, pulseLostDrift);
  sentinel.observe(9, pulseLostDrift);
  sentinel.observe(10, pulseLostDrift);

  const diag = sentinel.diagnose();
  assert.equal(diag.breachCount, 3);
  assert.equal(diag.consecutiveBreaches, 3);
  assert.ok(diag.recommendation !== "NOMINAL");
});

test("Sentinel: hash-chain integrity holds after multiple observations", () => {
  const sentinel = new SentinelLayer({ windowSize: 10 });
  for (let i = 1; i <= 8; i++) sentinel.observe(i, i % 3 === 0 ? breachDrift : stableDrift);

  const status = sentinel.status();
  assert.equal(status.active, true);
  assert.equal(status.metricsRecorded, 8);
  assert.equal(status.lastDiagnosis.selfIntegrityOk, true);
  assert.ok(status.integrityHash.startsWith("fnv1a:"));
});

test("Sentinel: sliding window discards entries beyond capacity", () => {
  const sentinel = new SentinelLayer({ windowSize: 5 });
  // Observe 12 stable ticks, then 1 breach
  for (let i = 1; i <= 12; i++) sentinel.observe(i, stableDrift);
  sentinel.observe(13, breachDrift);

  // Window of 5 should only see the last 5 ticks (tick 9–13)
  const diag = sentinel.diagnose();
  assert.equal(diag.windowSize, 5);
  // Only the last entry is a breach
  assert.equal(diag.breachCount, 1);
  assert.equal(diag.recommendation, "MONITOR");
});

// ── integration tests with OmegaSupervisor ────────────────────────────────────

test("OmegaSupervisor exposes sentinel and sentinel is NOMINAL after stable ticks", () => {
  const omega = newOmega();
  for (let i = 0; i < 5; i++) omega.tick({ liveState: seedState, pulseAlive: true });

  const status = omega.status();
  assert.ok(status.sentinel != null);
  assert.equal(status.sentinel.active, true);
  assert.equal(status.sentinel.metricsRecorded, 5);
  assert.equal(status.sentinel.lastDiagnosis.recommendation, "NOMINAL");
  assert.equal(status.sentinel.lastDiagnosis.selfIntegrityOk, true);
  assert.ok(status.sentinel.integrityHash.startsWith("fnv1a:"));
});

test("OmegaSupervisor sentinel escalates after repeated breach ticks", () => {
  const omega = newOmega();
  const tampered = { ...seedState, owner: "HACKED" };

  // 10 consecutive breach ticks (state mismatch → armor fires)
  for (let i = 0; i < 10; i++) omega.tick({ liveState: tampered, pulseAlive: true });

  const status = omega.status();
  assert.ok(status.sentinel.lastDiagnosis.breachRate > 0);
  assert.notEqual(status.sentinel.lastDiagnosis.recommendation, "NOMINAL");
});

test("OmegaSupervisor sentinel records mixed healthy and breach ticks correctly", () => {
  const omega = newOmega();
  const tampered = { ...seedState, owner: "HACKED" };

  // 8 stable then 2 breaches → MONITOR territory
  for (let i = 0; i < 8; i++) omega.tick({ liveState: seedState, pulseAlive: true });
  for (let i = 0; i < 2; i++) omega.tick({ liveState: tampered, pulseAlive: true });

  const diag = omega.status().sentinel.lastDiagnosis;
  assert.equal(diag.breachCount, 2);
  assert.ok(diag.breachRate > 0);
  assert.equal(diag.selfIntegrityOk, true);
});

test("OmegaSupervisor sentinel is included in both READY and RESURRECTING statuses", () => {
  const omega = newOmega();

  // Stable tick → READY
  const readyStatus = omega.tick({ liveState: seedState, pulseAlive: true });
  assert.equal(readyStatus.status, "SB689_READY");
  assert.ok(readyStatus.sentinel != null);

  // Breach tick → RESURRECTING
  const resurrectStatus = omega.tick({ liveState: { ...seedState, owner: "TAMPERED" }, pulseAlive: true });
  assert.equal(resurrectStatus.status, "SB689_RESURRECTING");
  assert.ok(resurrectStatus.sentinel != null);
  assert.equal(resurrectStatus.sentinel.lastDiagnosis.selfIntegrityOk, true);
});
