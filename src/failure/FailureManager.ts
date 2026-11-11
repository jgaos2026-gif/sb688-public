import type { AuditLedger } from "../ledger/AuditLedger";
import type { RuntimeError, RuntimeStage } from "../contracts/result";
import type { GhostCheckpoint, RollbackParticipantState, RuntimeResponse, RuntimeSnapshot, UserIntent } from "../contracts/runtime";
import { LiquidTruthNodeMesh } from "../truth/LiquidTruthNodeMesh";
import { GhostNode, responseState } from "../ghost/GhostNode";
import { hashOf } from "../utils/hash";

export interface FailureRecoveryInput {
  readonly traceId: string;
  readonly intent: UserIntent;
  readonly error: RuntimeError;
  readonly currentStage: RuntimeStage;
  readonly lastStableSnapshot: RuntimeSnapshot;
}

/**
 * A mutable component whose state a rollback can actually restore.
 *
 *   captureState() — return a deep copy / immutable snapshot of current state.
 *   restoreState(captured) — replace current state with the capture;
 *     return true only if the restore succeeded.
 *   stateHash() — hash of the component's CURRENT state, so the manager
 *     can verify the restored state matches the captured hash.
 *
 * Boundary (honest, not hidden): only in-process participants registered
 * here are restored. The audit ledger and ghost checkpoints are
 * append-only records — they are NEVER erased or truncated by a rollback;
 * post-snapshot entries stay in the chain and are annotated by the
 * failure entries as superseded work. There are NO external side effects
 * in this runtime's run path (no network, file, email, or payment calls),
 * so there is nothing irreversible to name — if an external effect is
 * ever added, it must be named here as irreversible, never pretended
 * to have rolled back.
 */
export interface RollbackParticipant {
  readonly name: string;
  captureState(): unknown;
  restoreState(captured: unknown): boolean;
  stateHash(): string;
}

export interface FailureManagerOptions {
  readonly rollbackParticipants?: readonly RollbackParticipant[];
}

export interface RollbackCheck {
  readonly name: string;
  readonly restored: boolean;
  readonly hashMatches: boolean;
  readonly reason: string;
}

export class FailureManager {
  private readonly rollbackParticipants: readonly RollbackParticipant[];

  constructor(
    private readonly ledger: AuditLedger,
    private readonly truth: LiquidTruthNodeMesh,
    private readonly ghost: GhostNode,
    private readonly clock: () => string,
    options: FailureManagerOptions = {}
  ) {
    this.rollbackParticipants = options.rollbackParticipants ?? [];
  }

