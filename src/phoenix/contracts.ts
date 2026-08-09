/**
 * Phoenix Recovery — contracts.
 *
 * Phase 2: Phoenix Recovery modular subsystem.
 * Phase 3: Phoenix Patrol continuous-monitoring service.
 */

export type PhoenixRecoveryOp =
  | "checkpoint"
  | "rollback"
  | "selective_repair"
  | "restart"
  | "replay";

export type PhoenixRecoveryStatus =
  | "idle"
  | "checkpointing"
  | "rolling_back"
  | "repairing"
  | "restarting"
  | "replaying"
  | "verified"
  | "failed";

export interface PhoenixSnapshot {
  /** Unique snapshot identifier. */
  readonly id: string;
  /** Sequence number — monotonically increasing. */
  readonly sequence: number;
  /** ISO timestamp when the snapshot was taken. */
  readonly createdAt: string;
  /** Label describing the purpose of this snapshot. */
  readonly label: string;
  /** SHA-256 hash of the captured state. */
  readonly stateHash: string;
  /** Frozen deep-copy of the state payload. */
  readonly state: Readonly<Record<string, unknown>>;
  /** Whether this snapshot has been cryptographically verified. */
  readonly verified: boolean;
  /** Hash of the previous snapshot in the chain (or "GENESIS"). */
  readonly previousHash: string;
  /** Chain hash including this snapshot. */
  readonly chainHash: string;
}

export interface PhoenixJournalEntry {
  readonly id: string;
  readonly sequence: number;
  readonly at: string;
  readonly op: PhoenixRecoveryOp;
  readonly status: PhoenixRecoveryStatus;
  readonly snapshotId?: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
  readonly hash: string;
}

export interface PhoenixMetrics {
  readonly totalCheckpoints: number;
  readonly totalRollbacks: number;
  readonly totalRepairs: number;
  readonly totalRestarts: number;
  readonly totalReplays: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly lastOperationMs: number;
  readonly averageRecoveryMs: number;
  readonly recoverySuccessRate: number;
  readonly determinismScore: number;
}

export interface PhoenixRollbackResult {
  readonly success: boolean;
  readonly targetSnapshotId: string;
  readonly restoredState: Readonly<Record<string, unknown>>;
  readonly snapshotChainValid: boolean;
  readonly journalHash: string;
  readonly elapsedMs: number;
}

export interface PhoenixRepairResult {
  readonly success: boolean;
  readonly repairedKeys: readonly string[];
  readonly skippedKeys: readonly string[];
  readonly stateHash: string;
  readonly elapsedMs: number;
}

export interface PhoenixReplayResult {
  readonly success: boolean;
  readonly stepsReplayed: number;
  readonly finalStateHash: string;
  readonly deterministic: boolean;
  readonly elapsedMs: number;
}

// ─── Patrol contracts ────────────────────────────────────────────────────────

export type PatrolFinding =
  | "healthy"
  | "corruption_detected"
  | "upload_anomaly"
  | "braid_invalid"
  | "integrity_failed"
  | "filesystem_anomaly";

export interface PatrolReport {
  readonly id: string;
  readonly at: string;
  readonly cycle: number;
  readonly findings: readonly PatrolFinding[];
  readonly quarantined: readonly string[];
  readonly anomalies: readonly string[];
  readonly healthy: boolean;
  readonly chainHash: string;
}

export interface PatrolAuditEntry {
  readonly id: string;
  readonly sequence: number;
  readonly at: string;
  readonly cycle: number;
  readonly finding: PatrolFinding;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
  readonly hash: string;
}
