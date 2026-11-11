import { writeFileSync } from "node:fs";
import { HardenedBackendKernel, type BackendAdapter } from "../src/security/HardenedBackendKernel";
import { DEFAULT_THREAT_MATRIX, ENVIRONMENT_PROFILES, UniversalHardeningGate, type ArtifactCandidate, type EnvironmentId, type PromotionEvidence, type Severity, type ThreatClass } from "../src/security/UniversalHardening";

const environments = Object.keys(ENVIRONMENT_PROFILES) as EnvironmentId[];
let seed = 0x68871290;
function rnd(): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; }
function pick<T>(values: readonly T[]): T { return values[Math.floor(rnd() * values.length)]!; }
function candidate(env: EnvironmentId, overrides: Partial<ArtifactCandidate> = {}): ArtifactCandidate { const p = ENVIRONMENT_PROFILES[env]; return { id: `artifact-${Math.floor(rnd()*1e9)}`, sizeBytes: Math.max(1, Math.floor(p.maxInputBytes * 0.1)), sourceId: "source-1", sourceAuthenticated: true, provenancePresent: true, observedAtMs: 1_000_000, currentTimeMs: 1_000_001, declaredPolicyVersion: "v1", currentPolicyVersion: "v1", evidenceIntact: true, ...overrides }; }
function signal(type: ThreatClass, severity: Severity = "CRITICAL", confidence = 1) { return { type, severity, confidence, detail: "seeded fault injection", source: "universal-hardening-campaign" } as const; }
function evidence(overrides: Partial<PromotionEvidence> = {}): PromotionEvidence { return { verified: true, validated: true, certifierIds: ["c1","c2","c3"], checkpointPresent: true, evidencePreserved: true, policyVersion: "v1", humanApprovedCriticalChange: true, ...overrides }; }
function fakeAdapter(): BackendAdapter & { calls: string[] } { const calls: string[] = []; return { calls, health:()=>1, ready:()=>1, readLedger:()=>[], runIntent:()=>{calls.push("run");return 1;}, upload:()=>{calls.push("upload");return 1;}, tick:()=>{calls.push("tick");return 1;}, connectStitch:()=>{calls.push("connect");return 1;} }; }

async function main(): Promise<void> {
  let cases = 0, expectedBlocks = 0, actualBlocks = 0, silentTrustEscapes = 0, executionEscapes = 0, falseBlocks = 0;
  const failures: unknown[] = [];

  for (const env of environments) for (const threat of DEFAULT_THREAT_MATRIX) {
    cases++; const d = new UniversalHardeningGate(env).inspect(candidate(env), [signal(threat)]);
    const tolerated = threat === "TRANSPORT_PARTITION_OR_REORDER" && ENVIRONMENT_PROFILES[env].tolerateNetworkPartition;
    const shouldBlock = !tolerated; if (shouldBlock) expectedBlocks++; if (d.state === "QUARANTINED") actualBlocks++;
    if (shouldBlock && d.state !== "QUARANTINED") { silentTrustEscapes++; failures.push({ kind:"critical-threat-escape", env, threat }); }
    if (!shouldBlock && d.state === "QUARANTINED") falseBlocks++;
  }

  const promotionFaults: readonly [string, Partial<PromotionEvidence>][] = [
    ["verify-false",{verified:false}], ["validate-false",{validated:false}], ["duplicate-certifier",{certifierIds:["c1","c1","c2"]}], ["no-checkpoint",{checkpointPresent:false}], ["erased-evidence",{evidencePreserved:false}], ["no-policy",{policyVersion:""}], ["no-human-approval",{humanApprovedCriticalChange:false}], ["unresolved-critical",{unresolvedSignals:[signal("UNKNOWN")]}]
  ];
  for (const env of environments) for (const [name, fault] of promotionFaults) {
    cases++; const d = new UniversalHardeningGate(env).authorizePromotion(evidence(fault)); const shouldBlock = name !== "no-human-approval" || ENVIRONMENT_PROFILES[env].requireHumanApprovalForCriticalChange;
    if (shouldBlock) expectedBlocks++; if (d.state === "QUARANTINED") actualBlocks++; if (shouldBlock && d.state !== "QUARANTINED") { silentTrustEscapes++; failures.push({ kind:"promotion-escape", env, name }); }
  }

  for (let i=0;i<100_000;i++) {
    const env = pick(environments); const gate = new UniversalHardeningGate(env); const fault = pick(["threat","policy","replay","evidence","provenance","clock","promotion"] as const); cases++; let blocked = false;
    if (fault === "threat") { const threat = pick(DEFAULT_THREAT_MATRIX.filter((t) => t !== "TRANSPORT_PARTITION_OR_REORDER")); blocked = gate.inspect(candidate(env), [signal(threat, pick(["HIGH","CRITICAL"] as const), 0.8+rnd()*0.2)]).state === "QUARANTINED"; }
    else if (fault === "policy") blocked = gate.inspect(candidate(env,{declaredPolicyVersion:"old"})).state === "QUARANTINED";
    else if (fault === "replay") blocked = gate.inspect(candidate(env,{replayDetected:true})).state === "QUARANTINED";
    else if (fault === "evidence") blocked = gate.inspect(candidate(env,{evidenceIntact:false})).state === "QUARANTINED";
    else if (fault === "provenance") blocked = gate.inspect(candidate(env,{provenancePresent:false})).state === "QUARANTINED";
    else if (fault === "clock") blocked = gate.inspect(candidate(env,{currentTimeMs:1_000_000+ENVIRONMENT_PROFILES[env].maxClockSkewMs+10})).state === "QUARANTINED";
    else { const mutation = pick(["verified","validated","checkpointPresent","evidencePreserved"] as const); blocked = gate.authorizePromotion(evidence({[mutation]:false})).state === "QUARANTINED"; }
    expectedBlocks++; if (blocked) actualBlocks++; else { silentTrustEscapes++; if (failures.length < 100) failures.push({kind:"fuzz-escape",env,fault,i}); }
  }

  for (const env of environments) for (const threat of DEFAULT_THREAT_MATRIX.filter((t) => t !== "TRANSPORT_PARTITION_OR_REORDER")) {
    cases++; const adapter = fakeAdapter(); const kernel = new HardenedBackendKernel(adapter, env);
    const result = await kernel.handle({ operation:"RUN_INTENT", tokenValid:true, sourceId:"source-1", provenanceId:"prov-1", policyVersion:"v1", contentType:"application/json", bodyBytes:100, artifact:candidate(env), signals:[signal(threat)], payload:{} });
    expectedBlocks++; if (!result.ok) actualBlocks++; if (result.ok || adapter.calls.length > 0) { executionEscapes++; silentTrustEscapes++; failures.push({kind:"execution-escape",env,threat,result,calls:adapter.calls}); }
  }

  const report = { campaign:"SB688 Universal Hardening Seeded Fault Campaign", seed:"0x68871290", generatedAt:new Date().toISOString(), cases, expectedBlocks, actualBlocks, silentTrustEscapes, executionEscapes, falseBlocks, pass:silentTrustEscapes===0 && executionEscapes===0, environmentCount:environments.length, threatClassCount:DEFAULT_THREAT_MATRIX.length, limitations:["Architecture/test-harness evidence only; not production certification.","Transport partitions configured as tolerable remain degraded and untrusted; tolerance is not trust.","External malware detection engines, cryptographic key custody, hardware roots of trust, and independent penetration testing remain separate deployment requirements."], failures };
  writeFileSync("evidence/universal_hardening_campaign.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}

void main();
