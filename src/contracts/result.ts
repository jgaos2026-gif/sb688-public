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
  | "failure.checkpoint";

export type RuntimeErrorCode =
  | "SPINE_REJECTED"
  | "TRUTH_REJECTED"
  | "CONSCIOUS_REJECTED"
  | "STEM_REJECTED"
  | "BRAIN_FAILURE"
  | "GHOST_FAILURE"
  | "QUANTUM_INVALID"
  | "LEDGER_APPEND_FAILED"
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
