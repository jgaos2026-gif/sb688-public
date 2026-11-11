import test from "node:test";
import assert from "node:assert/strict";
import { HardenedBackendKernel, type BackendAdapter } from "../src/security/HardenedBackendKernel";
import type { ArtifactCandidate, EnvironmentId, PromotionEvidence } from "../src/security/UniversalHardening";

function fakeAdapter(): BackendAdapter & { calls: string[] } {
  const calls: string[] = [];
  return { calls, health: () => ({ healthy: true }), ready: () => ({ ready: true }), readLedger: () => [], runIntent: (payload) => { calls.push("run"); return payload; }, upload: (payload) => { calls.push("upload"); return payload; }, tick: (payload) => { calls.push("tick"); return payload; }, connectStitch: (payload) => { calls.push("connect"); return payload; } };
}

const artifact: ArtifactCandidate = { id: "a1", sizeBytes: 100, sourceId: "operator", sourceAuthenticated: true, provenancePresent: true, observedAtMs: 1000, currentTimeMs: 1001, declaredPolicyVersion: "v1", currentPolicyVersion: "v1", evidenceIntact: true };
const evidence: PromotionEvidence = { verified: true, validated: true, certifierIds: ["c1","c2","c3"], certifierProofs: ["c1","c2","c3"].map((id) => ({ certifierId: id, keyId: `key-${id}`, signature: `sig-${id}`, payloadHash: "b".repeat(64) })), checkpointPresent: true, evidencePreserved: true, policyVersion: "v1", humanApprovedCriticalChange: true };
const base = { tokenValid: true, sourceId: "spoofed-client", provenanceId: "spoofed-client", policyVersion: "v1", contentType: "application/json", bodyBytes: 100, artifact, payload: { x: 1 } } as const;
const trustedAuth = () => ({ authenticated: true, sourceId: "operator", provenanceId: "prov:1" });

test("public health executes without token", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "NATIONAL_SECURITY", "v1", undefined, trustedAuth); const r = await k.handle({ operation: "HEALTH", tokenValid: false, policyVersion: "v1", bodyBytes: 0 }); assert.equal(r.ok, true); });
test("unauthenticated mutation never reaches adapter", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "NATIONAL_SECURITY"); const r = await k.handle({ ...base, operation: "RUN_INTENT", tokenValid: false }); assert.equal(r.ok, false); assert.deepEqual(a.calls, []); });
test("rogue behavior never reaches runtime", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "AI_AGENT", "v1", undefined, trustedAuth); const r = await k.handle({ ...base, operation: "RUN_INTENT", signals: [{ type: "ROGUE_AUTONOMOUS_BEHAVIOR", severity: "CRITICAL", confidence: 1, detail: "fault", source: "test" }] }); assert.equal(r.ok, false); assert.deepEqual(a.calls, []); });
test("policy drift blocks before execution", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "NATIONAL_SECURITY"); const r = await k.handle({ ...base, operation: "UPLOAD", artifact: { ...artifact, declaredPolicyVersion: "v0" } }); assert.equal(r.ok, false); assert.deepEqual(a.calls, []); });
test("purified intent may execute but remains outside Spine trust promotion", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "AI_AGENT"); const r = await k.handle({ ...base, operation: "RUN_INTENT" }); assert.equal(r.ok, true); assert.deepEqual(a.calls, ["run"]); });
test("Stitch connect cannot execute without human approval checkpoint evidence and certification", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "NATIONAL_SECURITY"); const r = await k.handle({ ...base, operation: "CONNECT_STITCH", humanApprovedCriticalChange: false, promotionEvidence: evidence }); assert.equal(r.ok, false); assert.deepEqual(a.calls, []); });
test("Stitch connect executes only after complete access and certification gates", async () => { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, "NATIONAL_SECURITY", "v1", (proof) => proof.certifierProofs.every((item) => item.signature === `sig-${item.certifierId}`), trustedAuth); const r = await k.handle({ ...base, operation: "CONNECT_STITCH", humanApprovedCriticalChange: true, checkpointId: "cp-1", evidenceRef: "ledger:1", promotionEvidence: evidence }); assert.equal(r.ok, true); assert.deepEqual(a.calls, ["connect"]); });
test("unknown critical threat blocks in every environment tested", async () => { const envs: EnvironmentId[] = ["GENERAL","AI_AGENT","CRITICAL_INFRASTRUCTURE","NATIONAL_SECURITY","MEDICAL_NEURAL_INTERFACE","DEEP_SPACE","DEEP_SEA","FINANCIAL","HEALTHCARE","INDUSTRIAL"]; for (const env of envs) { const a = fakeAdapter(); const k = new HardenedBackendKernel(a, env); const r = await k.handle({ ...base, operation: "TICK", signals: [{ type: "UNKNOWN", severity: "CRITICAL", confidence: 1, detail: "unknown", source: "test" }] }); assert.equal(r.ok, false, env); assert.deepEqual(a.calls, [], env); } });


test("client cannot self-declare the current policy version", async () => {
  const a = fakeAdapter();
  const k = new HardenedBackendKernel(a, "AI_AGENT", "v2", undefined, trustedAuth);
  const r = await k.handle({
    ...base,
    operation: "RUN_INTENT",
    policyVersion: "v1",
    artifact: { ...artifact, declaredPolicyVersion: "v1", currentPolicyVersion: "v1" }
  });
  assert.equal(r.ok, false);
  assert.deepEqual(a.calls, []);
});

test("trusted kernel policy overrides client-supplied current policy field", async () => {
  const a = fakeAdapter();
  const k = new HardenedBackendKernel(a, "AI_AGENT", "v2");
  const r = await k.handle({
    ...base,
    operation: "RUN_INTENT",
    policyVersion: "v2",
    artifact: { ...artifact, declaredPolicyVersion: "v2", currentPolicyVersion: "v1" }
  });
  assert.equal(r.ok, true);
  assert.deepEqual(a.calls, ["run"]);
});

test("malformed and inherited operation names are rejected without throwing", async () => {
  const a = fakeAdapter();
  const k = new HardenedBackendKernel(a, "AI_AGENT");
  const malformed = await k.handle(null as unknown as Parameters<typeof k.handle>[0]);
  const inherited = await k.handle({
    ...base,
    operation: "toString" as unknown as "RUN_INTENT"
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.statusCode, 400);
  assert.equal(inherited.ok, false);
  assert.equal(inherited.statusCode, 404);
  assert.deepEqual(a.calls, []);
});


test("client cannot authenticate by setting tokenValid true or spoof source and provenance", async () => {
  const a = fakeAdapter();
  const k = new HardenedBackendKernel(a, "AI_AGENT");
  const r = await k.handle({ ...base, operation: "RUN_INTENT", tokenValid: true });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, 401);
  assert.deepEqual(a.calls, []);
});

test("trusted authenticator failure is caught and fails closed", async () => {
  const a = fakeAdapter();
  const k = new HardenedBackendKernel(a, "AI_AGENT", "v1", undefined, () => {
    throw new Error("identity provider unavailable");
  });
  const r = await k.handle({ ...base, operation: "RUN_INTENT", tokenValid: true });
  assert.equal(r.ok, false);
  assert.equal(r.statusCode, 401);
  assert.deepEqual(a.calls, []);
});
