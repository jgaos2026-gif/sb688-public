export type ThreatClass =
  | "MALWARE_OR_RANSOMWARE"
  | "DATA_EXFILTRATION"
  | "CREDENTIAL_OR_SESSION_ABUSE"
  | "REPLAY_OR_ROLLBACK_ABUSE"
  | "SUPPLY_CHAIN_TAMPER"
  | "PROMPT_OR_INSTRUCTION_INJECTION"
  | "DATA_OR_MEMORY_POISONING"
  | "ROGUE_AUTONOMOUS_BEHAVIOR"
  | "POLICY_OR_TOPOLOGY_DRIFT"
  | "MEMORY_CORRUPTION"
  | "CHECKPOINT_TAMPER"
  | "LEDGER_OR_EVIDENCE_TAMPER"
  | "TRANSPORT_PARTITION_OR_REORDER"
  | "CLOCK_OR_TIMEBASE_FAULT"
  | "RESOURCE_EXHAUSTION"
  | "SENSOR_OR_VERIFIER_DISAGREEMENT"
  | "EXTERNAL_INTERFERENCE"
  | "ENVIRONMENTAL_FAULT"
  | "UNSAFE_ACTION_INTENT"
  | "UNKNOWN";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EnvironmentId =
  | "GENERAL"
  | "AI_AGENT"
  | "CRITICAL_INFRASTRUCTURE"
  | "NATIONAL_SECURITY"
  | "MEDICAL_NEURAL_INTERFACE"
  | "DEEP_SPACE"
  | "DEEP_SEA"
  | "FINANCIAL"
  | "HEALTHCARE"
  | "INDUSTRIAL";

export interface EnvironmentProfile {
  readonly id: EnvironmentId;
  readonly maxInputBytes: number;
  readonly maxClockSkewMs: number;
  readonly requireAuthenticatedSource: boolean;
  readonly requireProvenance: boolean;
  readonly minIndependentCertifiers: number;
  readonly failClosedOnUnknown: boolean;
  readonly tolerateNetworkPartition: boolean;
  readonly requireHumanApprovalForCriticalChange: boolean;
}

export const UNIVERSAL_CONSTITUTION = Object.freeze({
  noBypass: true,
  noSilentTrust: true,
  noSilentRepair: true,
  noSelfCertification: true,
  noErasedEvidence: true,
  assurancePath: "VERIFY -> VALIDATE -> CERTIFY",
  recoveryPath:
    "QUARANTINE -> CHECKPOINT -> REPAIR -> RE-VERIFY -> RE-CERTIFY -> REJOIN",
  spineRule: "NO UNVERIFIED OR UNCERTIFIED STATE MAY TOUCH OR MODIFY A SPINE"
});

const MB = 1024 * 1024;

export const ENVIRONMENT_PROFILES: Readonly<Record<EnvironmentId, EnvironmentProfile>> = Object.freeze({
  GENERAL: profile("GENERAL", 16 * MB, 5 * 60_000, false, true, 2, true, true, true),
  AI_AGENT: profile("AI_AGENT", 8 * MB, 60_000, true, true, 3, true, true, true),
  CRITICAL_INFRASTRUCTURE: profile("CRITICAL_INFRASTRUCTURE", 4 * MB, 30_000, true, true, 3, true, true, true),
  NATIONAL_SECURITY: profile("NATIONAL_SECURITY", 2 * MB, 15_000, true, true, 3, true, true, true),
  MEDICAL_NEURAL_INTERFACE: profile("MEDICAL_NEURAL_INTERFACE", 2 * MB, 10_000, true, true, 3, true, true, true),
  DEEP_SPACE: profile("DEEP_SPACE", 2 * MB, 30 * 60_000, true, true, 3, true, true, true),
  DEEP_SEA: profile("DEEP_SEA", 2 * MB, 10 * 60_000, true, true, 3, true, true, true),
  FINANCIAL: profile("FINANCIAL", 4 * MB, 30_000, true, true, 3, true, false, true),
  HEALTHCARE: profile("HEALTHCARE", 4 * MB, 60_000, true, true, 3, true, true, true),
  INDUSTRIAL: profile("INDUSTRIAL", 4 * MB, 60_000, true, true, 3, true, true, true)
});

