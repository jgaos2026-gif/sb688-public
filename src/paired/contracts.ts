/**
 * Paired Node System — contracts.
 *
 * Phase 5: Master / Witness independent verification with quorum rules,
 * signed checkpoints, disagreement detection, and immutable audit trail.
 *
 * The Witness must never automatically trust the Master.
 */

export type PairedNodeRole = "master" | "witness";

export type PairedNodeDecision = "agree" | "disagree" | "abstain";

export interface SignedCheckpoint {
  /** Unique checkpoint identifier. */
  readonly id: string;
  /** Which node produced this checkpoint. */
  readonly role: PairedNodeRole;
  /** Sequence number. */
  readonly sequence: number;
  /** ISO timestamp. */
  readonly at: string;
  /** Hash of the state captured. */
  readonly stateHash: string;
  /** Node-specific HMAC-style signature over (id + stateHash + sequence). */
  readonly signature: string;
}

export interface QuorumResult {
  /** Whether quorum was reached. */
  readonly agreed: boolean;
  /** Master's checkpoint. */
  readonly masterCheckpoint: SignedCheckpoint;
  /** Witness's checkpoint. */
  readonly witnessCheckpoint: SignedCheckpoint;
  /** The decision rendered. */
  readonly decision: PairedNodeDecision;
  /** Hash of disagreement detail (if any). */
  readonly disagreementHash: string | null;
  /** Immutable audit entry hash. */
  readonly auditHash: string;
}

export interface PairedAuditEntry {
  readonly id: string;
  readonly sequence: number;
  readonly at: string;
  readonly decision: PairedNodeDecision;
  readonly masterStateHash: string;
  readonly witnessStateHash: string;
  readonly authorizedBy: "quorum" | "none";
  readonly previousHash: string;
  readonly hash: string;
}
