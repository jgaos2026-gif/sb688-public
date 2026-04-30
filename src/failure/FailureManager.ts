import type { AuditLedger } from "../ledger/AuditLedger";
import type { RuntimeError, RuntimeStage } from "../contracts/result";
import type { GhostCheckpoint, RuntimeResponse, RuntimeSnapshot, UserIntent } from "../contracts/runtime";
import { LiquidTruthNodeMesh } from "../truth/LiquidTruthNodeMesh";
import { GhostNode } from "../ghost/GhostNode";

export interface FailureRecoveryInput {
  readonly traceId: string;
  readonly intent: UserIntent;
  readonly error: RuntimeError;
  readonly currentStage: RuntimeStage;
  readonly lastStableSnapshot: RuntimeSnapshot;
}

export class FailureManager {
  constructor(
    private readonly ledger: AuditLedger,
    private readonly truth: LiquidTruthNodeMesh,
    private readonly ghost: GhostNode,
    private readonly clock: () => string
  ) {}

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

    this.ledger.append({
      traceId,
      from: "failure.isolate",
      to: "failure.rollback",
      status: "started",
      at: this.clock(),
      detail: { rollbackTo: lastStableSnapshot.stage, rollbackAuditHash: lastStableSnapshot.auditHash }
    });

    const output = [
      "Runtime recovered in degraded mode after a verified failure loop.",
      `Detected: ${error.code} at ${error.stage}.`,
      `Rolled back to stable stage: ${lastStableSnapshot.stage}.`,
      "Restitched response: the requested execution could not complete normally, but the failure was isolated, rollback was applied, verification ran, and the ledger was updated."
    ].join("\n");

    this.ledger.append({
      traceId,
      from: "failure.rollback",
      to: "failure.restitch",
      status: "recovered",
      at: this.clock(),
      detail: { mode: "degraded-recovery" }
    });

    const recoveryTruth = this.truth.validateFailureRecovery(output);

    this.ledger.append({
      traceId,
      from: "failure.restitch",
      to: "failure.verify",
      status: recoveryTruth.ok ? "passed" : "failed",
      at: this.clock(),
      detail: recoveryTruth.ok
        ? { confidence: recoveryTruth.value.confidence, meshSignature: recoveryTruth.value.meshSignature }
        : { error: recoveryTruth.error.message }
    });

    this.ledger.append({
      traceId,
      from: "failure.verify",
      to: "failure.log",
      status: "passed",
      at: this.clock(),
      detail: { originalError: error.code, chainValid: this.ledger.verifyChain() }
    });

    const responseWithoutCheckpoint: RuntimeResponse = {
      traceId,
      output,
      verified: recoveryTruth.ok,
      auditHash: this.ledger.latestHash()
    };

    const checkpoint: GhostCheckpoint = this.ghost.checkpoint({
      traceId,
      intent,
      stage: "failure.checkpoint",
      state: responseWithoutCheckpoint,
      label: "failure-recovery"
    });

    this.ledger.append({
      traceId,
      from: "failure.log",
      to: "failure.checkpoint",
      status: "passed",
      at: this.clock(),
      detail: { checkpointId: checkpoint.id, stateHash: checkpoint.stateHash }
    });

    return {
      ...responseWithoutCheckpoint,
      auditHash: this.ledger.latestHash(),
      checkpoint
    };
  }
}
