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
 *   5. Transaction verification — the transition itself is valid: the new
 *      state's hash must be chained to the prior state's hash, and a no-op
 *      transition (new hash equals prior hash) is never certified as a new
 *      state. Allowed transitions are genesis (no prior hash) or a chained
 *      transition to a different state.
 *   6. Audit verification      — the audit ledger chain is intact
 *
 * No state becomes trusted without passing ALL six layers.
 *
 * FINDING 15 — prior-state anchoring (the biggest research item):
 * knowing two hashes used to be enough to forge a transition, because
 * layer 5 accepted ANY well-formed prior hash with a matching transition
 * hash (and transition hashes are just sha256 — anyone can compute one).
 * The verifier now anchors the prior against an AUTHORITATIVE REGISTRY
 * of known chain heads (one head per identity):
 *   - a non-genesis prior must EQUAL the registered head for that
 *     identity — a forged parent, a stale (old) parent, and a competing
 *     branch (a second child of the same parent after the head moved)
 *     are all rejected;
 *   - genesis (no prior / "GENESIS") is allowed ONLY when the caller
 *     explicitly passes `allowGenesis: true` AND the identity has no
 *     registered head yet — an identity that already has a head can
 *     never start over;
 *   - on a trusted verification the head advances to the new state's
 *     hash, so the next transition must chain from THIS state.
 * Seed the registry with `registerHead(identity, hash)` (operator /
 * caller action — e.g. restoring a head from durable storage). The
 * registry is in-memory per verifier by default; a caller may inject a
 * shared/persistent registry via the constructor. A head that exists
 * only in memory is lost on restart — the operator must re-seed from
 * the durable record, and must never seed from an untrusted source.
 *
 * FINDING 16 — malformed input: `verify()` NEVER throws. A null,
 * mistyped, or structurally wrong input returns a structured rejection
 * (trusted:false, every layer failed with a message) instead of an
 * exception. Callers gate on `trusted`, never on try/catch.
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
  /**
   * Hash binding the new state to the prior state, computed as
   * hashOf({ stateHash: declaredHash, priorStateHash }).
   * Required when priorStateHash is present and not "GENESIS": without it
   * the verifier cannot establish that this transition follows from that
   * prior state, and the transition is rejected.
   */
  readonly transitionHash?: string;
  /**
   * Explicit authorization for a genesis transition (no prior state).
   * Default false: genesis without this flag is REJECTED. An identity
   * with a registered head can never take a genesis transition, even
   * with this flag — that would fork its chain.
   */
  readonly allowGenesis?: boolean;
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
  /**
   * True when the verification ran but its ledger entry could not be
   * appended (e.g. the ledger chain was corrupt and append failed
   * closed). The result itself is still returned — the failure is
   * reported, not thrown.
   */
  readonly ledgerAppendFailed?: boolean;
}

/**
 * Authoritative registry of known chain heads, one per identity.
 * The verifier trusts ONLY the head recorded here as a transition's
 * parent — never a hash the caller merely asserts.
 */
export class BctHeadRegistry {
  private readonly heads = new Map<string, string>();

  /** Current registered head for an identity, or undefined. */
  head(identity: string): string | undefined {
    return this.heads.get(identity);
  }

  /** True when the identity has a registered head. */
  has(identity: string): boolean {
    return this.heads.has(identity);
  }

  /**
   * Seed (or re-seed) a head. This is an OPERATOR / caller trust action:
   * seed only from a durable record you trust (e.g. the last verified
   * state hash from storage). Seeding from caller-supplied input
   * defeats the anchoring — never do that.
   */
  register(identity: string, stateHash: string): void {
    this.heads.set(identity, stateHash);
  }

  /**
   * Advance the head after a trusted transition. Returns false (and
   * changes nothing) unless the recorded head equals the expected prior
   * — so a competing branch can never silently overwrite the head.
   */
  advance(identity: string, expectedPrior: string, newHash: string): boolean {
    if (this.heads.get(identity) !== expectedPrior) return false;
    this.heads.set(identity, newHash);
    return true;
  }
}

const LAYER_NAMES = ["identity", "schema", "crypto", "braid", "transaction", "audit"] as const;

export class BctVerifier {
  private readonly ledger: AuditLedger;
  private readonly clock: Clock;
  private readonly registry: BctHeadRegistry;

  constructor(ledger: AuditLedger, clock: Clock = systemClock, registry: BctHeadRegistry = new BctHeadRegistry()) {
    this.ledger = ledger;
    this.clock = clock;
    this.registry = registry;
  }

  /** Seed a known chain head (operator/caller trust action — see BctHeadRegistry). */
  registerHead(identity: string, stateHash: string): void {
    this.registry.register(identity, stateHash);
  }

  /** Current registered head for an identity, or undefined. */
  registeredHead(identity: string): string | undefined {
    return this.registry.head(identity);
  }

