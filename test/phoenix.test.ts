/**
 * Phase 7 — Phoenix Recovery regression tests.
 *
 * Tests: checkpoint, rollback, selective repair, restart, replay,
 *        chain validation, metrics, journal verification.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { PhoenixRecovery } from "../src/phoenix/PhoenixRecovery";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
let t = 0;
const testNowMs = () => (t += 0.1);

function makeRecovery(): PhoenixRecovery {
  return new PhoenixRecovery(new AuditLedger(), fixedClock(AT), testNowMs);
}

const STATE_A = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA" });
const STATE_B = Object.freeze({ protocol: "SB689", version: 2, owner: "JGA" });
const STATE_C = Object.freeze({ protocol: "SB689", version: 3, owner: "JGA" });

test("phoenix: checkpoint creates a verified snapshot with chain hash", () => {
  const r = makeRecovery();
  const snap = r.checkpoint(STATE_A, "genesis");

  assert.equal(snap.verified, true);
  assert.equal(snap.sequence, 1);
  assert.equal(snap.label, "genesis");
  assert.ok(snap.stateHash.startsWith("sha256:"));
  assert.equal(snap.previousHash, "GENESIS");
  assert.ok(snap.chainHash.startsWith("sha256:"));
});

test("phoenix: multiple checkpoints form a hash chain", () => {
  const r = makeRecovery();
  const s1 = r.checkpoint(STATE_A, "v1");
  const s2 = r.checkpoint(STATE_B, "v2");
  const s3 = r.checkpoint(STATE_C, "v3");

  assert.equal(s1.previousHash, "GENESIS");
  assert.equal(s2.previousHash, s1.chainHash);
  assert.equal(s3.previousHash, s2.chainHash);
});

test("phoenix: validateChain returns valid after clean checkpoints", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A);
  r.checkpoint(STATE_B);
  const v = r.validateChain();
  assert.equal(v.valid, true);
  assert.equal(v.journalValid, true);
  assert.equal(v.length, 2);
});

test("phoenix: rollback restores a prior snapshot", () => {
  const r = makeRecovery();
  const s1 = r.checkpoint(STATE_A, "v1");
  r.checkpoint(STATE_B, "v2");

  const result = r.rollback(s1.id);
  assert.equal(result.success, true);
  assert.deepEqual(result.restoredState, STATE_A);
  assert.equal(result.snapshotChainValid, true);
});

test("phoenix: rollback fails for unknown snapshot id", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A);
  const result = r.rollback("nonexistent-id");
  assert.equal(result.success, false);
  assert.deepEqual(result.restoredState, {});
});

test("phoenix: selective repair patches corrupted keys from reference", () => {
  const r = makeRecovery();
  const ref = r.checkpoint(STATE_A, "reference");
  const corrupted = { protocol: "CORRUPTED", version: 99, owner: "TAMPERED" };

  const result = r.repair(corrupted, ref.id, ["protocol", "owner"]);
  assert.equal(result.success, true);
  assert.deepEqual(result.repairedKeys, ["protocol", "owner"]);
  assert.equal(result.skippedKeys.length, 0);
});

test("phoenix: selective repair skips keys not in reference", () => {
  const r = makeRecovery();
  const ref = r.checkpoint(STATE_A, "ref");
  const result = r.repair({ unknown_key: "bad" }, ref.id, ["unknown_key"]);
  assert.equal(result.success, true);
  assert.deepEqual(result.skippedKeys, ["unknown_key"]);
  assert.deepEqual(result.repairedKeys, []);
});

test("phoenix: repair fails when reference snapshot not found", () => {
  const r = makeRecovery();
  const result = r.repair(STATE_A, "bad-id", ["protocol"]);
  assert.equal(result.success, false);
});

test("phoenix: restart returns genesis state", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A, "genesis");
  r.checkpoint(STATE_B, "v2");

  const result = r.restart();
  assert.equal(result.success, true);
  assert.deepEqual(result.state, STATE_A);
});

test("phoenix: restart fails when no snapshots exist", () => {
  const r = makeRecovery();
  const result = r.restart();
  assert.equal(result.success, false);
});

test("phoenix: replay is deterministic across recorded checkpoints", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A, "v1");
  r.checkpoint(STATE_B, "v2");
  r.checkpoint(STATE_C, "v3");

  const result = r.replay();
  assert.equal(result.success, true);
  assert.equal(result.deterministic, true);
  assert.equal(result.stepsReplayed, 3);
  assert.ok(result.finalStateHash.startsWith("sha256:"));
});

test("phoenix: replay fails when no checkpoints exist", () => {
  const r = makeRecovery();
  const result = r.replay();
  assert.equal(result.success, false);
  assert.equal(result.deterministic, false);
});

test("phoenix: metrics track operations correctly", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A);
  r.checkpoint(STATE_B);
  const snap = r.checkpoint(STATE_C);
  r.rollback(snap.id);
  r.repair({}, snap.id, []);
  r.restart();
  r.replay();

  const m = r.metrics();
  assert.equal(m.totalCheckpoints, 3);
  assert.equal(m.totalRollbacks, 1);
  assert.equal(m.totalRepairs, 1);
  assert.equal(m.totalRestarts, 1);
  assert.equal(m.totalReplays, 1);
  assert.ok(m.recoverySuccessRate > 0);
  assert.equal(m.determinismScore, 1);
});

test("phoenix: journal is tamper-evident and verifiable", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A);
  r.checkpoint(STATE_B);
  const v = r.validateChain();
  assert.equal(v.journalValid, true);
  const entries = r.journalEntries();
  assert.ok(entries.length >= 2);
});

test("phoenix: audit ledger records all operations", () => {
  const ledger = new AuditLedger();
  const r = new PhoenixRecovery(ledger, fixedClock(AT), testNowMs);
  r.checkpoint(STATE_A);
  const snap = r.checkpoint(STATE_B);
  r.rollback(snap.id);

  assert.ok(ledger.entries().length >= 3);
  assert.equal(ledger.verifyChain(), true);
});

// ─── Bit-rot simulation ──────────────────────────────────────────────────────

test("phoenix bit-rot: modified state hash differs from original checkpoint hash", () => {
  const r = makeRecovery();
  const snap = r.checkpoint(STATE_A);

  // Simulate bit-rot by changing a value in the state.
  const rotted = { ...STATE_A, version: 9999 };
  const rottedHash = hashOfState(rotted);

  assert.notEqual(rottedHash, snap.stateHash);
});

// ─── Power-loss simulation ────────────────────────────────────────────────────

test("phoenix power-loss: restart always returns to genesis even after many checkpoints", () => {
  const r = makeRecovery();
  r.checkpoint(STATE_A, "genesis");

  for (let i = 0; i < 20; i++) {
    r.checkpoint({ ...STATE_A, cycle: i });
  }

  // Simulate power-loss recovery: restart must return genesis
  const result = r.restart();
  assert.equal(result.success, true);
  assert.deepEqual(result.state, STATE_A);
});

// ─── Rollback stress ──────────────────────────────────────────────────────────

test("phoenix rollback stress: rollback to every prior snapshot succeeds", () => {
  const r = makeRecovery();
  const snaps = [STATE_A, STATE_B, STATE_C].map((s, i) => r.checkpoint(s, `v${i}`));

  for (const snap of snaps) {
    const result = r.rollback(snap.id);
    assert.equal(result.success, true, `Rollback to ${snap.id} failed`);
    assert.equal(result.snapshotChainValid, true);
  }
});

function hashOfState(state: Record<string, unknown>): string {
  const { hashOf } = require("../src/utils/hash");
  return hashOf(state);
}