function profile(
  id: EnvironmentId,
  maxInputBytes: number,
  maxClockSkewMs: number,
  requireAuthenticatedSource: boolean,
  requireProvenance: boolean,
  minIndependentCertifiers: number,
  failClosedOnUnknown: boolean,
  tolerateNetworkPartition: boolean,
  requireHumanApprovalForCriticalChange: boolean
): EnvironmentProfile {
  return Object.freeze({
    id,
    maxInputBytes,
    maxClockSkewMs,
    requireAuthenticatedSource,
    requireProvenance,
    minIndependentCertifiers,
    failClosedOnUnknown,
    tolerateNetworkPartition,
    requireHumanApprovalForCriticalChange
  });
}

export interface ArtifactCandidate {
  readonly id: string;
  readonly sizeBytes: number;
  readonly sourceId?: string;
  readonly sourceAuthenticated: boolean;
  readonly provenancePresent: boolean;
  readonly observedAtMs: number;
  readonly currentTimeMs: number;
  readonly declaredPolicyVersion: string;
  readonly currentPolicyVersion: string;
  readonly executableOrActiveContent?: boolean;
  readonly modelGenerated?: boolean;
  readonly replayDetected?: boolean;
  readonly evidenceIntact?: boolean;
}

export interface ThreatSignal {
  readonly type: ThreatClass;
  readonly severity: Severity;
  readonly confidence: number;
  readonly detail: string;
  readonly source: string;
}

export interface PurificationDecision {
  readonly state: "PURIFIED_CANDIDATE" | "QUARANTINED";
  readonly reasons: readonly string[];
  readonly canTouchSpine: false;
  readonly trusted: false;
  readonly requiresAssurance: true;
}

export interface PromotionEvidence {
  readonly verified: boolean;
  readonly validated: boolean;
  readonly certifierIds: readonly string[];
  readonly checkpointPresent: boolean;
  readonly evidencePreserved: boolean;
  readonly policyVersion: string;
  readonly humanApprovedCriticalChange?: boolean;
  readonly unresolvedSignals?: readonly ThreatSignal[];
}

export interface PromotionDecision {
  readonly state: "CERTIFIED" | "QUARANTINED";
  readonly reasons: readonly string[];
  readonly mayRejoin: boolean;
  readonly mayBeReferencedBySpine: boolean;
  readonly mayModifySpine: false;
}

export class UniversalHardeningGate {
  readonly environment: EnvironmentProfile;

  constructor(environment: EnvironmentId | EnvironmentProfile = "GENERAL") {
    this.environment = typeof environment === "string" ? ENVIRONMENT_PROFILES[environment] : environment;
  }

  inspect(candidate: ArtifactCandidate, signals: readonly ThreatSignal[] = []): PurificationDecision {
    const reasons: string[] = [];
    const p = this.environment;

    if (!candidate.id.trim()) reasons.push("missing artifact identity");
    if (candidate.sizeBytes < 0 || candidate.sizeBytes > p.maxInputBytes) reasons.push("input size outside environment limit");
    if (p.requireAuthenticatedSource && !candidate.sourceAuthenticated) reasons.push("source authentication required");
    if (p.requireProvenance && !candidate.provenancePresent) reasons.push("provenance required");
    if (!candidate.sourceId && p.requireAuthenticatedSource) reasons.push("source identity required");
    if (Math.abs(candidate.currentTimeMs - candidate.observedAtMs) > p.maxClockSkewMs) reasons.push("clock/timebase outside allowed skew");
    if (candidate.declaredPolicyVersion !== candidate.currentPolicyVersion) reasons.push("policy version drift");
    if (candidate.replayDetected) reasons.push("replay or rollback abuse detected");
    if (candidate.evidenceIntact === false) reasons.push("evidence integrity failure");
    if (candidate.executableOrActiveContent && p.id === "NATIONAL_SECURITY") reasons.push("active content requires isolated execution path");

    for (const signal of signals) {
      if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
        reasons.push("invalid threat-signal confidence");
        continue;
      }
      if (signal.type === "TRANSPORT_PARTITION_OR_REORDER" && p.tolerateNetworkPartition) {
        continue;
      }
      if (signal.type === "UNKNOWN" && p.failClosedOnUnknown && signal.severity !== "LOW") {
        reasons.push("unknown threat class fails closed");
        continue;
      }
      if (signal.severity === "CRITICAL" || (signal.severity === "HIGH" && signal.confidence >= 0.7)) {
        reasons.push(`blocking threat: ${signal.type}`);
      }
    }

