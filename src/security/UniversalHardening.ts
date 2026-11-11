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

  constructor(
    environment: EnvironmentId = "GENERAL",
    readonly currentPolicyVersion = "v1"
  ) {
    const selected = ENVIRONMENT_PROFILES[environment];
    if (!selected) throw new Error("unknown hardening environment profile");
    if (typeof currentPolicyVersion !== "string" || !currentPolicyVersion.trim()) {
      throw new Error("current policy version is required");
    }
    this.environment = selected;
  }

  inspect(candidate: ArtifactCandidate, signals: readonly ThreatSignal[] = []): PurificationDecision {
    const reasons: string[] = [];
    const p = this.environment;

    if (candidate === null || typeof candidate !== "object") {
      reasons.push("artifact candidate must be an object");
    } else {
      if (typeof candidate.id !== "string" || !candidate.id.trim()) reasons.push("missing artifact identity");
      if (!Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes < 0 ||
          candidate.sizeBytes > p.maxInputBytes) reasons.push("input size outside environment limit or invalid");
      if (p.requireAuthenticatedSource && candidate.sourceAuthenticated !== true) reasons.push("source authentication required");
      if (p.requireProvenance && candidate.provenancePresent !== true) reasons.push("provenance required");
      if (p.requireAuthenticatedSource &&
          (typeof candidate.sourceId !== "string" || !candidate.sourceId.trim())) reasons.push("source identity required");
      if (!Number.isFinite(candidate.currentTimeMs) || candidate.currentTimeMs < 0 ||
          !Number.isFinite(candidate.observedAtMs) || candidate.observedAtMs < 0) {
        reasons.push("artifact timestamps must be finite non-negative numbers");
      } else if (Math.abs(candidate.currentTimeMs - candidate.observedAtMs) > p.maxClockSkewMs) {
        reasons.push("clock/timebase outside allowed skew");
      }
      if (typeof candidate.declaredPolicyVersion !== "string" ||
          candidate.declaredPolicyVersion !== this.currentPolicyVersion) reasons.push("declared policy version drift");
      if (candidate.replayDetected === true) reasons.push("replay or rollback abuse detected");
      if (candidate.evidenceIntact !== true) reasons.push("evidence integrity is missing or failed");
      if (candidate.executableOrActiveContent === true && p.id === "NATIONAL_SECURITY") {
        reasons.push("active content requires isolated execution path");
      }
    }

    if (!Array.isArray(signals)) {
      reasons.push("threat signals must be an array");
    } else {
      for (const signal of signals) {
        if (signal === null || typeof signal !== "object") {
          reasons.push("malformed threat signal");
          continue;
        }
        const validSeverity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(signal.severity);
        const validType = typeof signal.type === "string" &&
          (DEFAULT_THREAT_MATRIX as readonly string[]).includes(signal.type);
        if (!validSeverity) {
          reasons.push("invalid threat-signal severity");
          continue;
        }
        if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
          reasons.push("invalid threat-signal confidence");
          continue;
        }
        if (typeof signal.detail !== "string" || !signal.detail.trim() ||
            typeof signal.source !== "string" || !signal.source.trim()) {
          reasons.push("threat signal requires detail and source provenance");
          continue;
        }
        if (!validType) {
          if (p.failClosedOnUnknown && signal.severity !== "LOW") {
            reasons.push("unknown threat class fails closed");
          } else if (signal.severity === "CRITICAL" ||
                     (signal.severity === "HIGH" && signal.confidence >= 0.7)) {
            reasons.push("unknown threat severity blocks");
          }
          continue;
        }
        if (signal.type === "TRANSPORT_PARTITION_OR_REORDER" && p.tolerateNetworkPartition) continue;
        if (signal.type === "UNKNOWN" && p.failClosedOnUnknown && signal.severity !== "LOW") {
          reasons.push("unknown threat class fails closed");
          continue;
        }
        if (signal.severity === "CRITICAL" ||
            (signal.severity === "HIGH" && signal.confidence >= 0.7)) {
          reasons.push(`blocking threat: ${signal.type}`);
        }
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
    if (evidence === null || typeof evidence !== "object") {
      reasons.push("promotion evidence must be an object");
    } else {
      if (evidence.verified !== true) reasons.push("verification missing or failed");
      if (evidence.validated !== true) reasons.push("validation missing or failed");

      if (!Array.isArray(evidence.certifierIds)) {
        reasons.push("certifier identities must be an array");
      } else {
        const validIds = evidence.certifierIds.filter(
          (id) => typeof id === "string" && id.trim().length > 0
        );
        if (validIds.length !== evidence.certifierIds.length) reasons.push("invalid certifier identity");
        const uniqueCertifiers = new Set(validIds);
        if (uniqueCertifiers.size < p.minIndependentCertifiers) reasons.push("insufficient independent certifiers");
        if (uniqueCertifiers.size !== evidence.certifierIds.length) reasons.push("duplicate/self certification path detected");
      }

      if (evidence.checkpointPresent !== true) reasons.push("checkpoint required before promotion");
      if (evidence.evidencePreserved !== true) reasons.push("evidence preservation required");
      if (typeof evidence.policyVersion !== "string" ||
          evidence.policyVersion !== this.currentPolicyVersion) reasons.push("promotion policy version missing or drifted");
      if (p.requireHumanApprovalForCriticalChange && evidence.humanApprovedCriticalChange !== true) {
        reasons.push("human approval required for critical change");
      }

      if (evidence.unresolvedSignals !== undefined && !Array.isArray(evidence.unresolvedSignals)) {
        reasons.push("unresolved threat signals must be an array");
      } else {
        for (const signal of evidence.unresolvedSignals ?? []) {
          if (signal === null || typeof signal !== "object" ||
              typeof signal.type !== "string" ||
              !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(signal.severity) ||
              !Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1 ||
              typeof signal.detail !== "string" || !signal.detail.trim() ||
              typeof signal.source !== "string" || !signal.source.trim()) {
            reasons.push("malformed unresolved threat signal");
            continue;
          }
          if (signal.type === "TRANSPORT_PARTITION_OR_REORDER" && p.tolerateNetworkPartition) continue;
          if (!((DEFAULT_THREAT_MATRIX as readonly string[]).includes(signal.type)) &&
              p.failClosedOnUnknown && signal.severity !== "LOW") {
            reasons.push("unresolved unknown threat");
          } else if (signal.type === "UNKNOWN" && p.failClosedOnUnknown && signal.severity !== "LOW") {
            reasons.push("unresolved unknown threat");
          } else if (signal.severity === "CRITICAL" || signal.severity === "HIGH") {
            reasons.push(`unresolved threat: ${signal.type}`);
          }
        }
      }
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
