/**
 * Red-team regression tests — finding 15 (prior-state anchoring: the
 * biggest research item) and finding 16 (malformed input never throws).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src";
import { BctVerifier, computeBraidBindingHash, computeTransitionHash } from "../src/truth/BctVerifier";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";
const STATE_A = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA" });
const STATE_B = Object.freeze({ protocol: "SB689", version: 2, owner: "JGA" });
const STATE_C = Object.freeze({ protocol: "SB689", version: 3, owner: "JGA" });

function makeVerifier() {
  const ledger = new AuditLedger();
  return { v: new BctVerifier(ledger, fixedClock(AT)), ledger };
}

function inputFor(state: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const declaredHash = hashOf(state);
  return {
    identity: "intent-001",
    state,
    declaredHash,
    braidBindingHash: computeBraidBindingHash(declaredHash, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    ...overrides
  };
}

// ─── Finding 15 ─────────────────────────────────────────────────────────────

test("15: a forged parent (unregistered prior, valid transition hash) is rejected", () => {
  const { v } = makeVerifier();
  const declaredHash = hashOf(STATE_A);
  const forgedPrior = hashOf({ prev: "state" });
  const result = v.verify(inputFor(STATE_A, {
    priorStateHash: forgedPrior,
    transitionHash: computeTransitionHash(declaredHash, forgedPrior)
  }));
  assert.equal(result.trusted, false, "anyone can compute a transition hash from two known hashes — it proves nothing alone");
  assert.ok(result.failedLayers.includes("transaction"));
});

test("15: genesis without explicit authorization is rejected", () => {
  const { v } = makeVerifier();
  const result = v.verify(inputFor(STATE_A));
  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("transaction"));
});

test("15: authorized genesis passes, but a second genesis for the same identity is rejected", () => {
  const { v, ledger } = makeVerifier();
  const first = v.verify(inputFor(STATE_A, { allowGenesis: true }));
  assert.equal(first.trusted, true);
  const second = v.verify(inputFor(STATE_B, {
    allowGenesis: true,
    priorAuditHash: first.auditHash
  }));
  assert.equal(second.trusted, false, "an identity with a head can never start over");
  assert.ok(second.failedLayers.includes("transaction"));
  assert.equal(ledger.verifyChain(), true);
});

test("15: a stale (old) parent is rejected after the head moves on", () => {
  const { v } = makeVerifier();
  const head = hashOf({ prev: "state" });
  v.registerHead("intent-001", head);
  const hashB = hashOf(STATE_B);
  const toB = v.verify(inputFor(STATE_B, {
    priorStateHash: head,
    transitionHash: computeTransitionHash(hashB, head)
  }));
  assert.equal(toB.trusted, true);
  assert.equal(v.registeredHead("intent-001"), hashB);
  // The old parent is now stale: a transition from it is rejected.
  const hashC = hashOf(STATE_C);
  const stale = v.verify(inputFor(STATE_C, {
    priorStateHash: head,
    transitionHash: computeTransitionHash(hashC, head),
    priorAuditHash: toB.auditHash
  }));
  assert.equal(stale.trusted, false);
  assert.ok(stale.failedLayers.includes("transaction"));
});

test("15: a competing branch (second child of the same parent) is rejected", () => {
  const { v } = makeVerifier();
  const head = hashOf({ prev: "state" });
  v.registerHead("intent-001", head);
  const hashB = hashOf(STATE_B);
  const branchB = v.verify(inputFor(STATE_B, {
    priorStateHash: head,
    transitionHash: computeTransitionHash(hashB, head)
  }));
  assert.equal(branchB.trusted, true);
  // A different state claiming the same parent is a competing branch.
  const hashC = hashOf(STATE_C);
  const branchC = v.verify(inputFor(STATE_C, {
    priorStateHash: head,
    transitionHash: computeTransitionHash(hashC, head),
    priorAuditHash: branchB.auditHash
  }));
  assert.equal(branchC.trusted, false);
  assert.ok(branchC.failedLayers.includes("transaction"));
});

test("15: a full sequential chain verifies end to end and the head tracks it", () => {
  const { v } = makeVerifier();
  const hashA = hashOf(STATE_A);
  const genesis = v.verify(inputFor(STATE_A, { allowGenesis: true }));
  assert.equal(genesis.trusted, true);
  assert.equal(v.registeredHead("intent-001"), hashA);

  const hashB = hashOf(STATE_B);
  const toB = v.verify(inputFor(STATE_B, {
    priorStateHash: hashA,
    transitionHash: computeTransitionHash(hashB, hashA),
    priorAuditHash: genesis.auditHash
  }));
  assert.equal(toB.trusted, true);
  assert.equal(v.registeredHead("intent-001"), hashB);

  const hashC = hashOf(STATE_C);
  const toC = v.verify(inputFor(STATE_C, {
    priorStateHash: hashB,
    transitionHash: computeTransitionHash(hashC, hashB),
    priorAuditHash: toB.auditHash
  }));
  assert.equal(toC.trusted, true);
  assert.equal(v.registeredHead("intent-001"), hashC);
});

test("15: a head seeded from a durable record anchors the next transition", () => {
  const { v } = makeVerifier();
  const knownHead = hashOf({ prev: "durable-state" });
  v.registerHead("intent-001", knownHead);
  const hashA = hashOf(STATE_A);
  const result = v.verify(inputFor(STATE_A, {
    priorStateHash: knownHead,
    transitionHash: computeTransitionHash(hashA, knownHead)
  }));
  assert.equal(result.trusted, true);
});

// ─── Finding 16 ─────────────────────────────────────────────────────────────

test("16: null / undefined / non-object input returns a rejection, never throws", () => {
  const { v, ledger } = makeVerifier();
  for (const bad of [null, undefined, "not-an-object", 42, true]) {
    let result: unknown;
    assert.doesNotThrow(() => { result = v.verify(bad as never); });
    const r = result as { trusted: boolean; layers: Array<{ passed: boolean }>; failedLayers: string[] };
    assert.equal(r.trusted, false);
    assert.equal(r.layers.length, 6);
    assert.ok(r.layers.every((l) => l.passed === false));
    assert.deepEqual([...r.failedLayers].sort(), ["audit", "braid", "crypto", "identity", "schema", "transaction"]);
  }
  // Nothing was appended for input that cannot even be attributed.
  assert.equal(ledger.entries().length, 0);
});

test("16: wrong-typed fields return a structured rejection, never throw", () => {
  const { v } = makeVerifier();
  let result: unknown;
  assert.doesNotThrow(() => {
    result = v.verify({
      identity: "x",
      state: null,
      declaredHash: 123,
      braidBindingHash: { not: "a-string" },
      spineSignature: null,
      priorAuditHash: ["GENESIS"]
    } as never);
  });
  const r = result as { trusted: boolean; failedLayers: string[] };
  assert.equal(r.trusted, false);
  assert.ok(r.failedLayers.includes("identity") === false, "identity itself was valid here");
  assert.ok(r.failedLayers.includes("schema"));
  assert.ok(r.failedLayers.includes("crypto"));
  assert.ok(r.failedLayers.includes("braid"));
  assert.ok(r.failedLayers.includes("audit"));
});

test("16: missing identity and empty state object are rejections, not exceptions", () => {
  const { v } = makeVerifier();
  const r1 = v.verify({ identity: "", state: {}, declaredHash: hashOf({}), braidBindingHash: "sha256:x", spineSignature: SPINE_SIG, priorAuditHash: "GENESIS", allowGenesis: true } as never);
  assert.equal(r1.trusted, false);
  assert.ok(r1.failedLayers.includes("identity"));
  const r2 = v.verify({ state: {}, declaredHash: hashOf({}), braidBindingHash: "sha256:x", spineSignature: SPINE_SIG, priorAuditHash: "GENESIS" } as never);
  assert.equal(r2.trusted, false);
  assert.ok(r2.failedLayers.includes("identity"));
});
