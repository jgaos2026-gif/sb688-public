import test from "node:test";
import assert from "node:assert/strict";
import {
  SovereignHeartbeatGovernor,
  SUPER_HARD_HEARTBEAT_POLICY,
  type SovereignHeartbeat
} from "../src/heartbeat/SovereignHeartbeatGovernor";

function beat(sequence: number, receivedAtMs: number, overrides: Partial<SovereignHeartbeat> = {}): SovereignHeartbeat {
  return {
    sovereignId: "SOVEREIGN_1",
    sectionId: "SECTION_A1",
    nodeId: "NODE_1",
    role: "PATROL",
    epoch: 1,
    sequence,
    emittedAtMs: receivedAtMs,
    receivedAtMs,
    policyVersion: "constitution-v1",
    lastCheckpointId: "checkpoint-1",
    lastVerificationId: "verify-1",
    sourceAuthenticated: true,
    provenancePresent: true,
    evidenceRef: `heartbeat-${sequence}`,
    ...overrides
  };
}

test("healthy 10-second heartbeat is accepted and triggers patrol/correlation", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  const d1 = g.observe(beat(1, 10_000));
  const d2 = g.observe(beat(2, 20_000));
  assert.equal(d1.accepted, true);
  assert.equal(d2.healthy, true);
  assert.equal(d2.missedBeats, 0);
  assert.ok(d2.actions.includes("PATROL_SCAN"));
  assert.ok(d2.actions.includes("WATCHDOG_CORRELATE"));
});

test("duplicate or replayed sequence freezes promotion and requests quarantine", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(5, 50_000));
  const d = g.observe(beat(5, 60_000));
  assert.equal(d.accepted, false);
  assert.equal(d.trustPromotionFrozen, true);
  assert.equal(d.quarantineRequested, true);
  assert.ok(d.reasons.some((r) => r.includes("replay")));
});

test("epoch rollback is rejected", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000, { epoch: 5 }));
  const d = g.observe(beat(2, 20_000, { epoch: 4 }));
  assert.equal(d.accepted, false);
  assert.ok(d.reasons.includes("heartbeat epoch rollback detected"));
});

test("forged clock skew is rejected", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  const d = g.observe(beat(1, 20_000, { emittedAtMs: 1_000 }));
  assert.equal(d.accepted, false);
  assert.ok(d.reasons.includes("heartbeat clock skew exceeded"));
});

test("one missed pulse freezes trust promotion and escalates to Trio", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000));
  const d = g.observe(beat(3, 30_000));
  assert.equal(d.missedBeats, 1);
  assert.equal(d.trustPromotionFrozen, true);
  assert.ok(d.actions.includes("ESCALATE_TO_TRIO"));
});

test("two missed pulses request quarantine", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000));
  const d = g.observe(beat(4, 40_000));
  assert.equal(d.missedBeats, 2);
  assert.equal(d.quarantineRequested, true);
  assert.ok(d.actions.includes("REQUEST_QUARANTINE"));
});

test("three or more missed pulses request Phoenix recovery", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000));
  const d = g.observe(beat(5, 50_000));
  assert.equal(d.missedBeats, 3);
  assert.equal(d.phoenixRecoveryRequested, true);
  assert.ok(d.actions.includes("REQUEST_PHOENIX_RECOVERY"));
});

test("Trio rotation advances every two hours", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  const twoHours = SUPER_HARD_HEARTBEAT_POLICY.trioWakeEveryMs;
  const a = g.observe(beat(1, 0));
  const b = g.observe(beat(2, twoHours, { nodeId: "NODE_2" }));
  const c = g.observe(beat(3, twoHours * 2, { nodeId: "NODE_3" }));
  assert.equal(a.activeTrioMember, 1);
  assert.equal(b.activeTrioMember, 2);
  assert.equal(c.activeTrioMember, 3);
});

test("governed recovery acknowledgement requires verify validate certify checkpoint and evidence", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000));
  g.observe(beat(5, 50_000));
  const denied = g.acknowledgeGovernedRecovery("NODE_1", "SECTION_A1", {
    verified: true,
    validated: true,
    certified: false,
    checkpointPresent: true,
    evidencePreserved: true
  });
  assert.equal(denied, false);
  const accepted = g.acknowledgeGovernedRecovery("NODE_1", "SECTION_A1", {
    verified: true,
    validated: true,
    certified: true,
    checkpointPresent: true,
    evidencePreserved: true
  });
  assert.equal(accepted, true);
});

test("rejoin review remains locked during post-recovery healthy-beat probation", () => {
  const g = new SovereignHeartbeatGovernor("SOVEREIGN_1", "constitution-v1");
  g.observe(beat(1, 10_000));
  g.observe(beat(5, 50_000));
  assert.equal(g.acknowledgeGovernedRecovery("NODE_1", "SECTION_A1", {
    verified: true,
    validated: true,
    certified: true,
    checkpointPresent: true,
    evidencePreserved: true
  }), true);

  for (let i = 0; i < SUPER_HARD_HEARTBEAT_POLICY.healthyBeatsBeforeRejoinReview - 1; i++) {
    const seq = 6 + i;
    const d = g.observe(beat(seq, 60_000 + i * 10_000));
    assert.equal(d.rejoinReviewAllowed, false);
  }
});
