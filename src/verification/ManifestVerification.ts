import { createHash } from "node:crypto";
import { stableStringify } from "../utils/hash";

export const VALID_RULE = "HASH_MATCH AND SIGNATURE_VALID AND MANIFEST_MATCH AND TOPOLOGY_CONSISTENT";
export const REQUIRED_CAPABILITIES = Object.freeze([
  "snapshot",
  "rollback",
  "diff-tracking",
  "replica verification"
] as const);
export const RUNTIME_TOPOLOGY_STATEMENT =
  "runtime uses quantum-inspired topology and fault-tolerant verification structure";

export interface ManifestVerificationSignals {
  readonly hashMatch: boolean;
  readonly signatureValid: boolean;
  readonly manifestMatch: boolean;
  readonly topologyConsistent: boolean;
}

export interface ManifestCreatedEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly event: "MANIFEST_CREATED";
  readonly sha256: string;
  readonly capabilities: readonly string[];
  readonly validRule: typeof VALID_RULE;
  readonly runtime: typeof RUNTIME_TOPOLOGY_STATEMENT;
  readonly verification: ManifestVerificationSignals;
  readonly valid: boolean;
}

interface ManifestWithoutSha256 {
  readonly id: string;
  readonly timestamp: number;
  readonly event: "MANIFEST_CREATED";
  readonly capabilities: readonly string[];
  readonly validRule: typeof VALID_RULE;
  readonly runtime: typeof RUNTIME_TOPOLOGY_STATEMENT;
  readonly verification: ManifestVerificationSignals;
  readonly valid: boolean;
}

export function evaluateManifestValidity(signals: ManifestVerificationSignals): boolean {
  return signals.hashMatch && signals.signatureValid && signals.manifestMatch && signals.topologyConsistent;
}

export function forgeManifestCreatedEntry(input: {
  readonly id: string;
  readonly timestamp: number;
  readonly verification: ManifestVerificationSignals;
}): ManifestCreatedEntry {
  const payload: ManifestWithoutSha256 = {
    id: input.id,
    timestamp: input.timestamp,
    event: "MANIFEST_CREATED",
    capabilities: REQUIRED_CAPABILITIES,
    validRule: VALID_RULE,
    runtime: RUNTIME_TOPOLOGY_STATEMENT,
    verification: input.verification,
    valid: evaluateManifestValidity(input.verification)
  };
  const sha256 = sha256Hex(payload);
  return Object.freeze({ ...payload, sha256 });
}

export function verifyReplicaManifest(
  primary: ManifestCreatedEntry,
  replica: ManifestCreatedEntry
): boolean {
  if (primary.sha256 !== replica.sha256) {
    return false;
  }

  const expectedReplicaHash = sha256Hex(manifestPayload(replica));
  if (expectedReplicaHash !== replica.sha256) {
    return false;
  }

  const expectedValid = evaluateManifestValidity(replica.verification);
  if (replica.valid !== expectedValid) {
    return false;
  }

  return (
    replica.validRule === VALID_RULE &&
    replica.runtime === RUNTIME_TOPOLOGY_STATEMENT &&
    stableStringify(replica.capabilities) === stableStringify(REQUIRED_CAPABILITIES)
  );
}

function manifestPayload(entry: ManifestCreatedEntry): ManifestWithoutSha256 {
  const { sha256: _sha256, ...payload } = entry;
  return payload;
}

function sha256Hex(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
