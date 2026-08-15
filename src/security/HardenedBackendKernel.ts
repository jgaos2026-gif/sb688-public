import { OperatorAccessGate, type OperatorRequestContext } from "./OperatorAccessGate";
import {
  UniversalHardeningGate,
  type ArtifactCandidate,
  type EnvironmentId,
  type PromotionEvidence,
  type ThreatSignal
} from "./UniversalHardening";
import { FourSovereignFabric } from "../system/FourSovereignFabric";

export type BackendOperation = "HEALTH" | "READY" | "READ_LEDGER" | "RUN_INTENT" | "UPLOAD" | "TICK" | "CONNECT_STITCH";

export interface BackendRequest<T = unknown> {
  readonly operation: BackendOperation;
  readonly tokenValid: boolean;
  readonly sourceId?: string;
  readonly provenanceId?: string;
  readonly policyVersion: string;
  readonly contentType?: string;
  readonly bodyBytes: number;
  readonly artifact?: ArtifactCandidate;
  readonly signals?: readonly ThreatSignal[];
  readonly promotionEvidence?: PromotionEvidence;
  readonly humanApprovedCriticalChange?: boolean;
  readonly checkpointId?: string;
  readonly evidenceRef?: string;
  readonly payload?: T;
}

export interface BackendAdapter {
  health(): unknown;
  ready(): unknown;
  readLedger(): unknown;
  runIntent(payload: unknown): unknown | Promise<unknown>;
  upload(payload: unknown): unknown | Promise<unknown>;
  tick(payload: unknown): unknown | Promise<unknown>;
  connectStitch(payload: unknown): unknown | Promise<unknown>;
}

export interface BackendResponse {
  readonly ok: boolean;
  readonly statusCode: number;
  readonly stage: "ACCESS" | "PURIFICATION" | "PROMOTION" | "EXECUTION";
  readonly reasons: readonly string[];
  readonly data?: unknown;
}

const ROUTES: Readonly<Record<BackendOperation, { method: string; path: string }>> = Object.freeze({
  HEALTH: { method: "GET", path: "/api/health" },
  READY: { method: "GET", path: "/api/ready" },
  READ_LEDGER: { method: "GET", path: "/api/ledger" },
  RUN_INTENT: { method: "POST", path: "/api/runtime/run" },
  UPLOAD: { method: "POST", path: "/api/upload" },
  TICK: { method: "POST", path: "/api/omega/tick" },
  CONNECT_STITCH: { method: "POST", path: "/api/omega/connect" }
});

export class HardenedBackendKernel {
  private readonly access = new OperatorAccessGate();
  private readonly hardening: UniversalHardeningGate;
  private readonly sovereigns: FourSovereignFabric;

  constructor(private readonly adapter: BackendAdapter, environment: EnvironmentId = "GENERAL") {
    this.hardening = new UniversalHardeningGate(environment);
    this.sovereigns = new FourSovereignFabric(environment);
  }

  async handle(request: BackendRequest): Promise<BackendResponse> {
    const route = ROUTES[request.operation];
    const accessContext: OperatorRequestContext = {
      method: route.method,
      path: route.path,
      bodyBytes: request.bodyBytes,
      contentType: request.contentType,
      tokenValid: request.tokenValid,
      sourceId: request.sourceId,
      provenanceId: request.provenanceId,
      declaredPolicyVersion: request.policyVersion,
      currentPolicyVersion: request.artifact?.currentPolicyVersion ?? request.policyVersion,
      humanApprovedCriticalChange: request.humanApprovedCriticalChange,
      checkpointId: request.checkpointId,
      evidenceRef: request.evidenceRef
    };
    const access = this.access.authorize(accessContext);
    if (!access.allowed) return blocked(access.statusCode, "ACCESS", access.reasons);

    if (request.operation === "HEALTH") return executed(this.adapter.health());
    if (request.operation === "READY") return executed(this.adapter.ready());
    if (request.operation === "READ_LEDGER") return executed(this.adapter.readLedger());

    if (!request.artifact) return blocked(403, "PURIFICATION", ["artifact envelope required for state-changing operation"]);
    const purification = this.hardening.inspect(request.artifact, request.signals ?? []);
    if (purification.state !== "PURIFIED_CANDIDATE") return blocked(403, "PURIFICATION", purification.reasons);

    if (request.operation === "CONNECT_STITCH") {
      if (!request.promotionEvidence) return blocked(403, "PROMOTION", ["promotion evidence required for Stitch connection"]);
      const promotion = this.hardening.authorizePromotion(request.promotionEvidence);
      if (promotion.state !== "CERTIFIED") return blocked(403, "PROMOTION", promotion.reasons);
      const sovereignDecision = this.sovereigns.authorizeAction("SOVEREIGN_1", "COORDINATE_RECOVERY");
      if (!sovereignDecision.accepted) return blocked(403, "PROMOTION", [sovereignDecision.reason]);
      return executed(await this.adapter.connectStitch(request.payload));
    }

    switch (request.operation) {
      case "RUN_INTENT": return executed(await this.adapter.runIntent(request.payload));
      case "UPLOAD": return executed(await this.adapter.upload(request.payload));
      case "TICK": return executed(await this.adapter.tick(request.payload));
      default: return blocked(404, "ACCESS", ["unsupported operation"]);
    }
  }
}

function blocked(statusCode: number, stage: BackendResponse["stage"], reasons: readonly string[]): BackendResponse {
  return Object.freeze({ ok: false, statusCode, stage, reasons: Object.freeze([...reasons]) });
}
function executed(data: unknown): BackendResponse {
  return Object.freeze({ ok: true, statusCode: 200, stage: "EXECUTION", reasons: Object.freeze([]), data });
}
