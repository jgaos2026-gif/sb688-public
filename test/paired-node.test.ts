/**
 * Phase 7 — Paired Node System regression tests.
 *
 * Tests: Master/Witness independent verification, quorum, disagreement detection,
 *        audit trail, recovery authorization, deterministic synchronization.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { PairedNodeSystem } from "../src/paired/PairedNodeSystem";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const STATE = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA" });

function makePaired(): PairedNodeSystem {
  return new PairedNodeSystem(new AuditLedger(), fixedClock(AT));
}

test("paired: agree on same state — quorum reached", () => {
  const sys = makePaired();
  const result = sys.verify(STATE, STATE);

  assert.equal(result.agreed, true);
  assert.equal(result.decision, "agree");
  assert.equal(result.disagreementHash, null);
  assert.ok(result.masterCheckpoint.stateHash.startsWith("sha256:"));
  assert.ok(result.witnessCheckpoint.stateHash.startsWith("sha256:"));
  assert.equal(result.masterCheckpoint.stateHash, result.witnessCheckpoint.stateHash);
});

test("paired: disagree on different states — quorum fails", () => {
  const sys = makePaired();
  const masterState = STATE;
  const witnessState = { ...STATE, version: 99 };

  const result = sys.verify(masterState, witnessState);

  assert.equal(result.agreed, false);
  assert.equal(result.decision, "disagree");
  assert.ok(result.disagreementHash !== null);
  assert.notEqual(result.masterCheckpoint.stateHash, result.witnessCheckpoint.stateHash);
});

test("paired: witness never auto-trusts master — separate hashes", () => {
  const sys = makePaired();
  const masterState = { ...STATE, extra: "master-only" };
  const witnessState = STATE;

  const result = sys.verify(masterState, witnessState);

  // Even if master claims a state, witness produces its own independent hash.
  assert.notEqual(result.masterCheckpoint.stateHash, result.witnessCheckpoint.stateHash);
  assert.equal(result.agreed, false);
});

test("paired: each node produces its own signed checkpoint", () => {
  const sys = makePaired();
  const result = sys.verify(STATE, STATE);

  assert.equal(result.masterCheckpoint.role, "master");
  assert.equal(result.witnessCheckpoint.role, "witness");
  assert.ok(result.masterCheckpoint.signature.startsWith("sha256:"));
  assert.ok(result.witnessCheckpoint.signature.startsWith("sha256:"));
  // Signatures must differ (different roles)
  assert.notEqual(result.masterCheckpoint.signature, result.witnessCheckpoint.signature);
});

test("paired: recovery is authorized only after agreement", () => {
  const sys = makePaired();

  const agree = sys.verify(STATE, STATE);
  const disagree = sys.verify(STATE, { ...STATE, version: 2 });

  const authAgree = sys.authorizeRecovery(agree);
  const authDisagree = sys.authorizeRecovery(disagree);

  assert.equal(authAgree.authorized, true);
  assert.equal(authAgree.stateHash, agree.masterCheckpoint.stateHash);

  assert.equal(authDisagree.authorized, false);
  assert.equal(authDisagree.stateHash, null);
});

test("paired: audit log is tamper-evident", () => {
  const sys = makePaired();
  sys.verify(STATE, STATE);
  sys.verify(STATE, { ...STATE, version: 2 });

  assert.equal(sys.verifyAuditLog(), true);
  assert.equal(sys.auditLog_().length, 2);
});

test("paired: audit log records decision and state hashes", () => {
  const sys = makePaired();
  sys.verify(STATE, STATE);

  const log = sys.auditLog_();
  assert.equal(log[0].decision, "agree");
  assert.ok(log[0].masterStateHash.startsWith("sha256:"));
  assert.equal(log[0].authorizedBy, "quorum");
});

test("paired: disagreement audit entry records none as authorized", () => {
  const sys = makePaired();
  sys.verify(STATE, { ...STATE, version: 99 });

  const log = sys.auditLog_();
  assert.equal(log[0].decision, "disagree");
  assert.equal(log[0].authorizedBy, "none");
});

test("paired: state hash is deterministic across independent instances", () => {
  const sys1 = new PairedNodeSystem(new AuditLedger(), fixedClock(AT));
  const sys2 = new PairedNodeSystem(new AuditLedger(), fixedClock(AT));

  const r1 = sys1.verify(STATE, STATE);
  const r2 = sys2.verify(STATE, STATE);

  assert.equal(r1.masterCheckpoint.stateHash, r2.masterCheckpoint.stateHash);
  assert.equal(r1.witnessCheckpoint.stateHash, r2.witnessCheckpoint.stateHash);
});

test("paired: multiple agreement cycles all record quorum in audit log", () => {
  const sys = makePaired();
  for (let i = 0; i < 5; i++) {
    sys.verify(STATE, STATE);
  }
  const log = sys.auditLog_();
  assert.equal(log.length, 5);
  assert.ok(log.every((e) => e.authorizedBy === "quorum"));
  assert.equal(sys.verifyAuditLog(), true);
});

test("paired: disagreement hash encodes both state hashes deterministically", () => {
  const sys1 = makePaired();
  const sys2 = makePaired();
  const master = STATE;
  const witness = { ...STATE, version: 5 };

  const r1 = sys1.verify(master, witness);
  const r2 = sys2.verify(master, witness);

  assert.equal(r1.disagreementHash, r2.disagreementHash);
});

// ─── Replay attack tests ──────────────────────────────────────────────────────

test("paired replay: re-verifying the same state produces a new sequence checkpoint", () => {
  const sys = makePaired();
  const r1 = sys.verify(STATE, STATE);
  const r2 = sys.verify(STATE, STATE);

  // Both should agree but have different sequence numbers.
  assert.equal(r1.masterCheckpoint.sequence, 1);
  assert.equal(r2.masterCheckpoint.sequence, 2);
  assert.equal(r1.auditHash !== r2.auditHash, true);
});