  /**
   * Run all six verification layers. NEVER throws: malformed input
   * returns a structured rejection, and a ledger-append failure is
   * reported via `ledgerAppendFailed`, not raised.
   */
  verify(input: BctVerificationInput): BctVerificationResult {
    try {
      return this.verifyInner(input);
    } catch (cause) {
      // Last-resort guard: no input, however malformed, may throw out
      // of the verifier. Report the rejection structurally.
      return this.rejectionResult(
        `Verifier rejected malformed input: ${cause instanceof Error ? cause.message : String(cause)}.`,
        false
      );
    }
  }

  /** Run all six verification layers. Returns result only after all layers execute. */
  private verifyInner(input: BctVerificationInput): BctVerificationResult {
    const at = this.clock();

    if (input === null || typeof input !== "object") {
      return this.rejectionResult("Input is not an object — nothing to verify.", false);
    }

    const layers: BctLayerResult[] = [];

    // ── Layer 1: Identity ─────────────────────────────────────────────────────
    layers.push(this.layerIdentity(input));

    // ── Layer 2: Schema ───────────────────────────────────────────────────────
    layers.push(this.layerSchema(input));

    // ── Layer 3: Cryptographic ────────────────────────────────────────────────
    layers.push(this.layerCrypto(input));

    // ── Layer 4: Braid ────────────────────────────────────────────────────────
    layers.push(this.layerBraid(input));

    // ── Layer 5: Transaction ──────────────────────────────────────────────────
    layers.push(this.layerTransaction(input));

    // ── Layer 6: Audit ────────────────────────────────────────────────────────
    layers.push(this.layerAudit(input));

    const failedLayers = layers.filter((l) => !l.passed).map((l) => l.layer);
    const trusted = failedLayers.length === 0;
    const finalHash = hashOf({
      input: { identity: typeof input.identity === "string" ? input.identity : null, declaredHash: typeof input.declaredHash === "string" ? input.declaredHash : null },
      layers
    });

    // On a trusted transition the registered head advances to the new
    // state — the next transition must chain from THIS state, so an old
    // parent or a competing branch is rejected from here on.
    if (trusted && typeof input.identity === "string" && typeof input.declaredHash === "string") {
      if (input.priorStateHash === undefined || input.priorStateHash === "GENESIS") {
        this.registry.register(input.identity, input.declaredHash);
      } else {
        this.registry.advance(input.identity, input.priorStateHash, input.declaredHash);
      }
    }

    let ledgerAppendFailed = false;
    try {
      this.ledger.append({
        traceId: `bct:${typeof input.identity === "string" && input.identity ? input.identity : "unknown"}`,
        from: trusted ? "bct.audit" : "bct.identity",
        to: trusted ? "ledger" : "bct.identity",
        status: trusted ? "passed" : "failed",
        at,
        detail: {
          identity: typeof input.identity === "string" ? input.identity : null,
          trusted,
          failedLayers,
          finalHash
        }
      });
    } catch {
      // The ledger failed closed (e.g. corrupt chain refused the append).
      // Report it on the result; never throw out of the verifier.
      ledgerAppendFailed = true;
    }

    return Object.freeze({
      trusted,
      layers: Object.freeze(layers),
      finalHash,
      auditHash: this.ledger.latestHash(),
      failedLayers: Object.freeze(failedLayers),
      ...(ledgerAppendFailed ? { ledgerAppendFailed: true as const } : {})
    });
  }

  /** Structured rejection for input that cannot even be layered. */
  private rejectionResult(message: string, ledgerAppendFailed: boolean): BctVerificationResult {
    const layers = LAYER_NAMES.map((layer) => ({
      layer,
      passed: false,
      message
    }));
    return Object.freeze({
      trusted: false,
      layers: Object.freeze(layers),
      finalHash: hashOf({ rejected: "malformed-input", message }),
      auditHash: this.ledger.latestHash(),
      failedLayers: Object.freeze([...LAYER_NAMES]),
      ...(ledgerAppendFailed ? { ledgerAppendFailed: true as const } : {})
    });
  }

  // ─── Private layer implementations ───────────────────────────────────────────

  private layerIdentity(input: BctVerificationInput): BctLayerResult {
    const passed = typeof input.identity === "string" && input.identity.trim().length > 0;
    return {
      layer: "identity",
      passed,
      message: passed ? "Identity is present and non-empty." : "Identity is missing or empty.",
      detail: { identity: typeof input.identity === "string" ? input.identity : null }
    };
  }

