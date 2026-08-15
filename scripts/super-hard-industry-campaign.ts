import { ENVIRONMENT_PROFILES, DEFAULT_THREAT_MATRIX, type EnvironmentId, type ThreatSignal } from "../src/security/UniversalHardening";
import { SuperHardeningGate } from "../src/security/SuperHardeningGate";

const RUNS_PER_INDUSTRY = 10_000;
const ENVIRONMENTS = Object.keys(ENVIRONMENT_PROFILES) as EnvironmentId[];

interface IndustryResult {
  industry: EnvironmentId;
  runs: number;
  blocked: number;
  clean: number;
  silentTrustEscapes: number;
  invalidRecoveryPromotions: number;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
}

function signal(type: (typeof DEFAULT_THREAT_MATRIX)[number], rng: () => number): ThreatSignal {
  const roll = rng();
  return Object.freeze({
    type,
    severity: roll < 0.55 ? "CRITICAL" : roll < 0.8 ? "HIGH" : "MEDIUM",
    confidence: 0.75 + rng() * 0.25,
    detail: `super-hard deterministic fault: ${type}`,
    source: "super-hard-industry-campaign"
  });
}

const results: IndustryResult[] = [];
let totalRuns = 0;
let totalSilent = 0;
let totalRecoveryEscapes = 0;

for (const industry of ENVIRONMENTS) {
  const gate = new SuperHardeningGate(industry);
  const p = ENVIRONMENT_PROFILES[industry];
  const rng = seeded(0xa5a50000 ^ industry.length * 7919);
  let blocked = 0;
  let clean = 0;
  let silentTrustEscapes = 0;
  let invalidRecoveryPromotions = 0;

  for (let run = 0; run < RUNS_PER_INDUSTRY; run++) {
    totalRuns++;
    const now = 1_000_000 + run;
    const candidate = {
      id: `${industry}-${run}`,
      sizeBytes: Math.floor(rng() * p.maxInputBytes * 0.8) + 1,
      sourceId: "paired-anchor-node",
      sourceAuthenticated: true,
      provenancePresent: true,
      observedAtMs: now,
      currentTimeMs: now,
      declaredPolicyVersion: "super-hard-v1",
      currentPolicyVersion: "super-hard-v1",
      replayDetected: false,
      evidenceIntact: true,
      executableOrActiveContent: false
    };

    const faultCount = 1 + Math.floor(rng() * 8);
    const signals: ThreatSignal[] = [];
    for (let f = 0; f < faultCount; f++) {
      const type = DEFAULT_THREAT_MATRIX[Math.floor(rng() * DEFAULT_THREAT_MATRIX.length)]!;
      signals.push(signal(type, rng));
      if (type === "CREDENTIAL_OR_SESSION_ABUSE") Object.assign(candidate, { sourceAuthenticated: false });
      if (type === "REPLAY_OR_ROLLBACK_ABUSE") Object.assign(candidate, { replayDetected: true });
      if (type === "POLICY_OR_TOPOLOGY_DRIFT") Object.assign(candidate, { currentPolicyVersion: "super-hard-v2" });
      if (type === "CLOCK_OR_TIMEBASE_FAULT") Object.assign(candidate, { observedAtMs: now - p.maxClockSkewMs - 1 });
      if (type === "LEDGER_OR_EVIDENCE_TAMPER") Object.assign(candidate, { evidenceIntact: false });
      if (type === "DATA_EXFILTRATION" && rng() < 0.5) Object.assign(candidate, { sizeBytes: p.maxInputBytes + 1 });
      if (type === "SUPPLY_CHAIN_TAMPER" && rng() < 0.5) Object.assign(candidate, { provenancePresent: false });
      if (type === "UNSAFE_ACTION_INTENT" && industry === "NATIONAL_SECURITY") Object.assign(candidate, { executableOrActiveContent: true });
    }

    if (rng() < 0.08) Object.assign(candidate, { sourceId: "" });
    if (rng() < 0.05) Object.assign(candidate, { provenancePresent: false });
    if (rng() < 0.03) Object.assign(candidate, { id: "" });

    const decision = gate.inspect(candidate, signals);
    const allSignalsExplicitlyTolerated = signals.every(
      (s) => s.type === "TRANSPORT_PARTITION_OR_REORDER" && p.tolerateNetworkPartition
    );
    const shouldBlock = !allSignalsExplicitlyTolerated || decision.reasons.length > 0;

    if (decision.state === "QUARANTINED") blocked++;
    else clean++;
    if (shouldBlock && decision.state !== "QUARANTINED") silentTrustEscapes++;

    if (decision.state === "QUARANTINED") {
      const invalidRecovery = rng() < 0.2;
      const evidence = {
        verified: true,
        validated: true,
        certifierIds: Array.from({ length: p.minIndependentCertifiers }, (_, i) => `certifier-${i + 1}`),
        checkpointPresent: true,
        evidencePreserved: true,
        policyVersion: "super-hard-v1",
        humanApprovedCriticalChange: true,
        unresolvedSignals: [] as ThreatSignal[]
      };
      if (invalidRecovery) {
        switch (Math.floor(rng() * 6)) {
          case 0: Object.assign(evidence, { verified: false }); break;
          case 1: Object.assign(evidence, { validated: false }); break;
          case 2: Object.assign(evidence, { certifierIds: ["same", "same"] }); break;
          case 3: Object.assign(evidence, { checkpointPresent: false }); break;
          case 4: Object.assign(evidence, { evidencePreserved: false }); break;
          case 5: Object.assign(evidence, { humanApprovedCriticalChange: false }); break;
        }
      }
      const promotion = gate.authorizePromotion(evidence);
      if (invalidRecovery && promotion.state === "CERTIFIED") invalidRecoveryPromotions++;
    }
  }

  totalSilent += silentTrustEscapes;
  totalRecoveryEscapes += invalidRecoveryPromotions;
  results.push({ industry, runs: RUNS_PER_INDUSTRY, blocked, clean, silentTrustEscapes, invalidRecoveryPromotions });
}

const report = Object.freeze({
  campaign: "SUPER_HARD_10K_PER_INDUSTRY",
  runsPerIndustry: RUNS_PER_INDUSTRY,
  industries: ENVIRONMENTS.length,
  totalRuns,
  silentTrustEscapes: totalSilent,
  invalidRecoveryPromotions: totalRecoveryEscapes,
  pass: totalSilent === 0 && totalRecoveryEscapes === 0,
  results: Object.freeze(results)
});

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
