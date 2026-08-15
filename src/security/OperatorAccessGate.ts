export type ApiSensitivity = "PUBLIC_HEALTH" | "SENSITIVE_READ" | "MUTATION" | "CRITICAL_CHANGE";

export interface OperatorRequestContext {
  readonly method: string;
  readonly path: string;
  readonly bodyBytes: number;
  readonly contentType?: string;
  readonly tokenValid: boolean;
  readonly sourceId?: string;
  readonly provenanceId?: string;
  readonly declaredPolicyVersion?: string;
  readonly currentPolicyVersion: string;
  readonly humanApprovedCriticalChange?: boolean;
  readonly checkpointId?: string;
  readonly evidenceRef?: string;
}

export interface OperatorAccessPolicy {
  readonly maxBodyBytes: number;
  readonly requireJsonForMutations: boolean;
  readonly requireSourceIdentity: boolean;
  readonly requireProvenance: boolean;
  readonly allowedPaths: Readonly<Record<string, ApiSensitivity>>;
}

export interface OperatorAccessDecision {
  readonly allowed: boolean;
  readonly statusCode: 200 | 400 | 401 | 403 | 404 | 413 | 415;
  readonly sensitivity?: ApiSensitivity;
  readonly reasons: readonly string[];
}

export const DEFAULT_HARDENED_API_POLICY: OperatorAccessPolicy = Object.freeze({
  maxBodyBytes: 2 * 1024 * 1024,
  requireJsonForMutations: true,
  requireSourceIdentity: true,
  requireProvenance: true,
  allowedPaths: Object.freeze({
    "GET /api/health": "PUBLIC_HEALTH",
    "GET /api/ready": "PUBLIC_HEALTH",
    "GET /api/ledger": "SENSITIVE_READ",
    "POST /api/runtime/run": "MUTATION",
    "POST /api/upload": "MUTATION",
    "POST /api/omega/tick": "MUTATION",
    "POST /api/omega/connect": "CRITICAL_CHANGE"
  })
});

export class OperatorAccessGate {
  constructor(private readonly policy: OperatorAccessPolicy = DEFAULT_HARDENED_API_POLICY) {}

  authorize(ctx: OperatorRequestContext): OperatorAccessDecision {
    const key = `${ctx.method.toUpperCase()} ${ctx.path}`;
    const sensitivity = this.policy.allowedPaths[key];
    const reasons: string[] = [];

    if (!sensitivity) return decision(false, 404, undefined, ["route not exposed by hardened API"]);
    if (ctx.bodyBytes < 0) reasons.push("invalid body length");
    if (ctx.bodyBytes > this.policy.maxBodyBytes) return decision(false, 413, sensitivity, ["request body exceeds hardened limit"]);
    if (sensitivity !== "PUBLIC_HEALTH" && !ctx.tokenValid) return decision(false, 401, sensitivity, ["operator authentication required"]);

    if (sensitivity === "MUTATION" || sensitivity === "CRITICAL_CHANGE") {
      if (this.policy.requireJsonForMutations && !isJsonContentType(ctx.contentType)) return decision(false, 415, sensitivity, ["application/json required"]);
      if (this.policy.requireSourceIdentity && !ctx.sourceId?.trim()) reasons.push("source identity required");
      if (this.policy.requireProvenance && !ctx.provenanceId?.trim()) reasons.push("provenance reference required");
      if (!ctx.declaredPolicyVersion?.trim()) reasons.push("declared policy version required");
      if (ctx.declaredPolicyVersion && ctx.declaredPolicyVersion !== ctx.currentPolicyVersion) reasons.push("policy version drift");
    }

    if (sensitivity === "CRITICAL_CHANGE") {
      if (ctx.humanApprovedCriticalChange !== true) reasons.push("human approval required");
      if (!ctx.checkpointId?.trim()) reasons.push("checkpoint required before critical change");
      if (!ctx.evidenceRef?.trim()) reasons.push("evidence reference required before critical change");
    }

    if (reasons.length > 0) return decision(false, 403, sensitivity, reasons);
    return decision(true, 200, sensitivity, []);
  }
}

function isJsonContentType(value?: string): boolean {
  if (!value) return false;
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase();
  return normalized === "application/json" || normalized?.endsWith("+json") === true;
}

function decision(allowed: boolean, statusCode: OperatorAccessDecision["statusCode"], sensitivity: ApiSensitivity | undefined, reasons: readonly string[]): OperatorAccessDecision {
  return Object.freeze({ allowed, statusCode, sensitivity, reasons: Object.freeze([...reasons]) });
}
