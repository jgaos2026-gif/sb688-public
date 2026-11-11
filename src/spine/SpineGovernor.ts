import { createPrivateKey, createPublicKey, randomBytes, type KeyObject } from "node:crypto";
import type { Result } from "../contracts/result";
import { err, ok } from "../contracts/result";
import type { SpinePermit, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { generateSpineKeyPair, signSpinePermit, exportSpinePublicKeyPem } from "../truth/SpinePermitCrypto";

export interface SpineRule {
  readonly id: string;
  readonly description: string;
  readonly validate: (intent: UserIntent) => boolean;
}

export interface SpineGovernorOptions {
  /**
   * Ed25519 private key used to sign permits. When omitted, an
   * ephemeral pair is generated per governor — permits verify within
   * this process only. For durable permits, pass the operator's key
   * (see SpinePermitCrypto.loadSpineKeysFromEnv) — never commit it.
   */
  readonly signingKey?: KeyObject | string;
  /** Issuer identifier recorded on every permit. Defaults to "spine". */
  readonly issuer?: string;
  /** Clock for issuedAt/expiresAt. Defaults to the system clock. */
  readonly clock?: Clock;
  /** Permit lifetime in milliseconds. Defaults to 5 minutes. */
  readonly permitTtlMs?: number;
}

export const DEFAULT_PERMIT_TTL_MS = 5 * 60 * 1000;

export class SpineGovernor {
  private readonly rules: readonly SpineRule[];
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly issuer: string;
  private readonly clock: Clock;
  private readonly permitTtlMs: number;

  constructor(rules: readonly SpineRule[] = defaultSpineRules, options: SpineGovernorOptions = {}) {
    this.rules = rules;
    if (options.signingKey) {
      this.privateKey = typeof options.signingKey === "string"
        ? createPrivateKey(options.signingKey)
        : options.signingKey;
      this.publicKey = createPublicKey(this.privateKey);
    } else {
      const pair = generateSpineKeyPair();
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
    }
    this.issuer = options.issuer ?? "spine";
    this.clock = options.clock ?? systemClock;
    this.permitTtlMs = options.permitTtlMs ?? DEFAULT_PERMIT_TTL_MS;
  }

  /** The public key this governor's permits verify against. */
  get spinePublicKey(): KeyObject {
    return this.publicKey;
  }

  /** The public key as PEM — hand this to verifiers, never the private key. */
  get spinePublicKeyPem(): string {
    return exportSpinePublicKeyPem(this.publicKey);
  }

  govern(intent: UserIntent): Result<SpinePermit> {
    const failed = this.rules.filter((rule) => !rule.validate(intent));

    if (failed.length > 0) {
      return err(
        "SPINE_REJECTED",
        "spine",
        `Spine rejected intent: ${failed.map((rule) => rule.id).join(", ")}`,
        true,
        { failedRules: failed.map((rule) => rule.description) }
      );
    }

    const constraints = [
      "spine-governance-required",
      "brain-adapter-only",
      "post-brain-truth-verification-required",
      "append-only-ledger-required"
    ] as const;

    const issuedAt = this.clock();
    const expiresAt = new Date(Date.parse(issuedAt) + this.permitTtlMs).toISOString();
    const nonce = randomBytes(16).toString("hex");
    const payload = { intentId: intent.id, constraints, issuer: this.issuer, issuedAt, expiresAt, nonce };
    const signature = signSpinePermit(payload, this.privateKey);

    return ok({
      intentId: intent.id,
      approved: true,
      constraints,
      // Content binding hash — deterministic, kept for compatibility.
      // It is NOT a signature and proves nothing about the issuer.
      spineSignature: hashOf({ intent, constraints, ruleIds: this.rules.map((rule) => rule.id) }),
      signature,
      issuer: this.issuer,
      issuedAt,
      expiresAt,
      nonce
    });
  }
}

export const defaultSpineRules: readonly SpineRule[] = [
  {
    id: "intent-not-empty",
    description: "User intent must contain non-empty text.",
    validate: (intent) => intent.text.trim().length > 0
  },
  {
    id: "intent-max-length",
    description: "User intent must fit within bounded runtime context.",
    validate: (intent) => intent.text.length <= 12_000
  },
  {
    id: "no-governance-bypass",
    description: "Intent must not request bypassing the spine, ledger, or verification mesh.",
    validate: (intent) => !/bypass\s+(spine|ledger|truth|governance|verification)/i.test(intent.text)
  }
];
