import { hashOf } from "../utils/hash";
import {
  ASSURANCE_SEQUENCE,
  CONSTITUTIONAL_RULES,
  FEDERATION_PATH,
  NODE_BRIGADE_ROLES,
  PHOENIX_PATROL_SCOPE,
  ROLE_BOUNDARIES
} from "./SovereignArchitecture";

export type ThreatClass =
  | "CORRUPTION"
  | "POLICY_DRIFT"
  | "HALLUCINATION"
  | "ROGUE_BEHAVIOR"
  | "DATA_ROT"
  | "MALWARE"
  | "VIRUS"
  | "EXTERNAL_INTERFERENCE"
  | "UNAUTHORIZED_CHANGE"
  | "UNKNOWN_ANOMALY";

export type ProtectedDomain =
  | "AI"
  | "HEALTHCARE"
  | "FINANCE"
  | "INDUSTRIAL"
  | "ENERGY"
  | "TRANSPORTATION"
  | "GOVERNMENT"
  | "DEFENSE"
  | "TELECOM"
  | "ENTERPRISE"
  | "RESEARCH"
  | "GENERAL_SYSTEM";

export interface ThreatSignal {
  readonly sovereignId: string;
  readonly sectionId: string;
  readonly source: string;
  readonly domain: ProtectedDomain;
  readonly threatClass: ThreatClass;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly evidenceRefs: readonly string[];
  readonly stateHash: string;
  readonly observedAt: string;
}

export interface IncidentLearningRecord {
  readonly incidentId: string;
  readonly sovereignId: string;
  readonly sectionId: string;
  readonly domain: ProtectedDomain;
  readonly threatClass: ThreatClass;
  readonly evidenceRefs: readonly string[];
  readonly detectorUpdates: readonly string[];
  readonly baselineUpdates: readonly string[];
  readonly playbookUpdates: readonly string[];
  readonly verified: boolean;
  readonly validated: boolean;
  readonly certified: boolean;
  readonly spinePromotionApproved: boolean;
}

export interface SovereignDefenseState {
  readonly sovereignId: string;
  readonly isolated: boolean;
  readonly promotionFrozen: boolean;
  readonly activeThreats: readonly ThreatSignal[];
  readonly learnedIncidentHashes: readonly string[];
}

/**
 * Universal, proactive sovereign integrity policy layer.
 *
 * The fabric is industry-neutral. It protects state, data, identity, policy,
 * behavior, lineage, recovery, and trust boundaries for any governed system.
 * AI receives additional value because the same controls can observe model
 * drift, hallucination indicators, rogue tool behavior, memory corruption,
 * provenance breaks, unsafe autonomous change, and poisoned instructions.
 *
 * "Offense" means proactive hunt, adversarial discovery, fault injection, and
 * early threat identification inside governed scope. It does not mean external
 * counterattack.
 *
 * Learning cannot directly mutate trusted policy. Incident lessons become
 * active only after evidence-backed VERIFY -> VALIDATE -> CERTIFY and explicit
 * Spine-governed promotion.
 */
export class ProactiveIntegrityFabric {
  private readonly states = new Map<string, SovereignDefenseState>();

  registerSovereign(sovereignId: string): SovereignDefenseState {
    const existing = this.states.get(sovereignId);
    if (existing) return existing;

    const state: SovereignDefenseState = Object.freeze({
      sovereignId,
      isolated: true,
      promotionFrozen: false,
      activeThreats: Object.freeze([]),
      learnedIncidentHashes: Object.freeze([])
    });
    this.states.set(sovereignId, state);
    return state;
  }

  detect(signal: ThreatSignal): SovereignDefenseState {
    const current = this.registerSovereign(signal.sovereignId);
    const activeThreats = Object.freeze([
      ...current.activeThreats,
      Object.freeze({ ...signal })
    ]);

    const next: SovereignDefenseState = Object.freeze({
      ...current,
      promotionFrozen: true,
      activeThreats
    });
    this.states.set(signal.sovereignId, next);
    return next;
  }

