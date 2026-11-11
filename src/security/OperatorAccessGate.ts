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
  constructor(private readonly policy: OperatorAccessPolicy = DEFAULT_HARDENED_API_POLICY) {
    if (!policy || typeof policy !== "object" ||
        !Number.isSafeInteger(policy.maxBodyBytes) || policy.maxBodyBytes <= 0 ||
        !policy.allowedPaths || typeof policy.allowedPaths !== "object") {
      throw new Error("invalid operator access policy");
    }
  }

  authorize(ctx: OperatorRequestContext): OperatorAccessDecision {
    if (ctx === null || typeof ctx !== "object") {
      return decision(false, 400, undefined, ["request context must be an object"]);
    }
    if (typeof ctx.method !== "string" || !ctx.method.trim() ||
        typeof ctx.path !== "string" || !ctx.path.startsWith("/") ||
        !Number.isSafeInteger(ctx.bodyBytes) || ctx.bodyBytes < 0 ||
        typeof ctx.currentPolicyVersion !== "string" || !ctx.currentPolicyVersion.trim()) {
      return decision(false, 400, undefined, ["malformed request context"]);
    }
    const key = `${ctx.method.toUpperCase()} ${ctx.path}`;
    const sensitivity = this.policy.allowedPaths[key];
    const reasons: string[] = [];

    if (!sensitivity) return decision(false, 404, undefined, ["route not exposed by hardened API"]);
    if (ctx.bodyBytes < 0) reasons.push("invalid body length");
    if (ctx.bodyBytes > this.policy.maxBodyBytes) return decision(false, 413, sensitivity, ["request body exceeds hardened limit"]);
    if (sensitivity !== "PUBLIC_HEALTH" && ctx.tokenValid !== true) return decision(false, 401, sensitivity, ["operator authentication required"]);

    if (sensitivity === "MUTATION" || sensitivity === "CRITICAL_CHANGE") {
      if (this.policy.requireJsonForMutations && !isJsonContentType(ctx.contentType)) return decision(false, 415, sensitivity, ["application/json required"]);
      if (this.policy.requireSourceIdentity &&
          (typeof ctx.sourceId !== "string" || !ctx.sourceId.trim())) reasons.push("source identity required");
      if (this.policy.requireProvenance &&
          (typeof ctx.provenanceId !== "string" || !ctx.provenanceId.trim())) reasons.push("provenance reference required");
      if (typeof ctx.declaredPolicyVersion !== "string" || !ctx.declaredPolicyVersion.trim()) {
        reasons.push("declared policy version required");
      } else if (ctx.declaredPolicyVersion !== ctx.currentPolicyVersion) {
        reasons.push("policy version drift");
      }
    }

    if (sensitivity === "CRITICAL_CHANGE") {
      if (ctx.humanApprovedCriticalChange !== true) reasons.push("human approval required");
      if (typeof ctx.checkpointId !== "string" || !ctx.checkpointId.trim()) reasons.push("checkpoint required before critical change");
      if (typeof ctx.evidenceRef !== "string" || !ctx.evidenceRef.trim()) reasons.push("evidence reference required before critical change");
    }

    if (reasons.length > 0) return decision(false, 403, sensitivity, reasons);
    return decision(true, 200, sensitivity, []);
  }
}

function isJsonContentType(value?: string): boolean {
  if (typeof value !== "string" || !value) return false;
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase();
  return normalized === "application/json" || normalized?.endsWith("+json") === true;
}

function decision(allowed: boolean, statusCode: OperatorAccessDecision["statusCode"], sensitivity: ApiSensitivity | undefined, reasons: readonly string[]): OperatorAccessDecision {
  return Object.freeze({ allowed, statusCode, sensitivity, reasons: Object.freeze([...reasons]) });
}
