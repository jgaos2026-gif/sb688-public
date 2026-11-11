/**
 * Cross-application integration test (red-team campaign finale):
 * intent → spine → brain → memory → evidence ledger → recovery → response,
 * with the BCT verifier anchoring the run's evidence.
 *
 * One run proves the happy path end to end; a second run forces a brain
 * failure and proves the degraded path still verifies on all four
 * recovery checks with the evidence ledger intact throughout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, BraidedRuntime } from "../src";
import { BctVerifier, computeBraidBindingHash } from "../src/truth/BctVerifier";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";

test("redteam integration: intent → spine → brain → memory → ledger → BCT → response", async () => {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock(AT) });

  // 1. Intent runs the governed path.
  const response = await runtime.run({ id: "integration-001", text: "Build the SB689 runtime through the governed path." });
  assert.equal(response.verified, true);
  assert.equal(response.checkpoint?.label, "verified-output");

  // 2. Memory: the stem recalled (here: no prior facts) and the brain
  //    wove the recall into its answer.
  assert.match(response.output, /Memory braid recalled/);

  // 3. Evidence ledger: every stage transition is recorded and the
  //    hash chain is intact.
  assert.equal(ledger.verifyChain(), true);
  const stages = ledger.entries().map((e) => `${e.from}->${e.to}`);
  for (const leg of ["intent->spine", "spine->truth.pre", "stem->brain", "brain->truth.post", "truth.post->ghost-node", "ledger->response"]) {
    assert.ok(stages.includes(leg), `missing ledger leg ${leg}`);
  }

  // 4. BCT: the run's evidence anchors as a genesis state for this
  //    identity, with the spine permit signature from the ledger as
  //    the braid root.
  const spineEntry = ledger.entries().find((e) => e.from === "spine" && e.to === "truth.pre");
  const spineSignature = (spineEntry?.detail as { spineSignature: string }).spineSignature;
  assert.ok(typeof spineSignature === "string" && spineSignature.startsWith("sha256:"));
  const state = { traceId: response.traceId, output: response.output, verified: response.verified };
  const declaredHash = hashOf(state);
  const verifier = new BctVerifier(ledger, fixedClock(AT));
  const bct = verifier.verify({
    identity: response.traceId,
    state,
    declaredHash,
    braidBindingHash: computeBraidBindingHash(declaredHash, spineSignature),
    spineSignature,
    priorAuditHash: ledger.latestHash(),
    allowGenesis: true
  });
  assert.equal(bct.trusted, true, `BCT must trust the run evidence: ${JSON.stringify(bct.failedLayers)}`);
  assert.equal(ledger.verifyChain(), true, "ledger must stay valid after the BCT entry is appended");
});

test("redteam integration: brain failure → degraded recovery → verified response", async () => {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock(AT) });

  const response = await runtime.run({ id: "integration-002", text: "force-brain-failure after successful governance checks" });
  assert.equal(response.verified, true, "recovery must verify on all four checks");
  assert.equal(response.checkpoint?.label, "failure-recovery");
  assert.match(response.output, /Runtime recovered in degraded mode/);
  assert.match(response.output, /Verification verdict: VERIFIED/);

  // The failure loop is fully recorded and the chain is intact.
  assert.equal(ledger.verifyChain(), true);
  const transitions = ledger.entries().map((e) => `${e.from}->${e.to}`);
  for (const leg of [
    "brain->failure.detect",
    "failure.detect->failure.isolate",
    "failure.isolate->failure.rollback",
    "failure.rollback->failure.restitch",
    "failure.restitch->failure.verify",
    "failure.verify->failure.log",
    "failure.log->failure.checkpoint"
  ]) {
    assert.ok(transitions.includes(leg), `missing failure leg ${leg}`);
  }
  const verifyEntry = ledger.entries().find((e) => e.to === "failure.verify");
  assert.equal(verifyEntry?.status, "passed");
  const detail = verifyEntry?.detail as Record<string, unknown>;
  assert.equal(detail.recoveryTruthOk, true);
  assert.equal(detail.rollbackVerified, true);
  assert.equal(detail.chainValid, true);
  assert.equal(detail.checkpointVerified, true);
});
