import { hashOf, isWellFormedHash } from "../utils/hash";
import type { AuditLedger } from "../ledger/AuditLedger";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { verifyHeadAgainstLedger, type EvidenceLedgerReader } from "./EvidenceLedgerCrossCheck";

/**
 * BCT Verifier — Phase 6 Braided Computational Topology verification layers.
 *
 * Every state transition passes SIX verification layers in order:
 *
 *   1. Identity verification   — subject has a valid, non-empty identity
 *   2. Schema verification     — state conforms to required structure
 *   3. Cryptographic verification — hash integrity matches declared hash
 *   4. Braid verification      — an unkeyed SHA-256 BINDING hash ties the
 *      state to the governance chain. It is a binding, not a signature:
 *      anyone who knows the values can compute it, so it proves the
 *      values match and authenticates NOBODY. It is named
 *      `braidBindingHash` everywhere for exactly that reason (finding F).
 *      Where issuer authentication is actually required, the permit
 *      layer uses real Ed25519 signatures (SpinePermitCrypto) — there
 *      is no such place in this file, so the rename alone is the fix.
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
 *
 * FINDING D — trust is conditional on the durable audit commit: the
 * registered head advances ONLY after the ledger append for the
 * verification succeeds. If the append fails, the result is
 * trusted:false (the audit layer is marked failed) and the head does
 * not move — a transition that was never durably recorded must never
 * be trusted or become the next transition's parent.
 *
 * FINDING H — head anchoring still depends on operator-controlled
 * state (the registry). When an evidence-ledger reader is supplied
 * (4th constructor argument), the audit layer additionally requires
 * the durable evidence ledger to agree with the local head — see
 * src/truth/EvidenceLedgerCrossCheck.ts and
 * docs/EVIDENCE_LEDGER_CROSS_CHECK.md. Without a reader, behaviour
 * is unchanged.
 */

export interface BctVerificationInput {
  /** Identity of the subject (e.g. intentId, nodeId, snapshotId). */
  readonly identity: string;
  /** The state payload to verify. */
  readonly state: Readonly<Record<string, unknown>>;
  /** The expected/declared hash of the state (from a trusted source). */
  readonly declaredHash: string;
  /**
   * The braid BINDING hash that ties this state to the governance
   * chain, computed as hashOf({ stateHash: declaredHash,
   * spineSignature }). It is an UNKEYED SHA-256 hash, not a
   * signature: anyone knowing the values can compute it, so it
   * proves the values match and authenticates nobody. It is named
   * `braidBindingHash` (not `braidSignature`) so no reader mistakes
   * it for authentication. Where issuer authentication is required,
   * use the Ed25519 permit signature (SpinePermitCrypto), not this.
   */
  readonly braidBindingHash: string;
  /** The governance chain value (content binding) that authorized this state. */
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
   *
   * VALIDATION (round 3): the identity must be a non-empty string and
   * the hash must be well-formed (`sha256:` + 64 lowercase hex chars).
   * Anything else throws a structured REGISTRY_REJECTED error instead
   * of silently recording an unusable head.
   */
  register(identity: string, stateHash: string): void {
    if (typeof identity !== "string" || identity.trim().length === 0) {
      throw new Error("REGISTRY_REJECTED: identity must be a non-empty string.");
    }
    if (!isWellFormedHash(stateHash)) {
      throw new Error(
        `REGISTRY_REJECTED: state hash must be a well-formed 'sha256:' + 64 lowercase hex chars; got ${JSON.stringify(stateHash)}.`
      );
    }
    this.heads.set(identity, stateHash);
  }

  /** Atomically register a genesis head only when no head exists. */
  registerIfAbsent(identity: string, stateHash: string): boolean {
    if (typeof identity !== "string" || identity.trim().length === 0) {
      throw new Error("REGISTRY_REJECTED: identity must be a non-empty string.");
    }
    if (!isWellFormedHash(stateHash)) {
      throw new Error("REGISTRY_REJECTED: genesis head hash is malformed.");
    }
    if (this.heads.has(identity)) return false;
    this.heads.set(identity, stateHash);
    return true;
  }

