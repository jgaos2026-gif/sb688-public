/**
 * Phase 7 — Phoenix Patrol regression tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { PhoenixRecovery } from "../src/phoenix/PhoenixRecovery";
import { PhoenixPatrol } from "../src/phoenix/PhoenixPatrol";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const SEED = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA" });

function makePatrol(): { patrol: PhoenixPatrol; ledger: AuditLedger } {
  const ledger = new AuditLedger();
  const recovery = new PhoenixRecovery(ledger, fixedClock(AT));
  recovery.checkpoint(SEED, "genesis");
  return { patrol: new PhoenixPatrol(ledger, recovery, fixedClock(AT)), ledger };
}

test("patrol: healthy cycle reports no anomalies", () => {
  const { patrol } = makePatrol();
  const report = patrol.patrol({ liveState: SEED, seedState: SEED });

  assert.equal(report.healthy, true);
  assert.equal(report.anomalies.length, 0);
  assert.ok(report.findings.includes("healthy"));
});

test("patrol: detects state drift between live and seed", () => {
  const { patrol } = makePatrol();
  const drifted = { ...SEED, version: 99 };
  const report = patrol.patrol({ liveState: drifted, seedState: SEED });

  assert.equal(report.healthy, false);
  assert.ok(report.findings.includes("integrity_failed"));
  assert.ok(report.anomalies.some((a) => a.includes("state_drift")));
});

test("patrol: flags suspicious upload filenames and quarantines them", () => {
  const { patrol } = makePatrol();
  const report = patrol.patrol({
    liveState: SEED,
    seedState: SEED,
    uploadLog: ["../../etc/passwd", "safe.txt", "../bad.sh"]
  });

  assert.equal(report.healthy, false);
  assert.ok(report.findings.includes("upload_anomaly"));
  assert.ok(report.quarantined.includes("../../etc/passwd"));
  assert.ok(report.quarantined.includes("../bad.sh"));
  assert.ok(!report.quarantined.includes("safe.txt"));
});

test("patrol: quarantine list accumulates across cycles", () => {
  const { patrol } = makePatrol();
  patrol.patrol({ liveState: SEED, seedState: SEED, uploadLog: ["../bad1.sh"] });
  patrol.patrol({ liveState: SEED, seedState: SEED, uploadLog: ["../bad2.sh"] });
  const q = patrol.quarantineList();
  assert.ok(q.includes("../bad1.sh"));
  assert.ok(q.includes("../bad2.sh"));
});

test("patrol: braid mismatch triggers braid_invalid finding", () => {
  const { patrol } = makePatrol();
  const { hashOf } = require("../src/utils/hash");
  const expectedHash = hashOf(SEED.protocol);
  const braidSigs = new Map([["protocol", expectedHash]]);

  // First cycle: no mismatch
  const r1 = patrol.patrol({ liveState: SEED, seedState: SEED, braidSignatures: braidSigs });
  assert.ok(!r1.findings.includes("braid_invalid"));

  // Second cycle: tamper the braid
  const tamperedSigs = new Map([["protocol", "sha256:00000000tampered"]]);
  const r2 = patrol.patrol({ liveState: SEED, seedState: SEED, braidSignatures: tamperedSigs });
  assert.equal(r2.healthy, false);
  assert.ok(r2.findings.includes("braid_invalid"));
});

test("patrol: filesystem path traversal triggers filesystem_anomaly", () => {
  const { patrol } = makePatrol();
  const report = patrol.patrol({
    liveState: SEED,
    seedState: SEED,
    filesystemPaths: ["/etc/shadow", "/proc/1/mem", "/safe/path"]
  });

  assert.equal(report.healthy, false);
  assert.ok(report.findings.includes("filesystem_anomaly"));
  assert.ok(report.quarantined.includes("/etc/shadow"));
});

test("patrol: audit log is tamper-evident and verifiable", () => {
  const { patrol } = makePatrol();
  patrol.patrol({ liveState: SEED, seedState: SEED });
  patrol.patrol({ liveState: { ...SEED, version: 2 }, seedState: SEED });

  assert.equal(patrol.verifyAuditLog(), true);
  assert.ok(patrol.patrolAuditLog().length > 0);
});

test("patrol: cycle counter increments across patrols", () => {
  const { patrol } = makePatrol();
  const r1 = patrol.patrol({ liveState: SEED, seedState: SEED });
  const r2 = patrol.patrol({ liveState: SEED, seedState: SEED });

  assert.equal(r1.cycle, 1);
  assert.equal(r2.cycle, 2);
});

test("patrol: each report has a unique chain hash", () => {
  const { patrol } = makePatrol();
  const r1 = patrol.patrol({ liveState: SEED, seedState: SEED });
  const r2 = patrol.patrol({ liveState: SEED, seedState: SEED });

  // Same state produces same hash for same input but cycle differs, so hashes differ.
  assert.notEqual(r1.chainHash, r2.chainHash);
});

test("patrol: ledger chain remains valid after multiple patrol cycles", () => {
  const { patrol, ledger } = makePatrol();
  for (let i = 0; i < 5; i++) {
    patrol.patrol({ liveState: SEED, seedState: SEED });
  }
  assert.equal(ledger.verifyChain(), true);
});
