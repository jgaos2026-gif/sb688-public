import test from "node:test";
import assert from "node:assert/strict";
import { UniversalHardeningGate, ENVIRONMENT_PROFILES, DEFAULT_THREAT_MATRIX, type ArtifactCandidate, type ThreatClass, type Severity, type PromotionEvidence, type EnvironmentId } from "../src/security/UniversalHardening";

function candidate(overrides: Partial<ArtifactCandidate> = {}): ArtifactCandidate {
  return { id: "artifact-1", sizeBytes: 1024, sourceId: "sensor-a", sourceAuthenticated: true, provenancePresent: true, observedAtMs: 1_000_000, currentTimeMs: 1_000_100, declaredPolicyVersion: "v1", currentPolicyVersion: "v1", evidenceIntact: true, ...overrides };
}
function signal(type: ThreatClass, severity: Severity = "HIGH", confidence = 0.9) { return { type, severity, confidence, detail: "fault injection", source: "test-harness" } as const; }

const testVerifier = () => true;
function gate(environment: EnvironmentId, policyVersion = "v1", verifier: (proof: PromotionEvidence) => boolean = testVerifier) {
  return new UniversalHardeningGate(environment, policyVersion, verifier);
}

function evidence(overrides: Partial<PromotionEvidence> = {}): PromotionEvidence { return { verified: true, validated: true, certifierIds: ["v1","v2","v3"], certifierProofs: ["v1","v2","v3"].map((id) => ({ certifierId: id, keyId: `key-${id}`, signature: `sig-${id}`, payloadHash: "a".repeat(64) })), checkpointPresent: true, evidencePreserved: true, policyVersion: "v1", humanApprovedCriticalChange: true, ...overrides }; }

test("purified candidate is never trusted or allowed to touch Spine", () => { const d = gate("GENERAL").inspect(candidate()); assert.equal(d.state, "PURIFIED_CANDIDATE"); assert.equal(d.trusted, false); assert.equal(d.canTouchSpine, false); });
test("national security rejects unauthenticated source", () => { assert.equal(gate("NATIONAL_SECURITY").inspect(candidate({sourceAuthenticated:false})).state, "QUARANTINED"); });
test("policy drift quarantines", () => { assert.equal(gate("AI_AGENT").inspect(candidate({declaredPolicyVersion:"v0"})).state, "QUARANTINED"); });
test("replay quarantines", () => { assert.equal(gate("FINANCIAL").inspect(candidate({replayDetected:true})).state, "QUARANTINED"); });
test("clock drift quarantines", () => { assert.equal(gate("MEDICAL_NEURAL_INTERFACE").inspect(candidate({currentTimeMs:2_000_000})).state, "QUARANTINED"); });
test("deep-space transport partition can be tolerated while remaining untrusted", () => { const d = gate("DEEP_SPACE").inspect(candidate(), [signal("TRANSPORT_PARTITION_OR_REORDER","CRITICAL",1)]); assert.equal(d.state, "PURIFIED_CANDIDATE"); assert.equal(d.trusted, false); });
test("critical rogue behavior quarantines", () => { assert.equal(gate("AI_AGENT").inspect(candidate(), [signal("ROGUE_AUTONOMOUS_BEHAVIOR","CRITICAL",1)]).state, "QUARANTINED"); });
test("unsafe aggression intent is blocked", () => { assert.equal(gate("AI_AGENT").inspect(candidate(), [signal("UNSAFE_ACTION_INTENT","CRITICAL",1)]).state, "QUARANTINED"); });
test("unknown medium threat fails closed", () => { assert.equal(gate("CRITICAL_INFRASTRUCTURE").inspect(candidate(), [signal("UNKNOWN","MEDIUM",0.5)]).state, "QUARANTINED"); });
test("three independent certifiers permit certification", () => { const d = gate("NATIONAL_SECURITY", "v1", (proof) => proof.certifierProofs.every((item) => item.signature === `sig-${item.certifierId}`)).authorizePromotion(evidence()); assert.equal(d.state, "CERTIFIED"); assert.equal(d.mayRejoin, true); assert.equal(d.mayModifySpine, false); });
test("duplicate certifier blocks self-certification pattern", () => { assert.equal(gate("NATIONAL_SECURITY").authorizePromotion(evidence({certifierIds:["v1","v1","v2"]})).state, "QUARANTINED"); });
test("repair without checkpoint cannot rejoin", () => { assert.equal(gate("GENERAL").authorizePromotion(evidence({checkpointPresent:false})).state, "QUARANTINED"); });
test("erased evidence cannot rejoin", () => { assert.equal(gate("GENERAL").authorizePromotion(evidence({evidencePreserved:false})).state, "QUARANTINED"); });
test("unresolved critical threat blocks promotion", () => { assert.equal(gate("HEALTHCARE").authorizePromotion(evidence({unresolvedSignals:[signal("SENSOR_OR_VERIFIER_DISAGREEMENT","CRITICAL",1)]})).state, "QUARANTINED"); });
test("all declared threat classes fail closed when injected as critical except tolerated transport partitions", () => { for (const threat of DEFAULT_THREAT_MATRIX) { const d = gate("NATIONAL_SECURITY").inspect(candidate(), [signal(threat,"CRITICAL",1)]); if (threat === "TRANSPORT_PARTITION_OR_REORDER") assert.equal(d.state, "PURIFIED_CANDIDATE", threat); else assert.equal(d.state, "QUARANTINED", threat); } });
test("environment profiles all require evidence-bound promotion", () => { for (const id of Object.keys(ENVIRONMENT_PROFILES)) { const d = gate(id as keyof typeof ENVIRONMENT_PROFILES).authorizePromotion(evidence({verified:false})); assert.equal(d.state, "QUARANTINED", id); } });


test("malformed artifacts and non-finite measurements fail closed", () => {
  const hardening = gate("AI_AGENT");
  assert.equal(hardening.inspect(null as unknown as ArtifactCandidate).state, "QUARANTINED");
  assert.equal(hardening.inspect(candidate({ sizeBytes: Number.NaN })).state, "QUARANTINED");
  assert.equal(hardening.inspect(candidate({ observedAtMs: Number.NaN })).state, "QUARANTINED");
  assert.equal(hardening.inspect(candidate({ evidenceIntact: undefined })).state, "QUARANTINED");
});

test("malformed threat signals fail closed instead of throwing", () => {
  const hardening = gate("AI_AGENT");
  const result = hardening.inspect(candidate(), [null as unknown as ReturnType<typeof signal>]);
  assert.equal(result.state, "QUARANTINED");
  assert.ok(result.reasons.includes("malformed threat signal"));
});

test("promotion rejects truthy strings, policy drift, and missing human approval", () => {
  const hardening = gate("NATIONAL_SECURITY", "v2");
  assert.equal(hardening.authorizePromotion(evidence({
    verified: "true" as unknown as boolean,
    policyVersion: "v2"
  })).state, "QUARANTINED");
  assert.equal(hardening.authorizePromotion(evidence({
    policyVersion: "v1"
  })).state, "QUARANTINED");
  assert.equal(hardening.authorizePromotion(evidence({
    policyVersion: "v2",
    humanApprovedCriticalChange: undefined
  })).state, "QUARANTINED");
});

test("malformed promotion evidence and invalid environment fail closed", () => {
  const hardening = gate("GENERAL");
  assert.equal(hardening.authorizePromotion(null as unknown as PromotionEvidence).state, "QUARANTINED");
  assert.throws(() => gate("NOT_A_REAL_ENV" as EnvironmentId));
});