  /**
   * Advance the head after a trusted transition. Returns false (and
   * changes nothing) unless the recorded head equals the expected prior
   * — so a competing branch can never silently overwrite the head.
   * A malformed new hash throws REGISTRY_REJECTED (same validation as
   * register()).
   */
  advance(identity: string, expectedPrior: string, newHash: string): boolean {
    if (!isWellFormedHash(newHash)) {
      throw new Error(
        `REGISTRY_REJECTED: new head hash must be a well-formed 'sha256:' + 64 lowercase hex chars; got ${JSON.stringify(newHash)}.`
      );
    }
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
  private readonly evidenceLedger?: EvidenceLedgerReader;

  /**
   * @param evidenceLedger — optional evidence-ledger reader (finding H).
   *   When set, the audit layer additionally requires the durable
   *   evidence ledger to agree with the local head. See
   *   src/truth/EvidenceLedgerCrossCheck.ts. Default: none (behaviour
   *   unchanged).
   */
  constructor(
    ledger: AuditLedger,
    clock: Clock = systemClock,
    registry: BctHeadRegistry = new BctHeadRegistry(),
    evidenceLedger?: EvidenceLedgerReader
  ) {
    this.ledger = ledger;
    this.clock = clock;
    this.registry = registry;
    this.evidenceLedger = evidenceLedger;
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

    let failedLayers = layers.filter((l) => !l.passed).map((l) => l.layer);
    let trusted = failedLayers.length === 0;
    let finalHash = hashOf({
      input: { identity: typeof input.identity === "string" ? input.identity : null, declaredHash: typeof input.declaredHash === "string" ? input.declaredHash : null },
      layers
    });

    // FINDING D — the audit commit is part of trust, and it happens
    // BEFORE the head advances. The ledger entry is appended with the
    // layers' verdict; only if that append succeeds may a trusted
    // transition advance the registry. If the append fails, the
    // transition is NOT trusted (the audit layer is marked failed so
    // failedLayers says so) and the head does not move — a transition
    // that was never durably recorded must never become the next
    // transition's parent.
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
      if (trusted) {
        trusted = false;
        layers[5] = {
          layer: "audit",
          passed: false,
          message: "Audit ledger append failed — the verification was not durably recorded, so the transition is not trusted and the chain head does not advance.",
          detail: { chainValid: layers[5].detail?.chainValid, priorAuditHash: typeof input.priorAuditHash === "string" ? input.priorAuditHash : null, latestAuditHash: this.ledger.latestHash() }
        };
        failedLayers = layers.filter((l) => !l.passed).map((l) => l.layer);
        finalHash = hashOf({
          input: { identity: typeof input.identity === "string" ? input.identity : null, declaredHash: typeof input.declaredHash === "string" ? input.declaredHash : null },
          layers
        });
      }
    }

    // On a trusted transition the registered head advances to the new
    // state — the next transition must chain from THIS state, so an old
    // parent or a competing branch is rejected from here on. This runs
    // ONLY after the audit commit above succeeded (finding D).
    if (trusted && typeof input.identity === "string" && typeof input.declaredHash === "string") {
      const committed = input.priorStateHash === undefined || input.priorStateHash === "GENESIS"
        ? this.registry.registerIfAbsent(input.identity, input.declaredHash)
        : this.registry.advance(input.identity, input.priorStateHash, input.declaredHash);
      if (!committed) {
        // Never return trusted when the authoritative head did not move.
        // This should be unreachable for the built-in synchronous registry,
        // but injected/shared registries must obey the same compare-and-set.
        trusted = false;
        layers[4] = {
          layer: "transaction",
          passed: false,
          message: "Authoritative chain-head compare-and-set failed — transition was not committed.",
          detail: {
            identity: input.identity,
            expectedPrior: input.priorStateHash ?? "GENESIS",
            registeredHead: this.registry.head(input.identity)
          }
        };
        failedLayers = layers.filter((l) => !l.passed).map((l) => l.layer);
        finalHash = hashOf({
          input: { identity: input.identity, declaredHash: input.declaredHash },
          layers
        });
        try {
          this.ledger.append({
            traceId: `bct:${input.identity}`,
            from: "bct.registry",
            to: "bct.identity",
            status: "failed",
            at,
            detail: { trusted: false, failedLayers, finalHash,
                      reason: "chain-head compare-and-set failed" }
          });
        } catch {
          ledgerAppendFailed = true;
        }
      }
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
    // Object.hasOwn, not `in`: `in` accepts INHERITED properties, so a
    // state created via Object.create({ key }) would pass a schema
    // check for a key it does not own. A required key must be the
    // state's own property.
    const missing = required.filter((k) => !Object.hasOwn(input.state, k));
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
    if (typeof input.braidBindingHash !== "string" || typeof input.spineSignature !== "string") {
      return {
        layer: "braid",
        passed: false,
        message: "Braid binding hash or spine value is missing or not a string.",
        detail: { braidBindingHash: typeof input.braidBindingHash === "string" ? input.braidBindingHash : null }
      };
    }
    // Braid binding hash must start with sha256: and bind the state hash and spine.
    const wellFormed = input.braidBindingHash.startsWith("sha256:");
    // Verify the braid binding hash encodes the state hash deterministically.
    // The canonical braid binding hash must equal hashOf({ state, spine }).
    // It is an UNKEYED hash — it proves the values match; it does NOT
    // authenticate the issuer. Never call it a signature.
    const canonical = hashOf({ stateHash: input.declaredHash, spineSignature: input.spineSignature });
    const passed = wellFormed && input.braidBindingHash === canonical;
    return {
      layer: "braid",
      passed,
      message: passed
        ? "Braid binding hash ties state to governance chain (unkeyed binding — proves the values match, authenticates nobody)."
        : "Braid binding hash is invalid or does not bind this state.",
      detail: { braidBindingHash: input.braidBindingHash, canonical, wellFormed }
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

    // FINDING H — evidence-ledger cross-check (only when a reader is
    // configured). The local head must agree with the durable
    // evidence ledger, or the transition is not trusted:
    //   - chained transition: the ledger's head must EQUAL the prior
    //     head (a stale local head or a fork is rejected);
    //   - genesis transition: the ledger must have NO record for the
    //     identity (an identity with a durable head can never start
    //     over).
    let crossCheckPassed = true;
    let crossCheckMessage = "No evidence-ledger reader configured — cross-check skipped (local anchoring only).";
    let crossCheckOutcome: string | undefined;
    if (this.evidenceLedger && typeof input.identity === "string" && input.identity) {
      const priorHead = !input.priorStateHash || input.priorStateHash === "GENESIS" ? "GENESIS" : input.priorStateHash;
      const check = verifyHeadAgainstLedger(input.identity, priorHead, this.evidenceLedger);
      crossCheckOutcome = check.outcome;
      if (priorHead === "GENESIS") {
        crossCheckPassed = check.outcome === "NO_LEDGER_RECORD";
        crossCheckMessage = crossCheckPassed
          ? "Evidence ledger has no prior head for this identity — genesis is consistent with the durable record."
          : `Evidence ledger already records a head for this identity (${check.ledgerHead}) — genesis would fork the durable chain.`;
      } else {
        crossCheckPassed = check.outcome === "MATCH";
        crossCheckMessage = crossCheckPassed
          ? "Local head matches the head recorded in the evidence ledger."
          : check.reason;
      }
    }

    const passed = chainValid && priorHashMatch && crossCheckPassed;
    return {
      layer: "audit",
      passed,
      message: passed
        ? "Audit ledger chain is intact, prior hash matches, and the evidence-ledger cross-check passed."
        : `Audit ledger chain is broken, prior hash mismatch, or evidence-ledger cross-check failed. ${crossCheckMessage}`,
      detail: {
        chainValid,
        priorAuditHash: typeof input.priorAuditHash === "string" ? input.priorAuditHash : null,
        latestAuditHash,
        ...(crossCheckOutcome ? { crossCheckOutcome, crossCheckMessage } : {})
      }
    };
  }
}

/**
 * Helper: compute the canonical braid BINDING hash for use with
 * BctVerifier. It is an unkeyed SHA-256 hash of { stateHash,
 * spineSignature } — it binds the values together and authenticates
 * nobody. Do not call it a signature.
 */
export function computeBraidBindingHash(stateHash: string, spineSignature: string): string {
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
