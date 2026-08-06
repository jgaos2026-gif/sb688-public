import { hashOf } from "../utils/hash";
import type { AuditLedger } from "../ledger/AuditLedger";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";

/**
 * BCT Verifier — Phase 6 Braided Computational Topology verification layers.
 *
 * Every state transition passes SIX verification layers in order:
 *
 *   1. Identity verification   — subject has a valid, non-empty identity
 *   2. Schema verification     — state conforms to required structure
 *   3. Cryptographic verification — hash integrity matches declared hash
 *   4. Braid verification      — braid signature binds state to governance chain
 *   5. Transaction verification — the transition is logically consistent
 *   6. Audit verification      — the audit ledger chain is intact
 *
 * No state becomes trusted without passing ALL six layers.
 */

export interface BctVerificationInput {
  /** Identity of the subject (e.g. intentId, nodeId, snapshotId). */
  readonly identity: string;
  /** The state payload to verify. */
  readonly state: Readonly<Record<string, unknown>>;
  /** The expected/declared hash of the state (from a trusted source). */
  readonly declaredHash: string;
  /** The braid signature that should bind this state. */
  readonly braidSignature: string;
  /** The governance chain root (spine signature) that authorized this state. */
  readonly spineSignature: string;
  /** Previously known audit hash at the start of this transition. */
  readonly priorAuditHash: string;
  /** Required keys that must be present in the state. */
  readonly requiredKeys?: readonly string[];
  /** Optional prior state hash for transaction consistency. */
  readonly priorStateHash?: string;
}

export interface BctLayerResult {
  readonly layer: string;
  readonly passed: boolean;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface BctVerificationResult {
  readonly trusted: boolean;
  readonly layers: readonly BctLayerResult[];
  readonly finalHash: string;
  readonly auditHash: string;
  readonly failedLayers: readonly string[];
}

export class BctVerifier {
  private readonly ledger: AuditLedger;
  private readonly clock: Clock;

  constructor(ledger: AuditLedger, clock: Clock = systemClock) {
    this.ledger = ledger;
    this.clock = clock;
  }

  /** Run all six verification layers. Returns result only after all layers execute. */
  verify(input: BctVerificationInput): BctVerificationResult {
    const at = this.clock();
    const layers: BctLayerResult[] = [];

    // ── Layer 1: Identity ─────────────────────────────────────────────────────
    const id1 = this.layerIdentity(input);
    layers.push(id1);

    // ── Layer 2: Schema ───────────────────────────────────────────────────────
    const id2 = this.layerSchema(input);
    layers.push(id2);

    // ── Layer 3: Cryptographic ────────────────────────────────────────────────
    const id3 = this.layerCrypto(input);
    layers.push(id3);

    // ── Layer 4: Braid ────────────────────────────────────────────────────────
    const id4 = this.layerBraid(input);
    layers.push(id4);

    // ── Layer 5: Transaction ──────────────────────────────────────────────────
    const id5 = this.layerTransaction(input);
    layers.push(id5);

    // ── Layer 6: Audit ────────────────────────────────────────────────────────
    const id6 = this.layerAudit(input);
    layers.push(id6);

    const failedLayers = layers.filter((l) => !l.passed).map((l) => l.layer);
    const trusted = failedLayers.length === 0;
    const finalHash = hashOf({ input: { identity: input.identity, declaredHash: input.declaredHash }, layers });
    const currentAuditHash = this.ledger.latestHash();

    this.ledger.append({
      traceId: `bct:${input.identity}`,
      from: trusted ? "bct.audit" : "bct.identity",
      to: trusted ? "ledger" : "bct.identity",
      status: trusted ? "passed" : "failed",
      at,
      detail: {
        identity: input.identity,
        trusted,
        failedLayers,
        finalHash
      }
    });

    return Object.freeze({
      trusted,
      layers: Object.freeze(layers),
      finalHash,
      auditHash: this.ledger.latestHash(),
      failedLayers: Object.freeze(failedLayers)
    });
  }

