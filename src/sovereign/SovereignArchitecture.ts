export const CONSTITUTIONAL_RULES = Object.freeze([
  "NO_BYPASS",
  "NO_SILENT_TRUST",
  "NO_SILENT_REPAIR",
  "NO_SELF_CERTIFICATION",
  "NO_ERASED_EVIDENCE"
] as const);

export const ASSURANCE_SEQUENCE = Object.freeze(["VERIFY", "VALIDATE", "CERTIFY"] as const);

export const RECOVERY_SEQUENCE = Object.freeze([
  "NORMAL_STATE",
  "ANOMALY",
  "OBSERVE",
  "VERIFY_FAULT",
  "QUARANTINE",
  "FREEZE_TRUST_PROMOTION",
  "IDENTIFY_LAST_CERTIFIED_CHECKPOINT",
  "COMPARE",
  "ROLL_BACK_OR_RECONSTRUCT",
  "VERIFY",
  "VALIDATE",
  "CERTIFY",
  "SOVEREIGN_REVIEW",
  "GOVERNMENT_COMPARISON",
  "REJOIN"
] as const);

export const NODE_BRIGADE_ROLES = Object.freeze([
  "VERIFICATION_NODE",
  "VALIDATION_NODE",
  "CERTIFICATION_NODE",
  "REFERENCE_NODE",
  "RE_VERIFICATION_NODE",
  "HEALING_REWRITE_NODE"
] as const);

export const PHOENIX_PATROL_SCOPE = Object.freeze([
  "NODE_OBSERVATIONS",
  "HEARTBEAT",
  "LEDGER_EVENTS",
  "RESOURCE_TELEMETRY",
  "INTEGRITY_STATE",
  "CLIP_STATE",
  "BCT_CROSSINGS",
  "CHECKPOINT_HEALTH",
  "POLICY_DRIFT",
  "MEMORY_CONDITION",
  "SYSTEM_ANOMALIES"
] as const);

export const ROLE_BOUNDARIES = Object.freeze({
  PATROL: Object.freeze({ role: "EYES_AND_EARS", may: ["OBSERVE", "SENSE", "COLLECT_EVIDENCE", "DETECT_ANOMALY"], mayNot: ["CERTIFY", "SELF_REPAIR", "BYPASS"] }),
  TRIO: Object.freeze({ role: "JUDGMENT", may: ["EVALUATE", "COMPARE", "VERIFY", "VALIDATE"], mayNot: ["DIRECT_REPAIR", "BYPASS"] }),
  PHOENIX: Object.freeze({ role: "RECOVERY_COORDINATION", may: ["QUARANTINE", "SETBACK", "CHECKPOINT_SELECTION", "REPAIR_ROUTING", "REJOIN_PREPARATION"], mayNot: ["SELF_CERTIFY", "BYPASS"] }),
  WATCHDOG_OVERSEER: Object.freeze({ role: "CORRELATION_AND_ESCALATION", may: ["WATCH", "CORRELATE", "QUESTION", "ALERT", "ESCALATE"], mayNot: ["REWRITE_EVIDENCE", "SELF_CERTIFY", "BYPASS"] })
});

export const FEDERATION_PATH = Object.freeze({
  path: Object.freeze([
    "SOVEREIGN_VERIFIED_REPORT",
    "STITCHBRIDGE",
    "IRONLINK_3",
    "BCT_CLIP_GATES",
    "SPINE_PROOF_LEDGER"
  ] as const),
  directCrossSovereignBypassAllowed: false
});

export interface SovereignManifest {
  readonly SOVEREIGN_ID: string;
  readonly KEYS: readonly string[];
  readonly LOCAL_POLICIES: readonly string[];
  readonly LOCAL_AUTHORITIES: readonly string[];
  readonly SECTION_MAP: Readonly<Record<string, readonly string[]>>;
  readonly TRIO_ASSIGNMENTS: Readonly<Record<string, string>>;
  readonly PHOENIX_ASSIGNMENTS: Readonly<Record<string, string>>;
  readonly CAPABILITIES: readonly string[];
  readonly TRUST_RELATIONSHIPS: readonly string[];
  readonly CHECKPOINT_REFERENCES: readonly string[];
  readonly DATA_BOUNDARIES: readonly string[];
  readonly FAILURE_DOMAIN: string;
  readonly FEDERATION_CONTRACTS: readonly string[];
}

