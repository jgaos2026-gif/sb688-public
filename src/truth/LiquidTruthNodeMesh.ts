import type { KeyObject } from "node:crypto";
import type { Result } from "../contracts/result";
import { err, ok } from "../contracts/result";
import type {
  BrainOutput,
  SpinePermit,
  StemPacket,
  TruthFinding,
  TruthReport,
  UserIntent
} from "../contracts/runtime";
import { QuantumDistributionValidator } from "../quantum/QuantumDistributionValidator";
import { hashOf } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { verifySpinePermitSignature } from "./SpinePermitCrypto";
import { PermitReplayStore } from "./PermitReplayStore";

export interface LiquidTruthNodeMeshOptions {
  /**
   * TRUSTED spine public key permits verify against. FAIL CLOSED: when
   * no key is configured, the signature finding FAILS — an unverifiable
   * permit is never trusted on the strength of a hash prefix. The
   * BraidedRuntime wires this from its SpineGovernor by default.
   */
  readonly publicKey?: KeyObject | string;
  /** Clock for expiry checks. Defaults to the system clock. */
  readonly clock?: Clock;
  /**
   * DURABLE replay store path (round 3). When set, used permit
   * signatures are persisted (write + fsync, alongside the ledger
   * persistence) and re-checked from disk, so a previously accepted
   * permit is STILL a replay after a process restart. Without it,
   * replay protection is in-memory only and a restart forgets every
   * used permit — that is the documented default, not a silent
   * guarantee. OPERATOR STEP: pass a path the process may
   * create/write, e.g. `./data/used-permits.jsonl`, next to the
   * ledger file.
   */
  readonly replayStorePath?: string;
  /** How long replay-store writes wait for the single-writer lock. Default 10_000 ms. */
  readonly replayLockTimeoutMs?: number;
  /** Age after which an unparseable replay-store lock file counts as stale. Default 30_000 ms. */
  readonly replayLockStaleMs?: number;
}

export class LiquidTruthNodeMesh {
  private readonly quantum: QuantumDistributionValidator;
  private readonly publicKey?: KeyObject | string;
  private readonly clock: Clock;
  /** Signatures already accepted — a permit may verify exactly once. */
  private readonly seenPermitSignatures = new Set<string>();
  private readonly replayStore?: PermitReplayStore;

  constructor(quantum = new QuantumDistributionValidator(), options: LiquidTruthNodeMeshOptions = {}) {
    this.quantum = quantum;
    this.publicKey = options.publicKey;
    this.clock = options.clock ?? systemClock;
    if (options.replayStorePath) {
      this.replayStore = new PermitReplayStore(options.replayStorePath, {
        lockTimeoutMs: options.replayLockTimeoutMs,
        lockStaleMs: options.replayLockStaleMs
      });
    }
  }

  /** True when this signature was already used (durable store when configured, else in-memory set). */
  private isReplay(signature: string): boolean {
    return this.replayStore ? this.replayStore.has(signature) : this.seenPermitSignatures.has(signature);
  }

  /**
   * Mark a signature used. Durable store: persists first (write +
   * fsync), then memory — returns false when the signature was
   * already recorded (a replay that slipped between the check and
   * the record), and throws when the durable write fails.
   */
  private markPermitUsed(signature: string): boolean {
    if (this.replayStore) return this.replayStore.record(signature);
    if (this.seenPermitSignatures.has(signature)) return false;
    this.seenPermitSignatures.add(signature);
    return true;
  }

  validatePreBrain(intent: UserIntent, permit: SpinePermit): Result<TruthReport> {
    const signatureCheck = this.checkPermitSignature(permit);
    const freshnessCheck = this.checkPermitFreshness(permit);
    const replayCheck =
      typeof permit.signature === "string" && this.isReplay(permit.signature)
        ? { passed: false, message: "Spine permit signature has already been used — replay rejected." }
        : { passed: true, message: "Spine permit has not been seen before." };

    const findings: TruthFinding[] = [
      {
        nodeId: "truth.intent.integrity",
        passed: intent.id === permit.intentId && intent.text.trim().length > 0,
        confidence: 0.99,
        message: "Intent identity and content are intact."
      },
      {
        nodeId: "truth.spine.signature",
        passed: signatureCheck.passed,
        confidence: 0.98,
        message: signatureCheck.message
      },
      {
        nodeId: "truth.spine.freshness",
        passed: freshnessCheck.passed,
        confidence: 0.97,
        message: freshnessCheck.message
      },
      {
        nodeId: "truth.spine.replay",
        passed: replayCheck.passed,
        confidence: 0.97,
        message: replayCheck.message
      },
      {
        nodeId: "truth.constraints.present",
        passed: permit.constraints.includes("brain-adapter-only"),
        confidence: 0.97,
        message: "Brain adapter-only constraint is present before routing."
      }
    ];

    const result = this.report("pre-brain", findings);
    // Only a permit that fully verified is marked seen — a failed
    // attempt must not burn a legitimate permit's one use. The mark
    // itself is DURABLE when a replay store is configured: if the
    // write fails, or another process recorded the signature first,
    // the permit is NOT trusted — its one-time use could not be
    // recorded, so a replay after restart could not be excluded.
    if (result.ok && typeof permit.signature === "string") {
      try {
        const recorded = this.markPermitUsed(permit.signature);
        if (!recorded) {
          return err(
            "REPLAY_REJECTED",
            "truth.pre",
            "Spine permit signature was already used (recorded by another process between the check and the record) — replay rejected.",
            true,
            result.value
          );
        }
      } catch (cause) {
        return err(
          "REPLAY_STORE_FAILED",
          "truth.pre",
          `Spine permit verified, but its one-time use could not be durably recorded (${cause instanceof Error ? cause.message : String(cause)}); refusing to trust it — a replay after restart could not be excluded.`,
          true,
          result.value
        );
      }
    }
    return result;
  }