  recover(input: FailureRecoveryInput): RuntimeResponse {
    const { traceId, intent, error, currentStage, lastStableSnapshot } = input;

    this.ledger.append({
      traceId,
      from: currentStage,
      to: "failure.detect",
      status: "failed",
      at: this.clock(),
      detail: { code: error.code, message: error.message }
    });

    this.ledger.append({
      traceId,
      from: "failure.detect",
      to: "failure.isolate",
      status: "started",
      at: this.clock(),
      detail: { isolatedStage: error.stage, recoverable: error.recoverable }
    });

    // ── Finding 04: REAL rollback ──────────────────────────────────────
    // A rollback is demonstrated, not claimed: restore every registered
    // participant from its last-stable capture and verify the restored
    // hash matches the captured hash; verify the rollback point itself
    // (the snapshot's audit hash) is really in the ledger; verify the
    // chain is intact. Any failure makes the rollback unverified.
    const rollback = this.performRollback(lastStableSnapshot);

    this.ledger.append({
      traceId,
      from: "failure.isolate",
      to: "failure.rollback",
      status: "started",
      at: this.clock(),
      detail: { rollbackTo: lastStableSnapshot.stage, rollbackAuditHash: lastStableSnapshot.auditHash }
    });

    this.ledger.append({
      traceId,
      from: "failure.rollback",
      to: "failure.restitch",
      status: rollback.verified ? "recovered" : "failed",
      at: this.clock(),
      detail: {
        mode: "degraded-recovery",
        rollbackVerified: rollback.verified,
        snapshotInChain: rollback.snapshotInChain,
        chainValid: rollback.chainValid,
        participants: rollback.checks,
        // Append-only records are annotated, never erased; no external
        // side effects exist in this run path to roll back.
        irreversibleSideEffects: "none in-process: ledger and ghost checkpoints are append-only and are annotated, not erased; no network/file/email/payment calls occur in the run path"
      }
    });

    const body = [
      "Runtime recovered in degraded mode after a failure loop.",
      `Detected: ${error.code} at ${error.stage}.`,
      rollback.verified
        ? `Rolled back to stable stage: ${lastStableSnapshot.stage} (rollback verified: restored state hashes match the checkpoint).`
        : `Rolled back to stable stage: ${lastStableSnapshot.stage} — ROLLBACK NOT VERIFIED (${rollback.reason}); the failure was isolated but the restored state could not be demonstrated.`,
      "Restitched response: the requested execution could not complete normally, but the failure was isolated, rollback was applied, verification ran, and the ledger was updated."
    ].join("\n");

    const recoveryTruth = this.truth.validateFailureRecovery(body);
    const chainValid = this.ledger.verifyChain();

    // The checkpoint covers the recovery BODY. The verdict line below is
    // appended after checkpointing because it reports the checkpoint
    // check itself; the failure.verify ledger entry is the authoritative
    // record of all four checks, and the failure.checkpoint entry records
    // exactly what the checkpoint covers.
    const bodyResponse: RuntimeResponse = {
      traceId,
      output: body,
      verified: recoveryTruth.ok && rollback.verified && chainValid,
      auditHash: this.ledger.latestHash()
    };
    const checkpoint: GhostCheckpoint = this.ghost.checkpoint({
      traceId,
      intent,
      stage: "failure.checkpoint",
      state: responseState(bodyResponse),
      label: "failure-recovery"
    });
    const checkpointVerified = hashOf(responseState(bodyResponse)) === checkpoint.stateHash;

    // ── Finding 05: ALL FOUR checks, or explicitly unverified ──────────
    const failedChecks: string[] = [];
    if (!recoveryTruth.ok) failedChecks.push("recovery-truth");
    if (!rollback.verified) failedChecks.push("rollback");
    if (!chainValid) failedChecks.push("audit-chain");
    if (!checkpointVerified) failedChecks.push("checkpoint-hash");
    const verified = failedChecks.length === 0;

    const verdict = verified
      ? "Verification verdict: VERIFIED — recovery truth, rollback, audit chain, and checkpoint hash all passed."
      : `Verification verdict: UNVERIFIED degraded response — failed checks: ${failedChecks.join(", ")}. Do not treat this response as verified.`;
    const output = `${body}\n${verdict}`;

    this.ledger.append({
      traceId,
      from: "failure.restitch",
      to: "failure.verify",
      status: verified ? "passed" : "failed",
      at: this.clock(),
      detail: verified
        ? {
            confidence: recoveryTruth.ok ? recoveryTruth.value.confidence : 0,
            meshSignature: recoveryTruth.ok ? recoveryTruth.value.meshSignature : "none",
            recoveryTruthOk: true,
            rollbackVerified: true,
            chainValid: true,
            checkpointVerified: true
          }
        : {
            error: recoveryTruth.ok ? undefined : recoveryTruth.error.message,
            recoveryTruthOk: recoveryTruth.ok,
            rollbackVerified: rollback.verified,
            chainValid,
            checkpointVerified,
            failedChecks
          }
    });

    this.ledger.append({
      traceId,
      from: "failure.verify",
      to: "failure.log",
      status: verified ? "passed" : "failed",
      at: this.clock(),
      detail: { originalError: error.code, chainValid: this.ledger.verifyChain(), rollbackVerified: rollback.verified, checkpointVerified }
    });

    const response: RuntimeResponse = {
      traceId,
      output,
      verified,
      auditHash: this.ledger.latestHash(),
      checkpoint
    };

    this.ledger.append({
      traceId,
      from: "failure.log",
      to: "failure.checkpoint",
      status: "passed",
      at: this.clock(),
      detail: {
        checkpointId: checkpoint.id,
        stateHash: checkpoint.stateHash,
        checkpointVerified,
        covers: "recovery body only (output before the appended verification-verdict line); the verdict line and the full four-check record live in the failure.verify ledger entry",
        coveredAuditHash: bodyResponse.auditHash
      }
    });

    return {
      ...response,
      auditHash: this.ledger.latestHash()
    };
  }

  /**
   * Perform (and verify) the rollback. Returns verified:true only when
   * every check passes: the chain is intact, the snapshot's audit hash
   * is really present in the ledger, and every registered participant
   * restored to a state whose hash matches its capture.
   */
  private performRollback(snapshot: RuntimeSnapshot): {
    readonly verified: boolean;
    readonly reason: string;
    readonly snapshotInChain: boolean;
    readonly chainValid: boolean;
    readonly checks: readonly RollbackCheck[];
  } {
    const chainValid = this.ledger.verifyChain();
    const snapshotInChain =
      snapshot.auditHash === "GENESIS" ||
      this.ledger.entries().some((entry) => entry.hash === snapshot.auditHash);
    const checks: RollbackCheck[] = this.rollbackParticipants.map((participant) => {
      const recorded: RollbackParticipantState | undefined =
        snapshot.participantStates?.[participant.name];
      if (!recorded) {
        return {
          name: participant.name,
          restored: false,
          hashMatches: false,
          reason: "no captured state for this participant at the last stable snapshot — restore cannot be demonstrated"
        };
      }
      let restored = false;
      try {
        restored = participant.restoreState(recorded.captured);
      } catch (cause) {
        return {
          name: participant.name,
          restored: false,
          hashMatches: false,
          reason: `restore threw: ${cause instanceof Error ? cause.message : String(cause)}`
        };
      }
      let hashMatches = false;
      try {
        hashMatches = restored && participant.stateHash() === recorded.hash;
      } catch {
        hashMatches = false;
      }
      return {
        name: participant.name,
        restored,
        hashMatches,
        reason: restored
          ? hashMatches
            ? "restored; state hash matches the captured hash"
            : "restore returned success but the restored state hash does not match the captured hash"
          : "restoreState returned false"
      };
    });

    const reasons: string[] = [];
    if (!chainValid) reasons.push("audit chain is not valid");
    if (!snapshotInChain) reasons.push("snapshot audit hash is not present in the ledger");
    for (const check of checks) {
      if (!check.restored || !check.hashMatches) reasons.push(`${check.name}: ${check.reason}`);
    }
    return {
      verified: reasons.length === 0,
      reason: reasons.length === 0 ? "all rollback checks passed" : reasons.join("; "),
      snapshotInChain,
      chainValid,
      checks
    };
  }
}
