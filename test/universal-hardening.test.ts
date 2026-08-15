import test from "node:test";
import assert from "node:assert/strict";
import { UniversalHardeningGate, ENVIRONMENT_PROFILES, DEFAULT_THREAT_MATRIX, type ArtifactCandidate, type ThreatClass, type Severity, type PromotionEvidence } from "../src/security/UniversalHardening";

function candidate(overrides: Partial<ArtifactCandidate> = {}): ArtifactCandidate {
  return { id: "artifact-1", sizeBytes: 1024, sourceId: "sensor-a", sourceAuthenticated: true, provenancePresent: true, observedAtMs: 1_000_000, currentTimeMs: 1_000_100, declaredPolicyVersion: "v1", currentPolicyVersion: "v1", evidenceIntact: true, ...overrides };
}
function signal(type: ThreatClass, severity: Severity = "HIGH", confidence = 0.9) { return { type, severity, confidence, detail: "fault injection", source: "test-harness" } as const; }
function evidence(overrides: Partial<PromotionEvidence> = {}): PromotionEvidence { return { verified: true, validated: true, certifierIds: ["v1","v2","v3"], checkpointPresent: true, evidencePreserved: true, policyVersion: "v1", humanApprovedCriticalChange: true, ...overrides }; }

test("purified candidate is never trusted or allowed to touch Spine", () => { const d = new UniversalHardeningGate("GENERAL").inspect(candidate()); assert.equal(d.state, "PURIFIED_CANDIDATE"); assert.equal(d.trusted, false); assert.equal(d.canTouchSpine, false); });
test("national security rejects unauthenticated source", () => { assert.equal(new UniversalHardeningGate("NATIONAL_SECURITY").inspect(candidate({sourceAuthenticated:false})).state, "QUARANTINED"); });
test("policy drift quarantines", () => { assert.equal(new UniversalHardeningGate("AI_AGENT").inspect(candidate({declaredPolicyVersion:"v0"})).state, "QUARANTINED"); });
test("replay quarantines", () => { assert.equal(new UniversalHardeningGate("FINANCIAL").inspect(candidate({replayDetected:true})).state, "QUARANTINED"); });
test("clock drift quarantines", () => { assert.equal(new UniversalHardeningGate("MEDICAL_NEURAL_INTERFACE").inspect(candidate({currentTimeMs:2_000_000})).state, "QUARANTINED"); });
test("deep-space transport partition can be tolerated while remaining untrusted", () => { const d = new UniversalHardeningGate("DEEP_SPACE").inspect(candidate(), [signal("TRANSPORT_PARTITION_OR_REORDER","CRITICAL",1)]); assert.equal(d.state, "PURIFIED_CANDIDATE"); assert.equal(d.trusted, false); });
test("critical rogue behavior quarantines", () => { assert.equal(new UniversalHardeningGate("AI_AGENT").inspect(candidate(), [signal("ROGUE_AUTONOMOUS_BEHAVIOR","CRITICAL",1)]).state, "QUARANTINED"); });
test("unsafe aggression intent is blocked", () => { assert.equal(new UniversalHardeningGate("AI_AGENT").inspect(candidate(), [signal("UNSAFE_ACTION_INTENT","CRITICAL",1)]).state, "QUARANTINED"); });
test("unknown medium threat fails closed", () => { assert.equal(new UniversalHardeningGate("CRITICAL_INFRASTRUCTURE").inspect(candidate(), [signal("UNKNOWN","MEDIUM",0.5)]).state, "QUARANTINED"); });
test("three independent certifiers permit certification", () => { const d = new UniversalHardeningGate("NATIONAL_SECURITY").authorizePromotion(evidence()); assert.equal(d.state, "CERTIFIED"); assert.equal(d.mayRejoin, true); assert.equal(d.mayModifySpine, false); });
test("duplicate certifier blocks self-certification pattern", () => { assert.equal(new UniversalHardeningGate("NATIONAL_SECURITY").authorizePromotion(evidence({certifierIds:["v1","v1","v2"]})).state, "QUARANTINED"); });
test("repair without checkpoint cannot rejoin", () => { assert.equal(new UniversalHardeningGate("GENERAL").authorizePromotion(evidence({checkpointPresent:false})).state, "QUARANTINED"); });
test("erased evidence cannot rejoin", () => { assert.equal(new UniversalHardeningGate("GENERAL").authorizePromotion(evidence({evidencePreserved:false})).state, "QUARANTINED"); });
test("unresolved critical threat blocks promotion", () => { assert.equal(new UniversalHardeningGate("HEALTHCARE").authorizePromotion(evidence({unresolvedSignals:[signal("SENSOR_OR_VERIFIER_DISAGREEMENT","CRITICAL",1)]})).state, "QUARANTINED"); });
test("all declared threat classes fail closed when injected as critical except tolerated transport partitions", () => { for (const threat of DEFAULT_THREAT_MATRIX) { const d = new UniversalHardeningGate("NATIONAL_SECURITY").inspect(candidate(), [signal(threat,"CRITICAL",1)]); if (threat === "TRANSPORT_PARTITION_OR_REORDER") assert.equal(d.state, "PURIFIED_CANDIDATE", threat); else assert.equal(d.state, "QUARANTINED", threat); } });
test("environment profiles all require evidence-bound promotion", () => { for (const id of Object.keys(ENVIRONMENT_PROFILES)) { const d = new UniversalHardeningGate(id as keyof typeof ENVIRONMENT_PROFILES).authorizePromotion(evidence({verified:false})); assert.equal(d.state, "QUARANTINED", id); } });
