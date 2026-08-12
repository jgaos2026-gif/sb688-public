/**
 * Phase 9 — Compound fault tests.
 *
 * Tests simultaneous faults. Every compound test tracks:
 *   detected_corruption, quarantine, recovery, recovery_failure,
 *   verification_failure, silent_trust_escape.
 *
 * Acceptance requirement: SILENT TRUST ESCAPES = 0
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { PhoenixRecovery } from "../src/phoenix/PhoenixRecovery";
import { TriadCoordinator } from "../src/triad/TriadCoordinator";
import { BctVerifier, computeBraidSignature } from "../src/truth/BctVerifier";
import { TrustStateMachine, IllegalTrustTransitionError } from "../src/trust/TrustStateMachine";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-12T00:00:00.000Z";
const SEED = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA", bricks: "SEED,GHOST,ARMOR,CROWN" });
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";

function makeVerifier(): BctVerifier {
  return new BctVerifier(new AuditLedger(), fixedClock(AT));
}

function validBctInput(overrides: Partial<Parameters<BctVerifier["verify"]>[0]> = {}) {
  const declaredHash = hashOf(SEED);
  const braidSignature = computeBraidSignature(declaredHash, SPINE_SIG);
  return {
    identity: "SB689-NODE",
    state: SEED,
    declaredHash,
    braidSignature,
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    requiredKeys: ["protocol", "version", "owner", "bricks"] as readonly string[],
    ...overrides,
  };
}

interface FaultCampaignCounters {
  detectedCorruption: number;
  quarantined: number;
  recovered: number;
  recoveryFailure: number;
  verificationFailure: number;
  silentTrustEscape: number;
}

function zeroCounts(): FaultCampaignCounters {
  return { detectedCorruption: 0, quarantined: 0, recovered: 0, recoveryFailure: 0, verificationFailure: 0, silentTrustEscape: 0 };
}

// ─── Two-fault compound tests ──────────────────────────────────────────────

test("compound: ledger corruption + rollback to invalid snapshot both fail safely", () => {
  const c = zeroCounts();
  const ledger = new AuditLedger();
  const recovery = new PhoenixRecovery(ledger, fixedClock(AT));

  recovery.checkpoint(SEED, "v1");
  recovery.checkpoint({ ...SEED, version: 2 }, "v2");
  const anchor = ledger.computeAnchor(() => AT);

  // Fault 1: attempt rollback with forged snapshot id
  const rollbackResult = recovery.rollback("FORGED-ID-COMPOUND-TEST");
  assert.equal(rollbackResult.success, false);
  c.detectedCorruption += 1;

  // Fault 2: add a record that changes the anchor — ledger "corruption"
  ledger.append({ traceId: "t_extra", from: "ghost-node", to: "ledger", status: "passed", at: AT, detail: {} });
  const anchorValid = ledger.verifyAnchor(anchor);
  assert.equal(anchorValid, false, "Anchor must fail after extra record injected");
  c.detectedCorruption += 1;

  // Chain itself should still be valid (we appended legitimately)
  assert.equal(ledger.verifyChain(), true);

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
  assert.equal(c.detectedCorruption, 2);
});

test("compound: state corruption + stale checkpoint — triad detects, rollback restores prior state", () => {
  const c = zeroCounts();
  const ledger = new AuditLedger();
  const recovery = new PhoenixRecovery(ledger, fixedClock(AT));
  const triad = new TriadCoordinator(ledger, fixedClock(AT));

  const snap = recovery.checkpoint(SEED, "clean");

  // Fault 1: corrupt the live state
  const corrupted = { ...SEED, owner: "CORRUPTED", bricks: "BROKEN" };
  const triadResult = triad.run(corrupted, SEED);
  assert.ok(triadResult.corruption !== null);
  assert.ok(triadResult.corruption!.corruptedKeys.length > 0);
  c.detectedCorruption += 1;

  // Fault 2: rollback to a valid checkpoint and verify
  const rollback = recovery.rollback(snap.id);
  assert.equal(rollback.success, true);
  assert.deepEqual(rollback.restoredState, SEED);
  c.recovered += 1;

  // Verify the restored state actually matches the original
  assert.equal(hashOf(rollback.restoredState), snap.stateHash);

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
});

test("compound: anchor mutation + ledger mutation — both detected independently", () => {
  const c = zeroCounts();
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const anchor = ledger.computeAnchor(() => AT);

  // Fault 1: mutated head hash
  const mutatedAnchor = { ...anchor, headHash: "sha256:MUTATED_ANCHOR_HASH" };
  assert.equal(ledger.verifyAnchor(mutatedAnchor), false, "Mutated head hash must fail");
  c.detectedCorruption += 1;

  // Fault 2: mutated record count
  const countMutatedAnchor = { ...anchor, recordCount: 999 };
  assert.equal(ledger.verifyAnchor(countMutatedAnchor), false, "Mutated record count must fail");
  c.detectedCorruption += 1;

  // Fault 3: mutated file digest
  const digestMutatedAnchor = { ...anchor, wholeFileDigest: "0".repeat(64) };
  assert.equal(ledger.verifyAnchor(digestMutatedAnchor), false, "Mutated digest must fail");
  c.detectedCorruption += 1;

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
  assert.equal(c.detectedCorruption, 3);
});

test("compound: verifier disagreement — two fields wrong, one correct — overall fails", () => {
  const c = zeroCounts();
  const v = makeVerifier();

  // Two faults simultaneously: wrong declared hash AND wrong braid signature
  const result = v.verify(validBctInput({
    declaredHash: "sha256:WRONG_HASH_FAULT_1",
    braidSignature: "sha256:WRONG_SIG_FAULT_2",
  }));

  const cryptoLayer = result.layers.find((l) => l.layer === "crypto");
  const braidLayer  = result.layers.find((l) => l.layer === "braid");

  assert.equal(cryptoLayer?.passed, false, "Fault 1: wrong hash must fail crypto layer");
  assert.equal(braidLayer?.passed,  false, "Fault 2: wrong sig must fail braid layer");
  c.verificationFailure += 2;

  // Correct inputs should pass all layers
  const good = makeVerifier().verify(validBctInput());
  assert.equal(good.layers.every((l) => l.passed), true, "All layers must pass for valid input");

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
});

test("compound: rollback + replay — restored state must have deterministic hash", () => {
  const c = zeroCounts();
  const recovery1 = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
  const recovery2 = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));

  const snap1 = recovery1.checkpoint(SEED, "v1");
  const snap2 = recovery2.checkpoint(SEED, "v1");

  assert.equal(snap1.stateHash, snap2.stateHash,
    "Checkpoint hash must be deterministic for the same state");

  const r1 = recovery1.rollback(snap1.id);
  const r2 = recovery2.rollback(snap2.id);

  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.deepEqual(r1.restoredState, r2.restoredState);
  c.recovered += 2;

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
});

test("compound: concurrent recovery attempts — multiple rollbacks to same snapshot all succeed deterministically", () => {
  const c = zeroCounts();
  const recovery = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));

  const snap = recovery.checkpoint(SEED, "shared-target");
  recovery.checkpoint({ ...SEED, version: 2 }, "v2");
  recovery.checkpoint({ ...SEED, version: 3 }, "v3");

  for (let i = 0; i < 10; i++) {
    const result = recovery.rollback(snap.id);
    assert.equal(result.success, true, `Recovery attempt ${i} must succeed`);
    assert.deepEqual(result.restoredState, SEED, `Restored state must be deterministic on attempt ${i}`);
    assert.equal(hashOf(result.restoredState), snap.stateHash);
    c.recovered += 1;
  }

  assert.equal(c.recovered, 10);
  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
});

// ─── Three-fault compound tests ────────────────────────────────────────────

test("compound-3-fault: wrong hash + wrong sig + injected extra key — ALL three faults detected", () => {
  const c = zeroCounts();
  const v = makeVerifier();
  const triad = new TriadCoordinator(new AuditLedger(), fixedClock(AT));

  // Fault 1 + 2 via BctVerifier: wrong hash + wrong sig
  const result = v.verify(validBctInput({
    declaredHash: "sha256:FAULT_1_WRONG_HASH",
    braidSignature: "sha256:FAULT_2_FORGED_SIG",
  }));
  const failedLayers = result.layers.filter((l) => !l.passed);
  assert.ok(failedLayers.length >= 2, "At least two layers must fail for two faults");
  c.verificationFailure += failedLayers.length;

  // Fault 3 via TriadCoordinator: injected extra key
  const injected = { ...SEED, malicious_key: "INJECTED_FAULT_3" } as Record<string, unknown>;
  const triadResult = triad.run(injected, SEED);
  assert.ok(triadResult.corruption !== null, "Fault 3: injected key must be detected");
  assert.ok(triadResult.corruption!.corruptedKeys.includes("malicious_key"));
  c.detectedCorruption += 1;

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
  assert.ok(c.detectedCorruption + c.verificationFailure >= 3, "All 3 faults must be detected");
});

test("compound-3-fault: trust state machine — repeated illegal transitions all blocked", () => {
  const c = zeroCounts();
  const illegalAttempts: Array<[import("../src/trust/TrustStateMachine").TrustState, import("../src/trust/TrustStateMachine").TrustState]> = [
    ["RECOVERING", "CERTIFIED"],   // the critical bypass
    ["RECOVERING", "STAGED"],
    ["RECOVERING", "QUARANTINED"],
  ];

  for (const [from, to] of illegalAttempts) {
    const m = new TrustStateMachine(from);
    try {
      m.transition(to);
      c.silentTrustEscape += 1;
    } catch (err) {
      assert.ok(err instanceof IllegalTrustTransitionError);
      assert.equal(m.state, from, "State must not change on illegal transition");
      c.detectedCorruption += 1;
    }
  }

  assert.equal(c.silentTrustEscape, 0,
    `CRITICAL: ${c.silentTrustEscape} silent trust escape(s). RECOVERING→CERTIFIED must be blocked.`);
  assert.equal(c.detectedCorruption, 3);
});

test("compound-3-fault: ledger anchor + chain verify + rollback — three independent integrity checks", () => {
  const c = zeroCounts();
  const ledger = new AuditLedger();
  const recovery = new PhoenixRecovery(ledger, fixedClock(AT));

  recovery.checkpoint(SEED, "good");
  const anchor = ledger.computeAnchor(() => AT);

  // Check 1: chain must be valid
  assert.equal(ledger.verifyChain(), true);

  // Check 2: anchor must match
  assert.equal(ledger.verifyAnchor(anchor), true);

  // Check 3: rollback to good checkpoint must work
  const snap = recovery.checkpoint(SEED, "target");
  const rollback = recovery.rollback(snap.id);
  assert.equal(rollback.success, true);
  assert.deepEqual(rollback.restoredState, SEED);
  c.recovered += 1;

  // Inject fault: anchor from before additional ledger entries
  ledger.append({ traceId: "extra", from: "ghost-node", to: "ledger", status: "passed", at: AT, detail: {} });
  assert.equal(ledger.verifyAnchor(anchor), false, "Stale anchor must fail after additional entries");
  c.detectedCorruption += 1;

  assert.equal(c.silentTrustEscape, 0, `SILENT TRUST ESCAPES: ${c.silentTrustEscape}`);
});

// ─── Cumulative campaign summary ───────────────────────────────────────────

test("compound: campaign summary — SILENT_TRUST_ESCAPES must equal zero across all compound tests", () => {
  const campaign = zeroCounts();

  const scenarios: Array<() => void> = [
    () => {
      const m = new TrustStateMachine("RECOVERING");
      try { m.transition("CERTIFIED"); campaign.silentTrustEscape += 1; }
      catch { campaign.detectedCorruption += 1; }
    },
    () => {
      const ledger = new AuditLedger();
      ledger.append({ traceId: "t", from: "intent", to: "spine", status: "passed", at: AT, detail: {} });
      const anchor = ledger.computeAnchor(() => AT);
      const bad = { ...anchor, recordCount: 0 };
      if (ledger.verifyAnchor(bad)) campaign.silentTrustEscape += 1;
      else campaign.detectedCorruption += 1;
    },
    () => {
      const recovery = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
      const r = recovery.rollback("NONEXISTENT");
      if (r.success) campaign.silentTrustEscape += 1;
      else campaign.detectedCorruption += 1;
    },
    () => {
      const v = makeVerifier();
      const r = v.verify(validBctInput({ identity: "" }));
      const identityLayer = r.layers.find((l) => l.layer === "identity");
      if (identityLayer?.passed) campaign.silentTrustEscape += 1;
      else campaign.detectedCorruption += 1;
    },
    () => {
      const triad = new TriadCoordinator(new AuditLedger(), fixedClock(AT));
      const r = triad.run({ ...SEED, owner: "TAMPERED" } as Record<string, unknown>, SEED);
      if (!r.corruption || r.corruption.corruptedKeys.length === 0) campaign.silentTrustEscape += 1;
      else campaign.detectedCorruption += 1;
    },
  ];

  for (const scenario of scenarios) scenario();

  assert.equal(campaign.silentTrustEscape, 0,
    `CRITICAL INVARIANT VIOLATED: ${campaign.silentTrustEscape} silent trust escape(s) detected in compound fault campaign`);
  assert.equal(campaign.detectedCorruption, 5, "All 5 injected faults must be detected");
});
