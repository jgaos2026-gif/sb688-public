import {
  UniversalHardeningGate,
  type ArtifactCandidate,
  type EnvironmentId,
  type PromotionDecision,
  type PromotionEvidence,
  type PurificationDecision,
  type ThreatSignal
} from "../security/UniversalHardening";

export type SovereignId = "SOVEREIGN_1" | "SOVEREIGN_2" | "SOVEREIGN_3" | "SOVEREIGN_4";
export type SovereignRole = "STITCHBRICK_INTEGRITY" | "IRONLINK3_TRANSPORT" | "WATCHDOG_OVERSEER" | "QUBIX_NODE_BRIGADE";
export type SovereignAction = "PURIFY" | "VERIFY" | "VALIDATE" | "CERTIFY" | "REFERENCE_COMPARE" | "REVERIFY" | "REPAIR_CANDIDATE" | "TRANSPORT" | "CORRELATE" | "ALERT" | "ESCALATE" | "QUARANTINE" | "COORDINATE_RECOVERY";

export interface SovereignDefinition {
  readonly id: SovereignId;
  readonly role: SovereignRole;
  readonly reportsTo?: SovereignId;
  readonly allowedActions: readonly SovereignAction[];
  readonly forbiddenActions: readonly SovereignAction[];
}

export const FOUR_SOVEREIGNS: Readonly<Record<SovereignId, SovereignDefinition>> = Object.freeze({
  SOVEREIGN_1: Object.freeze({ id: "SOVEREIGN_1", role: "STITCHBRICK_INTEGRITY", allowedActions: Object.freeze(["PURIFY", "VERIFY", "VALIDATE", "QUARANTINE", "COORDINATE_RECOVERY"] as SovereignAction[]), forbiddenActions: Object.freeze(["TRANSPORT"] as SovereignAction[]) }),
  SOVEREIGN_2: Object.freeze({ id: "SOVEREIGN_2", role: "IRONLINK3_TRANSPORT", allowedActions: Object.freeze(["TRANSPORT"] as SovereignAction[]), forbiddenActions: Object.freeze(["CERTIFY", "REPAIR_CANDIDATE", "COORDINATE_RECOVERY"] as SovereignAction[]) }),
  SOVEREIGN_3: Object.freeze({ id: "SOVEREIGN_3", role: "WATCHDOG_OVERSEER", allowedActions: Object.freeze(["CORRELATE", "ALERT", "ESCALATE"] as SovereignAction[]), forbiddenActions: Object.freeze(["TRANSPORT", "CERTIFY", "REPAIR_CANDIDATE", "COORDINATE_RECOVERY"] as SovereignAction[]) }),
  SOVEREIGN_4: Object.freeze({ id: "SOVEREIGN_4", role: "QUBIX_NODE_BRIGADE", reportsTo: "SOVEREIGN_1", allowedActions: Object.freeze(["VERIFY", "VALIDATE", "REFERENCE_COMPARE", "REVERIFY", "REPAIR_CANDIDATE", "QUARANTINE"] as SovereignAction[]), forbiddenActions: Object.freeze(["TRANSPORT", "COORDINATE_RECOVERY"] as SovereignAction[]) })
});

export interface SovereignReport {
  readonly reportId: string;
  readonly source: SovereignId;
  readonly destination: SovereignId;
  readonly action: SovereignAction;
  readonly evidenceRefs: readonly string[];
  readonly policyVersion: string;
  readonly trusted: false;
  readonly requiresTransportGate: boolean;
  readonly mayTouchSpine: false;
}

export interface FabricDecision {
  readonly accepted: boolean;
  readonly reason: string;
  readonly source: SovereignId;
  readonly action: SovereignAction;
}

export class FourSovereignFabric {
  private readonly gate: UniversalHardeningGate;
  constructor(environment: EnvironmentId = "GENERAL") { this.gate = new UniversalHardeningGate(environment); }
  definitions(): readonly SovereignDefinition[] { return Object.freeze(Object.values(FOUR_SOVEREIGNS)); }
  authorizeAction(source: SovereignId, action: SovereignAction): FabricDecision {
    const definition = FOUR_SOVEREIGNS[source];
    const allowed = definition.allowedActions.includes(action) && !definition.forbiddenActions.includes(action);
    return Object.freeze({ accepted: allowed, reason: allowed ? `${definition.role} may perform ${action} within its declared sovereign boundary` : `${definition.role} is not authorized to perform ${action}`, source, action });
  }
  purify(candidate: ArtifactCandidate, signals: readonly ThreatSignal[] = []): PurificationDecision { return this.gate.inspect(candidate, signals); }
  certify(evidence: PromotionEvidence): PromotionDecision { return this.gate.authorizePromotion(evidence); }
  createReport(source: SovereignId, destination: SovereignId, action: SovereignAction, evidenceRefs: readonly string[], policyVersion: string, reportId = `${source}:${destination}:${action}:${Date.now()}`): SovereignReport {
    const authorization = this.authorizeAction(source, action);
    if (!authorization.accepted) throw new Error(authorization.reason);
    if (source === "SOVEREIGN_4" && destination !== "SOVEREIGN_1") throw new Error("SOVEREIGN_4 reports upward to SOVEREIGN_1 only; sideways bypass is forbidden");
    if (source === destination) throw new Error("cross-sovereign report destination must differ from source");
    if (!policyVersion.trim()) throw new Error("policyVersion is required");
    if (evidenceRefs.length === 0 || evidenceRefs.some((entry) => !entry.trim())) throw new Error("at least one non-empty evidence reference is required");
    return Object.freeze({ reportId, source, destination, action, evidenceRefs: Object.freeze([...evidenceRefs]), policyVersion, trusted: false, requiresTransportGate: true, mayTouchSpine: false });
  }
  authorizeTransport(report: SovereignReport, transportSovereign: SovereignId = "SOVEREIGN_2"): FabricDecision {
    if (transportSovereign !== "SOVEREIGN_2") return Object.freeze({ accepted: false, reason: "Only SOVEREIGN_2 / IronLink 3 may transport cross-sovereign reports", source: transportSovereign, action: "TRANSPORT" });
    if (!report.requiresTransportGate || report.evidenceRefs.length === 0 || !report.policyVersion.trim()) return Object.freeze({ accepted: false, reason: "Report lacks governed transport evidence", source: transportSovereign, action: "TRANSPORT" });
    return this.authorizeAction(transportSovereign, "TRANSPORT");
  }
}
