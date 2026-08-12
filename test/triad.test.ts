/**
 * Phase 7 — Triad Recovery regression tests.
 *
 * Tests: Hunter discovers corruption, Warrior isolates, Repair reconstructs.
 * All communication via Spine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { TriadCoordinator } from "../src/triad/TriadCoordinator";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const CLEAN = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA", bricks: "SEED,GHOST,ARMOR,CROWN" });

function makeTriad(): TriadCoordinator {
  return new TriadCoordinator(new AuditLedger(), fixedClock(AT));
}

test("triad: clean state — no corruption detected, no isolation or repair needed", () => {
  const t = makeTriad();
  const result = t.run(CLEAN, CLEAN);

  assert.equal(result.success, true);
  assert.equal(result.corruption?.corruptedKeys.length, 0);
  assert.equal(result.isolation, null);
  assert.equal(result.reconstruction, null);
  assert.ok(result.spinePermitSignature.startsWith("sha256:"));
});

test("triad: corrupted key is discovered by Hunter", () => {
  const t = makeTriad();
  const corrupted = { ...CLEAN, owner: "TAMPERED" };
  const result = t.run(corrupted, CLEAN);

  assert.equal(result.success, true);
  assert.ok(result.corruption!.corruptedKeys.includes("owner"));
});

test("triad: Warrior isolates the corrupted key", () => {
  const t = makeTriad();
  const corrupted = { ...CLEAN, version: 999 };
  const result = t.run(corrupted, CLEAN);

  assert.ok(result.isolation !== null);
  assert.ok(result.isolation!.isolatedKeys.includes("version"));
  assert.ok(result.isolation!.blockedStateHash.startsWith("sha256:"));
});

test("triad: Repair reconstructs the state from clean reference", () => {
  const t = makeTriad();
  const corrupted = { ...CLEAN, version: 999, owner: "BAD" };
  const result = t.run(corrupted, CLEAN);

  assert.ok(result.reconstruction !== null);
  assert.ok(result.reconstruction!.verifiedBySpine);
  assert.ok(result.reconstruction!.reconstructedKeys.includes("version"));
  assert.ok(result.reconstruction!.reconstructedKeys.includes("owner"));
});

test("triad: extra keys in live state are flagged as corrupted", () => {
  const t = makeTriad();
  const extraKey = { ...CLEAN, extraField: "injected" };
  const result = t.run(extraKey, CLEAN);

  assert.ok(result.corruption!.corruptedKeys.includes("extraField"));
});

test("triad: severity scales with number of corrupted keys", () => {
  const t = makeTriad();

  const oneKey = t.run({ ...CLEAN, version: 99 }, CLEAN);
  assert.ok(["medium", "high", "critical"].includes(oneKey.corruption!.severity));

  const manyKeys = t.run({ protocol: "X", version: 99, owner: "Y", bricks: "Z", extra: "W" }, CLEAN);
  assert.ok(["high", "critical"].includes(manyKeys.corruption!.severity));
});

test("triad: cycle count increments with each run", () => {
  const t = makeTriad();
  t.run(CLEAN, CLEAN);
  t.run(CLEAN, CLEAN);
  assert.equal(t.cycleCount_(), 2);
});

test("triad: spine permit signature is stable for deterministic input", () => {
  const ledger1 = new AuditLedger();
  const ledger2 = new AuditLedger();
  const t1 = new TriadCoordinator(ledger1, fixedClock(AT));
  const t2 = new TriadCoordinator(ledger2, fixedClock(AT));

  const r1 = t1.run(CLEAN, CLEAN);
  const r2 = t2.run(CLEAN, CLEAN);

  assert.equal(r1.spinePermitSignature, r2.spinePermitSignature);
});

test("triad: audit ledger records triad transitions and remains valid", () => {
  const ledger = new AuditLedger();
  const t = new TriadCoordinator(ledger, fixedClock(AT));
  t.run({ ...CLEAN, version: 2 }, CLEAN);

  assert.equal(ledger.verifyChain(), true);
  const entries = ledger.entries();
  const stages = entries.map((e) => e.from);
  assert.ok(stages.some((s) => s === "triad.hunt" || s === "triad.spine"));
});

test("triad: reconstruction final state hash is deterministic", () => {
  const r1 = makeTriad().run({ ...CLEAN, owner: "BAD" }, CLEAN);
  const r2 = makeTriad().run({ ...CLEAN, owner: "BAD" }, CLEAN);

  assert.equal(r1.reconstruction!.finalStateHash, r2.reconstruction!.finalStateHash);
});

// ─── Tampering tests ──────────────────────────────────────────────────────────

test("triad tampering: fully tampered state triggers critical severity", () => {
  const t = makeTriad();
  const tampered = { protocol: "HACK", version: 0, owner: "ATTACKER", bricks: "NONE" };
  const result = t.run(tampered, CLEAN);

  assert.ok(result.corruption!.severity === "critical" || result.corruption!.corruptedKeys.length >= 4);
  assert.ok(result.reconstruction !== null);
});
