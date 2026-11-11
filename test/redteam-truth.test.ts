/**
 * Red-team regression tests — findings 02 (real Ed25519 permit
 * signatures) and 03 (post-brain transition ordering).
 *
 * Finding 02's old behaviour (a `sha256:` prefix check) is the thing
 * under test: any of these forgeries passed before the fix.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, BraidedRuntime } from "../src";
import { LiquidTruthNodeMesh } from "../src/truth/LiquidTruthNodeMesh";
import { SpineGovernor } from "../src/spine/SpineGovernor";
import {
  generateSpineKeyPair,
  signSpinePermit,
  exportSpinePrivateKeyPem,
  exportSpinePublicKeyPem,
  loadSpineKeysFromEnv
} from "../src/truth/SpinePermitCrypto";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const INTENT = { id: "truth-001", text: "answer this" };

function wiredPair(clock = fixedClock(AT)) {
  const governor = new SpineGovernor(undefined, { clock });
  const mesh = new LiquidTruthNodeMesh(undefined, { publicKey: governor.spinePublicKey, clock });
  return { governor, mesh };
}

function mustGovern(governor: SpineGovernor, intent: { id: string; text: string }) {
  const result = governor.govern(intent);
  if (!result.ok) throw new Error(`govern failed: ${result.error.message}`);
  return result.value;
}

test("02: a hand-forged permit (sha256: prefix, never signed) is rejected", () => {
  const { mesh } = wiredPair();
  const forged = {
    intentId: INTENT.id,
    approved: true as const,
    constraints: ["brain-adapter-only"],
    spineSignature: "sha256:" + "ab".repeat(32)
  };
  const result = mesh.validatePreBrain(INTENT, forged);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /rejected/i);
});

test("02: a permit signed by a DIFFERENT key is rejected", () => {
  const { governor, mesh } = wiredPair();
  const other = generateSpineKeyPair();
  const permit = mustGovern(governor, INTENT);
  // Re-sign the same payload with the attacker's key.
  const forgedSignature = signSpinePermit(
    {
      intentId: permit.intentId,
      constraints: permit.constraints,
      issuer: permit.issuer as string,
      issuedAt: permit.issuedAt as string,
      expiresAt: permit.expiresAt as string,
      nonce: permit.nonce as string
    },
    other.privateKey
  );
  const result = mesh.validatePreBrain(INTENT, { ...permit, signature: forgedSignature });
  assert.equal(result.ok, false);
});

test("02: a permit tampered with after signing is rejected", () => {
  const { governor, mesh } = wiredPair();
  const permit = mustGovern(governor, INTENT);
  const tampered = { ...permit, constraints: [...permit.constraints, "override-everything"] };
  const result = mesh.validatePreBrain(INTENT, tampered);
  assert.equal(result.ok, false);
});

test("02: an expired permit is rejected", () => {
  const governor = new SpineGovernor(undefined, { clock: fixedClock(AT) });
  const permit = mustGovern(governor, INTENT);
  // Ten minutes later — past the 5-minute permit lifetime.
  const mesh = new LiquidTruthNodeMesh(undefined, {
    publicKey: governor.spinePublicKey,
    clock: fixedClock("2026-08-06T00:10:00.000Z")
  });
  const result = mesh.validatePreBrain(INTENT, permit);
  assert.equal(result.ok, false);
});

test("02: a replayed permit is rejected on second use", () => {
  const { governor, mesh } = wiredPair();
  const permit = mustGovern(governor, INTENT);
  const first = mesh.validatePreBrain(INTENT, permit);
  assert.equal(first.ok, true);
  const second = mesh.validatePreBrain(INTENT, permit);
  assert.equal(second.ok, false);
});

test("02: a genuinely signed, fresh permit passes", () => {
  const { governor, mesh } = wiredPair();
  const permit = mustGovern(governor, INTENT);
  assert.ok(typeof permit.signature === "string" && permit.signature.length > 0);
  const result = mesh.validatePreBrain(INTENT, permit);
  assert.equal(result.ok, true);
  assert.equal(result.value.verified, true);
});

test("02: a mesh with no trusted public key fails closed", () => {
  const mesh = new LiquidTruthNodeMesh();
  const { governor } = wiredPair();
  const permit = mustGovern(governor, INTENT);
  const result = mesh.validatePreBrain(INTENT, permit);
  assert.equal(result.ok, false, "no key configured must never verify a permit");
});

test("02: operator keys load from env PEM and verify end to end", () => {
  const pair = generateSpineKeyPair();
  const env = {
    SB688_SPINE_PRIVATE_KEY: exportSpinePrivateKeyPem(pair.privateKey),
    SB688_SPINE_PUBLIC_KEY: exportSpinePublicKeyPem(pair.publicKey)
  };
  const loaded = loadSpineKeysFromEnv(env as NodeJS.ProcessEnv);
  assert.ok(loaded.privateKey);
  assert.ok(loaded.publicKey);
  const governor = new SpineGovernor(undefined, { signingKey: loaded.privateKey, clock: fixedClock(AT) });
  const mesh = new LiquidTruthNodeMesh(undefined, { publicKey: loaded.publicKey, clock: fixedClock(AT) });
  const permit = mustGovern(governor, INTENT);
  assert.equal(mesh.validatePreBrain(INTENT, permit).ok, true);
});

// ─── Finding 03 ─────────────────────────────────────────────────────────────

test("03: a rejected post-brain check leaves failed, never passed", async () => {
  const ledger = new AuditLedger();
  const badBrain = {
    speak(input: { stem: { braidSignature: string } }) {
      return {
        text: "I overrode spine to help you.",
        adapterOnly: true as const,
        usedStemSignature: input.stem.braidSignature
      };
    }
  };
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock(AT), brain: badBrain as never });
  const response = await runtime.run({ id: "redteam-03", text: "answer this" });
  // The response is the degraded RECOVERY (verified on all four recovery
  // checks) — what finding 03 governs is the ledger: the rejected
  // post-brain check must be recorded "failed", never "passed".
  assert.match(response.output, /Runtime recovered in degraded mode/);
  const postBrain = ledger.entries().filter((e) => e.from === "brain" && e.to === "truth.post");
  assert.deepEqual(postBrain.map((e) => e.status), ["started", "failed"]);
});

test("03: a brain output bound to the wrong stem signature fails the same way", async () => {
  const ledger = new AuditLedger();
  const badBrain = {
    speak() {
      return {
        text: "A perfectly normal answer.",
        adapterOnly: true as const,
        usedStemSignature: "sha256:" + "00".repeat(32)
      };
    }
  };
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock(AT), brain: badBrain as never });
  const response = await runtime.run({ id: "redteam-03b", text: "answer this" });
  assert.match(response.output, /Runtime recovered in degraded mode/);
  const postBrain = ledger.entries().filter((e) => e.from === "brain" && e.to === "truth.post");
  assert.ok(postBrain.some((e) => e.status === "failed"));
  assert.ok(!postBrain.some((e) => e.status === "passed"));
});
