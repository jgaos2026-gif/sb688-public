/**
 * Phase 7 — BCT Verification layers regression tests.
 *
 * Every state transition must pass all six layers:
 *   identity, schema, crypto, braid, transaction, audit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { BctVerifier, computeBraidSignature } from "../src/truth/BctVerifier";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const STATE = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA" });
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";

function makeVerifier(): { v: BctVerifier; ledger: AuditLedger } {
  const ledger = new AuditLedger();
  return { v: new BctVerifier(ledger, fixedClock(AT)), ledger };
}

function validInput(overrides: Partial<Parameters<BctVerifier["verify"]>[0]> = {}) {
  const declaredHash = hashOf(STATE);
  const braidSignature = computeBraidSignature(declaredHash, SPINE_SIG);
  return {
    identity: "intent-001",
    state: STATE,
    declaredHash,
    braidSignature,
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    requiredKeys: ["protocol", "version", "owner"],
    ...overrides
  };
}

test("bct: all six layers pass for a valid input", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput());

  assert.equal(result.trusted, true);
  assert.equal(result.failedLayers.length, 0);
  assert.equal(result.layers.length, 6);
  assert.ok(result.finalHash.startsWith("sha256:"));
});

test("bct: identity layer fails for empty identity", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ identity: "" }));

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("identity"));
});

test("bct: schema layer fails when required key is missing", () => {
  const { v } = makeVerifier();
  const partialState = { protocol: "SB689", version: 1 } as Record<string, unknown>;
  const declaredHash = hashOf(partialState);
  const braidSignature = computeBraidSignature(declaredHash, SPINE_SIG);

  const result = v.verify(validInput({
    state: partialState,
    declaredHash,
    braidSignature,
    requiredKeys: ["protocol", "version", "owner"]
  }));

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("schema"));
});

test("bct: crypto layer fails when declared hash does not match actual state hash", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ declaredHash: "sha256:000000000tampered" }));

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("crypto"));
});

test("bct: braid layer fails when signature is wrong", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ braidSignature: "sha256:badbadbadbad" }));

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("braid"));
});

test("bct: transaction layer passes for genesis (no prior hash)", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ priorStateHash: undefined }));

  assert.equal(result.trusted, true);
  const txLayer = result.layers.find((l) => l.layer === "transaction")!;
  assert.equal(txLayer.passed, true);
});

test("bct: transaction layer passes for valid prior state hash", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ priorStateHash: hashOf({ prev: "state" }) }));

  const txLayer = result.layers.find((l) => l.layer === "transaction")!;
  assert.equal(txLayer.passed, true);
});

test("bct: transaction layer fails for malformed prior state hash", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ priorStateHash: "not-a-valid-hash" }));

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("transaction"));
});

test("bct: audit layer passes with GENESIS prior audit hash", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput({ priorAuditHash: "GENESIS" }));
  assert.equal(result.trusted, true);
});

test("bct: audit layer fails when ledger chain is inconsistent with prior hash", () => {
  const ledger = new AuditLedger();
  // Append something to move the chain forward.
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const v = new BctVerifier(ledger, fixedClock(AT));

  const declaredHash = hashOf(STATE);
  const braidSignature = computeBraidSignature(declaredHash, SPINE_SIG);

  // priorAuditHash is GENESIS but ledger no longer has GENESIS as latest.
  const result = v.verify({
    identity: "test",
    state: STATE,
    declaredHash,
    braidSignature,
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    requiredKeys: []
  });

  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("audit"));
});

test("bct: result is deterministic — same input produces same final hash", () => {
  const { v: v1 } = makeVerifier();
  const { v: v2 } = makeVerifier();

  const r1 = v1.verify(validInput());
  const r2 = v2.verify(validInput());

  assert.equal(r1.finalHash, r2.finalHash);
  assert.equal(r1.trusted, r2.trusted);
});

test("bct: all layers listed in result with correct names", () => {
  const { v } = makeVerifier();
  const result = v.verify(validInput());
  const names = result.layers.map((l) => l.layer);
  assert.deepEqual(names, ["identity", "schema", "crypto", "braid", "transaction", "audit"]);
});

test("bct: multiple independent states each produce distinct final hashes", () => {
  const { v } = makeVerifier();
  const stateA = { protocol: "SB689", version: 1, owner: "JGA" };
  const stateB = { protocol: "SB689", version: 2, owner: "JGA" };

  const hashA = hashOf(stateA);
  const hashB = hashOf(stateB);

  const r1 = v.verify({
    identity: "a",
    state: stateA,
    declaredHash: hashA,
    braidSignature: computeBraidSignature(hashA, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS"
  });

  const r2 = v.verify({
    identity: "b",
    state: stateB,
    declaredHash: hashB,
    braidSignature: computeBraidSignature(hashB, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: r1.auditHash
  });

  assert.notEqual(r1.finalHash, r2.finalHash);
  assert.equal(r1.trusted, true);
  assert.equal(r2.trusted, true);
});

test("computeBraidSignature: is deterministic", () => {
  const h1 = computeBraidSignature("sha256:abc", "sha256:def");
  const h2 = computeBraidSignature("sha256:abc", "sha256:def");
  assert.equal(h1, h2);
  assert.ok(h1.startsWith("sha256:"));
});