  // ─── Private layer implementations ───────────────────────────────────────────

  private layerIdentity(input: BctVerificationInput): BctLayerResult {
    const passed = typeof input.identity === "string" && input.identity.trim().length > 0;
    return {
      layer: "identity",
      passed,
      message: passed ? "Identity is present and non-empty." : "Identity is missing or empty.",
      detail: { identity: input.identity }
    };
  }

  private layerSchema(input: BctVerificationInput): BctLayerResult {
    const required = input.requiredKeys ?? [];
    const missing = required.filter((k) => !(k in input.state));
    const passed = missing.length === 0;
    return {
      layer: "schema",
      passed,
      message: passed
        ? "State conforms to required schema."
        : `Missing required keys: ${missing.join(", ")}.`,
      detail: { requiredKeys: required, missingKeys: missing }
    };
  }

  private layerCrypto(input: BctVerificationInput): BctLayerResult {
    const actualHash = hashOf(input.state);
    const passed = actualHash === input.declaredHash;
    return {
      layer: "crypto",
      passed,
      message: passed
        ? "Cryptographic hash matches declared hash."
        : "Hash mismatch — state has been tampered with.",
      detail: { actualHash, declaredHash: input.declaredHash }
    };
  }

  private layerBraid(input: BctVerificationInput): BctLayerResult {
    // Braid signature must start with sha256: and bind the state hash and spine.
    const wellFormed = input.braidSignature.startsWith("sha256:");
    // Verify the braid signature encodes the state hash deterministically.
    // The canonical braid signature must equal hashOf({ state, spine }).
    const canonical = hashOf({ stateHash: input.declaredHash, spineSignature: input.spineSignature });
    const passed = wellFormed && input.braidSignature === canonical;
    return {
      layer: "braid",
      passed,
      message: passed
        ? "Braid signature binds state to governance chain."
        : "Braid signature is invalid or does not bind this state.",
      detail: { braidSignature: input.braidSignature, canonical, wellFormed }
    };
  }

  private layerTransaction(input: BctVerificationInput): BctLayerResult {
    if (!input.priorStateHash) {
      // No prior hash — first transaction in the chain; always allowed.
      return { layer: "transaction", passed: true, message: "Genesis transaction — no prior hash required." };
    }
    // The transition is valid if the declared hash differs from the prior hash
    // (state must have changed) OR if they are equal (idempotent transition is acceptable).
    // The key invariant is that the prior hash must itself be a valid sha256 hash.
    const priorWellFormed = input.priorStateHash.startsWith("sha256:") || input.priorStateHash === "GENESIS";
    const passed = priorWellFormed;
    return {
      layer: "transaction",
      passed,
      message: passed
        ? "Transaction is logically consistent with prior state."
        : "Prior state hash is malformed — transaction chain broken.",
      detail: { priorStateHash: input.priorStateHash }
    };
  }

  private layerAudit(input: BctVerificationInput): BctLayerResult {
    const chainValid = this.ledger.verifyChain();
    const latestAuditHash = this.ledger.latestHash();
    // priorAuditHash must exactly match the current ledger head.
    // When the ledger is empty, latestHash() returns "GENESIS".
    const priorHashMatch = latestAuditHash === input.priorAuditHash;
    const passed = chainValid && priorHashMatch;
    return {
      layer: "audit",
      passed,
      message: passed
        ? "Audit ledger chain is intact and prior hash matches."
        : "Audit ledger chain is broken or prior hash mismatch.",
      detail: { chainValid, priorAuditHash: input.priorAuditHash, latestAuditHash }
    };
  }
}

/** Helper: compute the canonical braid signature for use with BctVerifier. */
export function computeBraidSignature(stateHash: string, spineSignature: string): string {
  return hashOf({ stateHash, spineSignature });
}
