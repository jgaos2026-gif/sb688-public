import { test } from "node:test";
import assert from "node:assert/strict";
import { StitchRecoveryCapsule } from "../src/phoenix/StitchRecoveryCapsule";

const STITCH = Object.freeze({
  protocol: "SB689",
  version: 1,
  owner: "JGA",
  mode: "CERTIFIED_SEED"
});

const MEMORY = Object.freeze({
  lastGoodEpoch: 41,
  userState: { theme: "dark", locale: "en-US" },
  owner: "SHOULD_NOT_OVERRIDE_STITCH",
  junk: undefined
});

test("stitch capsule drops duplicate control keys and unusable memory", () => {
  const capsule = StitchRecoveryCapsule.seal(STITCH, MEMORY);
  const recovered = StitchRecoveryCapsule.recover(
    { protocol: "CORRUPTED", payload: "junk", duplicate: true },
    capsule
  );

  assert.equal(recovered.success, true);
  assert.equal(recovered.trusted, false);
  assert.equal(recovered.requiresHealthyScan, true);
  assert.equal(recovered.discardedLiveKeys, 3);
  assert.equal(recovered.state.owner, "JGA");
  assert.equal(recovered.state.lastGoodEpoch, 41);
  assert.equal("junk" in recovered.state, false);
});

test("recovery never salvages corrupted live state", () => {
  const capsule = StitchRecoveryCapsule.seal(STITCH, { memory: "clean" });
  const live = {
    protocol: "ATTACKER",
    memory: "corrupted",
    injected: "malicious",
    duplicate: "bloat"
  };

  const recovered = StitchRecoveryCapsule.recover(live, capsule);
  assert.equal(recovered.success, true);
  assert.equal(recovered.state.protocol, "SB689");
  assert.equal(recovered.state.memory, "clean");
  assert.equal("injected" in recovered.state, false);
  assert.equal("duplicate" in recovered.state, false);
});

test("tampered capsule fails closed", () => {
  const capsule = StitchRecoveryCapsule.seal(STITCH, { memory: "clean" });
  const tampered = { ...capsule, payload: capsule.payload.slice(0, -4) + "AAAA" };
  const recovered = StitchRecoveryCapsule.recover({ corrupted: true }, tampered);

  assert.equal(recovered.success, false);
  assert.equal(recovered.trusted, false);
  assert.equal(recovered.requiresHealthyScan, true);
  assert.deepEqual(recovered.state, {});
});

test("first healthy verified validated scan can mint a fresh capsule", () => {
  const oldCapsule = StitchRecoveryCapsule.seal(STITCH, { epoch: 41 });
  const recovered = StitchRecoveryCapsule.recover(
    { corrupted: true, duplicate: true, junk: "drop-me" },
    oldCapsule
  );
  assert.equal(recovered.success, true);

  const freshCapsule = StitchRecoveryCapsule.renewAfterHealthyScan(
    recovered.state,
    { healthy: true, verified: true, validated: true, corruptionDetected: false },
    { epoch: 42, freshHealth: "clean" }
  );

  assert.ok(freshCapsule);
  assert.notEqual(freshCapsule.capsuleHash, oldCapsule.capsuleHash);

  const secondRecovery = StitchRecoveryCapsule.recover({ futureCorruption: true }, freshCapsule);
  assert.equal(secondRecovery.success, true);
  assert.equal(secondRecovery.state.epoch, 42);
  assert.equal(secondRecovery.state.freshHealth, "clean");
});

test("failed first scan cannot mint a fresh capsule", () => {
  const capsule = StitchRecoveryCapsule.seal(STITCH, { epoch: 41 });
  const recovered = StitchRecoveryCapsule.recover({ corrupt: true }, capsule);

  const scanVariants = [
    { healthy: false, verified: true, validated: true, corruptionDetected: false },
    { healthy: true, verified: false, validated: true, corruptionDetected: false },
    { healthy: true, verified: true, validated: false, corruptionDetected: false },
    { healthy: true, verified: true, validated: true, corruptionDetected: true }
  ];

  for (const scan of scanVariants) {
    assert.equal(StitchRecoveryCapsule.renewAfterHealthyScan(recovered.state, scan), null);
  }
});

test("recovery timing remains measurable and bounded for a compact capsule", () => {
  const largeMemory: Record<string, unknown> = {};
  for (let i = 0; i < 1000; i++) largeMemory[`k${i}`] = `value-${i}`;

  const capsule = StitchRecoveryCapsule.seal(STITCH, largeMemory);
  const samples: number[] = [];
  for (let i = 0; i < 100; i++) {
    const live = { corrupted: true, blob: "x".repeat(10000), duplicate: i };
    const recovered = StitchRecoveryCapsule.recover(live, capsule);
    assert.equal(recovered.success, true);
    samples.push(recovered.elapsedMs);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  assert.ok(Number.isFinite(p95));
  assert.ok(p95 < 100, `Expected compact-capsule p95 recovery under 100ms, got ${p95}ms`);
});
