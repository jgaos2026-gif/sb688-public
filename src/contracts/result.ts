export type Result<T, E = RuntimeError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type RuntimeStage =
  | "intent"
  | "spine"
  | "truth.pre"
  | "conscious-brick"
  | "stem"
  | "brain"
  | "truth.post"
  | "ghost-node"
  | "ledger"
  | "response"
  | "failure.detect"
  | "failure.isolate"
  | "failure.rollback"
  | "failure.restitch"
  | "failure.verify"
  | "failure.log"
  | "failure.checkpoint"
  // Phoenix Recovery stages
  | "phoenix.checkpoint"
  | "phoenix.rollback"
  | "phoenix.repair"
  | "phoenix.restart"
  | "phoenix.replay"
  | "phoenix.validate"
  | "phoenix.journal"
  // Phoenix Patrol stages
  | "patrol.health"
  | "patrol.corruption"
  | "patrol.upload"
  | "patrol.braid"
  | "patrol.quarantine"
  | "patrol.anomaly"
  // Triad Recovery stages
  | "triad.hunt"
  | "triad.warrior"
  | "triad.repair"
  | "triad.spine"
  // Paired Node stages
  | "paired.master"
  | "paired.witness"
  | "paired.quorum"
  | "paired.disagree"
  | "paired.checkpoint"
  // BCT Verification stages
  | "bct.identity"
  | "bct.schema"
  | "bct.crypto"
  | "bct.braid"
  | "bct.transaction"
  | "bct.audit";

export type RuntimeErrorCode =
  | "SPINE_REJECTED"
  | "TRUTH_REJECTED"
  | "CONSCIOUS_REJECTED"
  | "STEM_REJECTED"
  | "BRAIN_FAILURE"
  | "GHOST_FAILURE"
  | "QUANTUM_INVALID"
  | "LEDGER_APPEND_FAILED"
  | "PHOENIX_CHECKPOINT_FAILED"
  | "PHOENIX_ROLLBACK_FAILED"
  | "PHOENIX_REPAIR_FAILED"
  | "TRIAD_HUNT_FAILED"
  | "TRIAD_WARRIOR_FAILED"
  | "TRIAD_REPAIR_FAILED"
  | "PAIRED_DISAGREEMENT"
  | "PAIRED_QUORUM_FAILED"
  | "BCT_IDENTITY_FAILED"
  | "BCT_SCHEMA_FAILED"
  | "BCT_CRYPTO_FAILED"
  | "BCT_BRAID_FAILED"
  | "BCT_TRANSACTION_FAILED"
  | "BCT_AUDIT_FAILED"
  | "UNKNOWN";

export interface RuntimeError {
  readonly code: RuntimeErrorCode;
  readonly stage: RuntimeStage;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (
  code: RuntimeErrorCode,
  stage: RuntimeStage,
  message: string,
  recoverable = true,
  cause?: unknown
): Result<never> => ({
  ok: false,
  error: { code, stage, message, recoverable, cause }
});