    return Object.freeze({
      state: reasons.length === 0 ? "PURIFIED_CANDIDATE" : "QUARANTINED",
      reasons: Object.freeze(reasons),
      canTouchSpine: false,
      trusted: false,
      requiresAssurance: true
    });
  }

  authorizePromotion(evidence: PromotionEvidence): PromotionDecision {
    const reasons: string[] = [];
    const p = this.environment;
    const uniqueCertifiers = new Set(evidence.certifierIds.filter((id) => id.trim().length > 0));

    if (!evidence.verified) reasons.push("verification missing or failed");
    if (!evidence.validated) reasons.push("validation missing or failed");
    if (uniqueCertifiers.size < p.minIndependentCertifiers) reasons.push("insufficient independent certification");
    if (uniqueCertifiers.size !== evidence.certifierIds.length) reasons.push("duplicate/self certification path detected");
    if (!evidence.checkpointPresent) reasons.push("checkpoint required before promotion");
    if (!evidence.evidencePreserved) reasons.push("evidence preservation required");
    if (!evidence.policyVersion.trim()) reasons.push("policy version required");
    if (p.requireHumanApprovalForCriticalChange && evidence.humanApprovedCriticalChange === false) {
      reasons.push("human approval required for critical change");
    }

    for (const signal of evidence.unresolvedSignals ?? []) {
      if (signal.type === "TRANSPORT_PARTITION_OR_REORDER" && p.tolerateNetworkPartition) continue;
      if (signal.severity === "CRITICAL" || signal.severity === "HIGH") reasons.push(`unresolved threat: ${signal.type}`);
      if (signal.type === "UNKNOWN" && p.failClosedOnUnknown) reasons.push("unresolved unknown threat");
    }

    const certified = reasons.length === 0;
    return Object.freeze({
      state: certified ? "CERTIFIED" : "QUARANTINED",
      reasons: Object.freeze(reasons),
      mayRejoin: certified,
      mayBeReferencedBySpine: certified,
      mayModifySpine: false
    });
  }
}

export const DEFAULT_THREAT_MATRIX: readonly ThreatClass[] = Object.freeze([
  "MALWARE_OR_RANSOMWARE",
  "DATA_EXFILTRATION",
  "CREDENTIAL_OR_SESSION_ABUSE",
  "REPLAY_OR_ROLLBACK_ABUSE",
  "SUPPLY_CHAIN_TAMPER",
  "PROMPT_OR_INSTRUCTION_INJECTION",
  "DATA_OR_MEMORY_POISONING",
  "ROGUE_AUTONOMOUS_BEHAVIOR",
  "POLICY_OR_TOPOLOGY_DRIFT",
  "MEMORY_CORRUPTION",
  "CHECKPOINT_TAMPER",
  "LEDGER_OR_EVIDENCE_TAMPER",
  "TRANSPORT_PARTITION_OR_REORDER",
  "CLOCK_OR_TIMEBASE_FAULT",
  "RESOURCE_EXHAUSTION",
  "SENSOR_OR_VERIFIER_DISAGREEMENT",
  "EXTERNAL_INTERFERENCE",
  "ENVIRONMENTAL_FAULT",
  "UNSAFE_ACTION_INTENT",
  "UNKNOWN"
]);