  clearThreatAfterCertifiedRecovery(
    sovereignId: string,
    threatStateHash: string,
    assurance: { readonly verified: boolean; readonly validated: boolean; readonly certified: boolean }
  ): SovereignDefenseState {
    if (!assurance.verified || !assurance.validated || !assurance.certified) {
      throw new Error("VERIFY_VALIDATE_CERTIFY_REQUIRED");
    }

    const current = this.registerSovereign(sovereignId);
    const remaining = current.activeThreats.filter((t) => t.stateHash !== threatStateHash);
    const next: SovereignDefenseState = Object.freeze({
      ...current,
      promotionFrozen: remaining.length > 0,
      activeThreats: Object.freeze(remaining)
    });
    this.states.set(sovereignId, next);
    return next;
  }

  promoteLearning(record: IncidentLearningRecord): SovereignDefenseState {
    if (!record.verified || !record.validated || !record.certified || !record.spinePromotionApproved) {
      throw new Error("LEARNING_PROMOTION_REQUIRES_GOVERNED_ASSURANCE");
    }
    if (record.evidenceRefs.length === 0) {
      throw new Error("NO_ERASED_EVIDENCE");
    }

    const current = this.registerSovereign(record.sovereignId);
    const incidentHash = hashOf({
      incidentId: record.incidentId,
      sovereignId: record.sovereignId,
      sectionId: record.sectionId,
      domain: record.domain,
      threatClass: record.threatClass,
      evidenceRefs: record.evidenceRefs,
      detectorUpdates: record.detectorUpdates,
      baselineUpdates: record.baselineUpdates,
      playbookUpdates: record.playbookUpdates
    });

    const learnedIncidentHashes = current.learnedIncidentHashes.includes(incidentHash)
      ? current.learnedIncidentHashes
      : Object.freeze([...current.learnedIncidentHashes, incidentHash]);

    const next: SovereignDefenseState = Object.freeze({
      ...current,
      learnedIncidentHashes
    });
    this.states.set(record.sovereignId, next);
    return next;
  }

  snapshot(): readonly SovereignDefenseState[] {
    return Object.freeze([...this.states.values()]);
  }
}

export const UNIVERSAL_INTEGRITY_DOCTRINE = Object.freeze({
  scope: "ANY_SYSTEM_ANY_INDUSTRY",
  strongestFit: "AI_AND_AUTONOMOUS_SYSTEMS",
  protects: Object.freeze([
    "STATE",
    "DATA",
    "IDENTITY",
    "POLICY",
    "BEHAVIOR",
    "LINEAGE",
    "MEMORY",
    "RECOVERY",
    "TRUST"
  ]),
  proactiveOffense: Object.freeze([
    "HUNT_CORRUPTION",
    "ADVERSARIAL_TESTING",
    "DRIFT_DISCOVERY",
    "ANOMALY_CORRELATION",
    "THREAT_SIGNATURE_LEARNING"
  ]),
  defensiveReadiness: Object.freeze([
    "QUARANTINE_ON_VERIFIED_FAULT",
    "FREEZE_TRUST_PROMOTION",
    "SETBACK_TO_CERTIFIED_REFERENCE",
    "HEAL_FROM_CERTIFIED_MATERIAL_ONLY",
    "REVERIFY_BEFORE_REJOIN"
  ]),
  aiFocus: Object.freeze([
    "MODEL_DRIFT",
    "HALLUCINATION_INDICATORS",
    "ROGUE_TOOL_BEHAVIOR",
    "MEMORY_CORRUPTION",
    "PROMPT_OR_INSTRUCTION_POISONING",
    "UNSAFE_AUTONOMOUS_CHANGE",
    "PROVENANCE_BREAK"
  ]),
  learningRule: "LEARN_FROM_CERTIFIED_INCIDENT_EVIDENCE_NEVER_FROM_UNVERIFIED_ATTACK_STATE",
  constitutionalRules: CONSTITUTIONAL_RULES,
  assuranceSequence: ASSURANCE_SEQUENCE,
  patrolScope: PHOENIX_PATROL_SCOPE,
  nodeBrigadeRoles: NODE_BRIGADE_ROLES,
  roleBoundaries: ROLE_BOUNDARIES,
  federationPath: FEDERATION_PATH,
  spineBinding: "COMMON_CONSTITUTION_AND_GOVERNANCE_BOUND_TO_SPINE_WITHOUT_SHARED_RAW_STATE"
});