  private layerSchema(input: BctVerificationInput): BctLayerResult {
    if (input.state === null || typeof input.state !== "object" || Array.isArray(input.state)) {
      return {
        layer: "schema",
        passed: false,
        message: "State is not an object — it cannot conform to any schema.",
        detail: { requiredKeys: input.requiredKeys ?? [] }
      };
    }
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
    if (typeof input.declaredHash !== "string") {
      return {
        layer: "crypto",
        passed: false,
        message: "Declared hash is missing or not a string.",
        detail: { declaredHash: null }
      };
    }
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
    if (typeof input.braidSignature !== "string" || typeof input.spineSignature !== "string") {
      return {
        layer: "braid",
        passed: false,
        message: "Braid or spine signature is missing or not a string.",
        detail: { braidSignature: typeof input.braidSignature === "string" ? input.braidSignature : null }
      };
    }
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
    const identity = typeof input.identity === "string" ? input.identity : "";
    if (!input.priorStateHash || input.priorStateHash === "GENESIS") {
      // Genesis is NOT free: it requires explicit authorization AND an
      // identity with no registered head. Otherwise anyone could restart
      // a chain and fork history.
      if (input.allowGenesis !== true) {
        return {
          layer: "transaction",
          passed: false,
          message: "Genesis transition requires explicit authorization (allowGenesis) — genesis without it is rejected.",
          detail: { priorStateHash: input.priorStateHash ?? null }
        };
      }
      if (this.registry.has(identity)) {
        return {
          layer: "transaction",
          passed: false,
          message: "Genesis rejected — this identity already has a registered chain head; starting over would fork the chain.",
          detail: { priorStateHash: input.priorStateHash ?? null, registeredHead: this.registry.head(identity) }
        };
      }
      return { layer: "transaction", passed: true, message: "Authorized genesis transaction — no prior hash, no registered head." };
    }
    // The prior hash must itself be a valid sha256 hash. A format check alone
    // never certifies a transition — the rules below must all pass as well.
    const priorWellFormed = typeof input.priorStateHash === "string" && input.priorStateHash.startsWith("sha256:");
    if (!priorWellFormed) {
      return {
        layer: "transaction",
        passed: false,
        message: "Prior state hash is malformed — transaction chain broken.",
        detail: { priorStateHash: input.priorStateHash }
      };
    }
    // ANCHORING (finding 15): the prior must be the REGISTERED head for
    // this identity. Anyone can compute a transition hash from two known
    // hashes, so a matching transition hash proves nothing on its own —
    // the parent must be the head this verifier actually knows. This
    // rejects forged parents, stale (old) parents, and competing
    // branches (a second child of a parent whose head has moved on).
    const registeredHead = this.registry.head(identity);
    if (registeredHead === undefined) {
      return {
        layer: "transaction",
        passed: false,
        message: "Prior state is not a registered chain head for this identity — unanchored parent rejected (register the head first).",
        detail: { priorStateHash: input.priorStateHash }
      };
    }
    if (registeredHead !== input.priorStateHash) {
      return {
        layer: "transaction",
        passed: false,
        message: "Prior state is not the registered chain head — forged, stale, or branching parent rejected.",
        detail: { priorStateHash: input.priorStateHash, registeredHead }
      };
    }
    // A no-op transition (new state hash equals prior state hash) is not a
    // new state and must never be certified as one.
    if (input.declaredHash === input.priorStateHash) {
      return {
        layer: "transaction",
        passed: false,
        message: "No-op transition — new state hash equals prior state hash; not a new state.",
        detail: { priorStateHash: input.priorStateHash, declaredHash: input.declaredHash }
      };
    }
    // The transition itself must be proven: the caller supplies the transition
    // hash chaining the new state's hash to the prior state's hash. A
    // declared hash that is merely well-formed, or a prior hash that merely
    // exists, proves nothing about this transition.
    const expectedTransitionHash = computeTransitionHash(input.declaredHash, input.priorStateHash);
    const chained = input.transitionHash === expectedTransitionHash;
    if (!chained) {
      return {
        layer: "transaction",
        passed: false,
        message: "Transition hash does not bind the new state to the prior state — unchained transition rejected.",
        detail: {
          priorStateHash: input.priorStateHash,
          declaredHash: input.declaredHash,
          expectedTransitionHash
        }
      };
    }
    return {
      layer: "transaction",
      passed: true,
      message: "Transition is chained to the registered prior state and changes state.",
      detail: { priorStateHash: input.priorStateHash, transitionHash: input.transitionHash }
    };
  }

  private layerAudit(input: BctVerificationInput): BctLayerResult {
    const chainValid = this.ledger.verifyChain();
    const latestAuditHash = this.ledger.latestHash();
    // priorAuditHash must exactly match the current ledger head.
    // When the ledger is empty, latestHash() returns "GENESIS".
    const priorHashMatch = typeof input.priorAuditHash === "string" && latestAuditHash === input.priorAuditHash;
    const passed = chainValid && priorHashMatch;
    return {
      layer: "audit",
      passed,
      message: passed
        ? "Audit ledger chain is intact and prior hash matches."
        : "Audit ledger chain is broken or prior hash mismatch.",
      detail: { chainValid, priorAuditHash: typeof input.priorAuditHash === "string" ? input.priorAuditHash : null, latestAuditHash }
    };
  }
}

/** Helper: compute the canonical braid signature for use with BctVerifier. */
export function computeBraidSignature(stateHash: string, spineSignature: string): string {
  return hashOf({ stateHash, spineSignature });
}

/**
 * Helper: compute the canonical transition hash binding a new state's hash
 * to its prior state's hash. A transition is only accepted when the caller
 * supplies this exact value — it is the proof that the new state follows
 * from the declared prior state, not from any other state.
 */
export function computeTransitionHash(stateHash: string, priorStateHash: string): string {
  return hashOf({ stateHash, priorStateHash });
}
