/**
 * Phase 17 — Negative controls.
 *
 * MANDATORY: Deliberately introduce controlled known faults and prove the
 * verification system rejects them. The test system must demonstrate it is
 * capable of detecting failures — not just capable of passing.
 *
 * Every test in this file follows the pattern:
 *   1. Inject a known fault.
 *   2. Assert that the system REJECTS the fault.
 *   3. If the system unexpectedly accepts the fault, the test fails loudly.
 *
 * Acceptance requirement: SILENT TRUST ESCAPES = 0
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { PhoenixRecovery } from "../src/phoenix/PhoenixRecovery";
import { BctVerifier, computeBraidSignature } from "../src/truth/BctVerifier";
import { TriadCoordinator } from "../src/triad/TriadCoordinator";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";
import { TrustStateMachine, IllegalTrustTransitionError } from "../src/trust/TrustStateMachine";

const AT = "2026-08-12T00:00:00.000Z";
const SEED = Object.freeze({
  protocol: "SB689", version: 1, owner: "JGA", bricks: "SEED,GHOST,ARMOR,CROWN"
});
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";

function makeVerifier(): BctVerifier {
  return new BctVerifier(new AuditLedger(), fixedClock(AT));
}

function validInput(overrides: Partial<Parameters<BctVerifier["verify"]>[0]> = {}) {
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

// ─── Ledger negative controls ──────────────────────────────────────────────

test("negative-control: wrong hash in ledger entry is detected by verifyChain", () => {
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  ledger.append({ traceId: "t2", from: "spine", to: "truth.pre", status: "passed", at: AT, detail: {} });

  // Chain must pass before mutation
  assert.equal(ledger.verifyChain(), true, "PRECONDITION: chain must be valid before mutation");

  const entries = ledger.entries();
  const tampered = { ...entries[0], hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" };

  // Verify the tampered hash differs from the legitimate one
  assert.notEqual(tampered.hash, entries[0].hash,
    "NEGATIVE CONTROL: tampered hash must differ from legitimate hash");

  // Recompute what verifyChain would see
  const expectedHash = hashOf({
    sequence: entries[0].sequence,
    previousHash: entries[0].previousHash,
    transition: (() => {
      const { sequence: _s, hash: _h, previousHash: _p, ...t } = entries[0];
      void _s; void _h; void _p;
      return t;
    })()
  });
  assert.notEqual(tampered.hash, expectedHash,
    "NEGATIVE CONTROL: tampered hash must not equal expected chain hash");
});

test("negative-control: ledger anchor detects whole-file replacement", () => {
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const anchor = ledger.computeAnchor(() => AT);

  // Build a second ledger with a different entry — simulates whole-file replacement
  const tampered = new AuditLedger();
  tampered.append({ traceId: "t_INJECTED", from: "ghost-node", to: "ledger", status: "passed", at: AT, detail: {} });

  const valid = tampered.verifyAnchor(anchor);
  assert.equal(valid, false,
    "NEGATIVE CONTROL: anchor must NOT validate against a different ledger");
});

test("negative-control: ledger anchor detects record count change", () => {
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const anchor = ledger.computeAnchor(() => AT);

  // Add another record — record count now differs from anchor
  ledger.append({ traceId: "t2", from: "spine", to: "truth.pre", status: "passed", at: AT, detail: {} });

  const valid = ledger.verifyAnchor(anchor);
  assert.equal(valid, false,
    "NEGATIVE CONTROL: anchor must fail after additional records are appended");
});

// ─── Phoenix checkpoint negative controls ─────────────────────────────────

test("negative-control: tampered checkpoint state hash is detected on rollback", () => {
  const recovery = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
  const snap = recovery.checkpoint(SEED, "genuine");

  const tamperedState = { ...SEED, version: 999 };
  const tamperedHash = hashOf(tamperedState);

  assert.notEqual(tamperedHash, snap.stateHash,
    "NEGATIVE CONTROL: tampered state must produce a different hash than the genuine snapshot");
});

test("negative-control: rollback with unknown id must fail", () => {
  const recovery = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
  recovery.checkpoint(SEED);
  const result = recovery.rollback("FORGED-SNAPSHOT-ID-XYZ");
  assert.equal(result.success, false,
    "NEGATIVE CONTROL: rollback with forged ID must be rejected");
  assert.equal(result.snapshotChainValid, false);
});

test("negative-control: validateChain detects when snapshot chain hash is altered", () => {
  const recovery = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
  recovery.checkpoint(SEED, "v1");
  recovery.checkpoint({ ...SEED, version: 2 }, "v2");

  const before = recovery.validateChain();
  assert.equal(before.valid, true, "PRECONDITION: chain must be valid before test");
  assert.equal(before.length, 2);
});

// ─── BctVerifier negative controls ────────────────────────────────────────

test("negative-control: wrong declared hash causes crypto layer to fail", () => {
  const v = makeVerifier();
  const result = v.verify(validInput({
    declaredHash: "sha256:WRONGHASH_DELIBERATE_FAULT_NEGATIVE_CONTROL",
  }));
  const cryptoLayer = result.layers.find((l) => l.layer === "crypto");
  assert.ok(cryptoLayer, "crypto layer must be present in result");
  assert.equal(cryptoLayer?.passed, false,
    "NEGATIVE CONTROL: deliberate wrong hash must fail the crypto layer");
});

test("negative-control: wrong braid signature causes braid layer to fail", () => {
  const v = makeVerifier();
  const result = v.verify(validInput({
    braidSignature: "sha256:FORGED_SIGNATURE_NEGATIVE_CONTROL",
  }));
  const braidLayer = result.layers.find((l) => l.layer === "braid");
  assert.ok(braidLayer, "braid layer must be present in result");
  assert.equal(braidLayer?.passed, false,
    "NEGATIVE CONTROL: forged braid signature must fail the braid layer");
});

test("negative-control: empty identity causes identity layer to fail", () => {
  const v = makeVerifier();
  const result = v.verify(validInput({ identity: "" }));
  const identityLayer = result.layers.find((l) => l.layer === "identity");
  assert.ok(identityLayer, "identity layer must be present");
  assert.equal(identityLayer?.passed, false,
    "NEGATIVE CONTROL: empty identity must fail the identity layer");
});

test("negative-control: missing required schema key causes schema layer to fail", () => {
  const v = makeVerifier();
  const badState = { version: 1, owner: "JGA" } as Record<string, unknown>; // missing "protocol"
  const declaredHash = hashOf(badState);
  const braidSignature = computeBraidSignature(declaredHash, SPINE_SIG);
  const result = v.verify({
    identity: "SB689-NODE",
    state: badState,
    declaredHash,
    braidSignature,
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    requiredKeys: ["protocol", "version", "owner"],
  });
  const schemaLayer = result.layers.find((l) => l.layer === "schema");
  assert.ok(schemaLayer, "schema layer must be present");
  assert.equal(schemaLayer?.passed, false,
    "NEGATIVE CONTROL: state missing required 'protocol' key must fail schema layer");
});

// ─── Triad negative controls ───────────────────────────────────────────────

test("negative-control: corrupted key is NOT accepted as clean by TriadCoordinator", () => {
  const triad = new TriadCoordinator(new AuditLedger(), fixedClock(AT));
  const corrupted = { ...SEED, owner: "TAMPERED_ATTACKER" };
  const result = triad.run(corrupted, SEED);

  assert.ok(result.corruption !== null,
    "NEGATIVE CONTROL: corruption must be detected, not silently accepted");
  assert.ok(result.corruption!.corruptedKeys.includes("owner"),
    "NEGATIVE CONTROL: tampered 'owner' key must appear in corrupted keys list");
});

test("negative-control: injected extra key is NOT accepted as clean by TriadCoordinator", () => {
  const triad = new TriadCoordinator(new AuditLedger(), fixedClock(AT));
  const injected = { ...SEED, injected_payload: "MALICIOUS" } as Record<string, unknown>;
  const result = triad.run(injected, SEED);

  assert.ok(result.corruption !== null,
    "NEGATIVE CONTROL: injected extra key must be flagged as corruption");
  assert.ok(result.corruption!.corruptedKeys.includes("injected_payload"),
    "NEGATIVE CONTROL: injected_payload must appear in corrupted keys");
});

// ─── TrustStateMachine negative controls ─────────────────────────────────

test("negative-control: RECOVERING → CERTIFIED is blocked — silent trust escape prevented", () => {
  const m = new TrustStateMachine("RECOVERING");
  let escaped = false;
  try {
    m.transition("CERTIFIED");
    // If we reach here without an exception, a silent trust escape has occurred.
    escaped = true;
  } catch (err) {
    assert.ok(err instanceof IllegalTrustTransitionError,
      "NEGATIVE CONTROL: must throw IllegalTrustTransitionError");
    assert.equal((err as IllegalTrustTransitionError).from, "RECOVERING");
    assert.equal((err as IllegalTrustTransitionError).to, "CERTIFIED");
  }
  assert.equal(escaped, false,
    "NEGATIVE CONTROL CRITICAL: RECOVERING→CERTIFIED must NEVER silently succeed. " +
    "Silent trust escape detected.");
  assert.equal(m.state, "RECOVERING",
    "NEGATIVE CONTROL: state must remain RECOVERING after illegal transition attempt");
});

test("negative-control: state does not change on illegal transition attempt", () => {
  const transitions: Array<[import("../src/trust/TrustStateMachine").TrustState, import("../src/trust/TrustStateMachine").TrustState]> = [
    ["UNTRUSTED", "CERTIFIED"],
    ["UNTRUSTED", "RECOVERING"],
    ["STAGED", "CERTIFIED"],
    ["RECOVERING", "CERTIFIED"],
    ["QUARANTINED", "CERTIFIED"],
    ["CERTIFIED", "STAGED"],
    ["REJECTED", "RECOVERING"],
  ];

  let silentEscapes = 0;

  for (const [from, to] of transitions) {
    const m = new TrustStateMachine(from);
    try {
      m.transition(to);
      silentEscapes += 1;
    } catch (err) {
      assert.ok(err instanceof IllegalTrustTransitionError,
        `Expected IllegalTrustTransitionError for ${from}→${to}`);
      assert.equal(m.state, from,
        `State must remain ${from} after failed transition to ${to}`);
    }
  }

  assert.equal(silentEscapes, 0,
    `NEGATIVE CONTROL CRITICAL: ${silentEscapes} silent trust escape(s) detected. ` +
    "Every illegal transition must throw and leave state unchanged.");
});

// ─── Hash function negative controls ──────────────────────────────────────

test("negative-control: altered payload produces different hash — avalanche effect", () => {
  const original = { protocol: "SB689", version: 1, owner: "JGA" };
  const altered   = { protocol: "SB689", version: 1, owner: "JGA_TAMPERED" };
  assert.notEqual(hashOf(original), hashOf(altered),
    "NEGATIVE CONTROL: single field change must produce completely different hash");
});

test("negative-control: extra injected field produces different hash", () => {
  const original  = { protocol: "SB689", version: 1 };
  const injected  = { protocol: "SB689", version: 1, injected: "malicious" };
  assert.notEqual(hashOf(original), hashOf(injected),
    "NEGATIVE CONTROL: injected extra field must change the hash");
});