  /**
   * REAL signature check (finding 02): Ed25519 `crypto.verify` over the
   * canonical permit contents against the trusted public key. The old
   * `sha256:` prefix check is gone — a hash prefix is not a signature
   * and is never accepted as one.
   */
  private checkPermitSignature(permit: SpinePermit): { passed: boolean; message: string } {
    if (permit.approved !== true) {
      return { passed: false, message: "Spine permit is not approved." };
    }
    if (!this.publicKey) {
      return {
        passed: false,
        message: "No trusted spine public key is configured — permit signature cannot be verified (fail closed)."
      };
    }
    if (
      typeof permit.signature !== "string" ||
      typeof permit.issuer !== "string" ||
      typeof permit.issuedAt !== "string" ||
      typeof permit.expiresAt !== "string" ||
      typeof permit.nonce !== "string"
    ) {
      return { passed: false, message: "Spine permit is missing signature fields (signature/issuer/issuedAt/expiresAt/nonce)." };
    }
    const verified = verifySpinePermitSignature(
      {
        intentId: permit.intentId,
        constraints: permit.constraints,
        issuer: permit.issuer,
        issuedAt: permit.issuedAt,
        expiresAt: permit.expiresAt,
        nonce: permit.nonce
      },
      permit.signature,
      this.publicKey
    );
    return { passed: verified.ok, message: verified.reason };
  }

  private checkPermitFreshness(permit: SpinePermit): { passed: boolean; message: string } {
    if (typeof permit.issuedAt !== "string" || typeof permit.expiresAt !== "string") {
      return { passed: false, message: "Spine permit carries no issue/expiry timestamps." };
    }
    const nowMs = Date.parse(this.clock());
    const issuedMs = Date.parse(permit.issuedAt);
    const expiresMs = Date.parse(permit.expiresAt);
    if (Number.isNaN(issuedMs) || Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
      return { passed: false, message: "Spine permit timestamps are unparseable." };
    }
    if (nowMs < issuedMs) {
      return { passed: false, message: "Spine permit is not yet valid (issued in the future)." };
    }
    if (nowMs >= expiresMs) {
      return { passed: false, message: "Spine permit has expired." };
    }
    return { passed: true, message: "Spine permit is within its validity window." };
  }

  validatePostBrain(output: BrainOutput, packet: StemPacket): Result<TruthReport> {
    if (output.probabilisticTrace) {
      const quantumReport = this.quantum.validate(output.probabilisticTrace);
      if (!quantumReport.valid) {
        return err(
          "QUANTUM_INVALID",
          "truth.post",
          "Brain output probabilistic trace failed quantum-ready distribution validation.",
          true,
          quantumReport
        );
      }
    }

    const findings: TruthFinding[] = [
      {
        nodeId: "truth.brain.adapter-only",
        passed: output.adapterOnly === true && output.usedStemSignature === packet.braidSignature,
        confidence: 0.99,
        message: "Brain output is bound to the approved Stem braid."
      },
      {
        nodeId: "truth.output.nonempty",
        passed: output.text.trim().length > 0,
        confidence: 0.98,
        message: "Brain output contains response text."
      },
      {
        nodeId: "truth.no-ruler-override",
        passed: !/(overrode|ignored|bypassed)\s+(spine|stem|truth|ledger)/i.test(output.text),
        confidence: 0.96,
        message: "Brain output does not claim authority over governance modules."
      }
    ];

    return this.report("post-brain", findings);
  }

  validateFailureRecovery(responseText: string): Result<TruthReport> {
    const findings: TruthFinding[] = [
      {
        nodeId: "truth.failure.response.safe",
        passed: responseText.trim().length > 0,
        confidence: 0.96,
        message: "Recovery response is non-empty."
      },
      {
        nodeId: "truth.failure.degraded-honest",
        passed: /degraded|recovered|could not complete/i.test(responseText),
        confidence: 0.93,
        message: "Recovery response communicates degraded execution honestly."
      }
    ];

    return this.report("failure-verify", findings);
  }

  private report(phase: TruthReport["phase"], findings: readonly TruthFinding[]): Result<TruthReport> {
    const verified = findings.every((finding) => finding.passed);
    const confidence = findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length;

    const confidenceDistribution = {
      name: `${phase}.confidence`,
      tolerance: 1e-6,
      points: [
        { label: "verified", probability: confidence },
        { label: "uncertainty", probability: 1 - confidence }
      ]
    };
    const quantumReport = this.quantum.validate(confidenceDistribution);

    if (!quantumReport.valid) {
      return err("QUANTUM_INVALID", phase === "pre-brain" ? "truth.pre" : "truth.post", "Truth confidence distribution is invalid.", true, quantumReport);
    }

    const report: TruthReport = {
      phase,
      verified,
      confidence,
      findings,
      meshSignature: hashOf({ phase, verified, confidence, findings })
    };

    if (!verified) {
      return err(
        "TRUTH_REJECTED",
        phase === "pre-brain" ? "truth.pre" : phase === "post-brain" ? "truth.post" : "failure.verify",
        `Liquid Truth Node Mesh rejected ${phase} state.`,
        true,
        report
      );
    }

    return ok(report);
  }
}