export interface StitchBrickManifest {
  readonly identity: string;
  readonly version: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly permissions: readonly string[];
  readonly dependencies: readonly string[];
  readonly resourceLimits: Readonly<Record<string, number>>;
  readonly state: "ACTIVE" | "DORMANT" | "QUARANTINED" | "RECOVERING";
  readonly policy: string;
  readonly health: string;
  readonly recovery: string;
  readonly proofRequirements: readonly string[];
  readonly clips: readonly string[];
}

export interface ClipContract {
  readonly id: string;
  readonly fromBrick: string;
  readonly toBrick: string;
  readonly purpose: string;
  readonly data: readonly string[];
  readonly format: string;
  readonly permission: "READ_ONLY" | "ACTION" | "WRITE";
  readonly duration: string;
  readonly governingPolicy: string;
  readonly recoveryPath: string;
}

export const GOVERNANCE_HIERARCHY = Object.freeze([
  "HUMAN_APPROVAL_OWNER_AUTHORITY",
  "SYSTEM_CONSTITUTION_CREED",
  "GOVERNMENT_SYSTEM_TRIO",
  "SOVEREIGN_TRIO",
  "SECTIONAL_TRIOS",
  "PHOENIX_PATROL",
  "NODE_BRIGADE",
  "LOCAL_STITCHBRICKS"
] as const);

export const SOVEREIGN_A_SECTION_SCHEDULE = Object.freeze({
  SECTION_A1: Object.freeze({ trio: "TRIO_A1", phoenix: "PHOENIX_A1", offsetsHours: [0, 2, 4] }),
  SECTION_A2: Object.freeze({ trio: "TRIO_A2", phoenix: "PHOENIX_A2", offsetsHours: [0, 2, 4] }),
  SECTION_A3: Object.freeze({ trio: "TRIO_A3", phoenix: "PHOENIX_A3", offsetsHours: [0, 2, 4] }),
  SECTION_A4: Object.freeze({ trio: "TRIO_A4", phoenix: "PHOENIX_A4", offsetsHours: [0, 2, 4] })
});

export interface RecoveryDecision {
  readonly patrolObserved: boolean;
  readonly trioJudgedFault: boolean;
  readonly quarantined: boolean;
  readonly promotionFrozen: boolean;
  readonly certifiedCheckpointSelected: boolean;
  readonly repairedOrRolledBack: boolean;
  readonly reverified: boolean;
  readonly validated: boolean;
  readonly certified: boolean;
  readonly sovereignReviewed: boolean;
  readonly governmentCompared: boolean;
  readonly stitchbridgeRestored: boolean;
}

export function canRejoin(decision: RecoveryDecision): boolean {
  return decision.patrolObserved &&
    decision.trioJudgedFault &&
    decision.quarantined &&
    decision.promotionFrozen &&
    decision.certifiedCheckpointSelected &&
    decision.repairedOrRolledBack &&
    decision.reverified &&
    decision.validated &&
    decision.certified &&
    decision.sovereignReviewed &&
    decision.governmentCompared &&
    decision.stitchbridgeRestored;
}

export function validateClip(contract: ClipContract): boolean {
  if (!contract.id || !contract.fromBrick || !contract.toBrick || contract.fromBrick === contract.toBrick) return false;
  if (!contract.purpose || !contract.format || !contract.governingPolicy || !contract.recoveryPath) return false;
  if (contract.permission === "WRITE" || contract.permission === "ACTION") {
    return contract.governingPolicy.includes("APPROVAL") || contract.governingPolicy.includes("AUTHORIZED");
  }
  return true;
}
