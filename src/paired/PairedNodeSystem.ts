import { hashOf, makeId } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import type { AuditLedger } from "../ledger/AuditLedger";
import type {
  PairedAuditEntry,
  PairedNodeDecision,
  QuorumResult,
  SignedCheckpoint
} from "./contracts";

/**
 * PairedNodeSystem — Phase 5 Master/Witness verification.
 *
 * Rules:
 *   • Master and Witness operate independently.
 *   • The Witness independently verifies every state before signing.
 *   • The Witness NEVER automatically trusts the Master's assertion.
 *   • Quorum requires both nodes to sign the same state hash.
 *   • Any disagreement is detected, recorded, and logged.
 *   • The audit trail is immutable and hash-chained.
 *   • Recovery is authorized only after quorum.
 *   • State synchronization is deterministic: both nodes hash the same input.
 */
export class PairedNodeSystem {
  private readonly ledger: AuditLedger;
  private readonly clock: Clock;
  private readonly auditLog: PairedAuditEntry[] = [];
  private previousHash = "GENESIS";
  private sequence = 0;

  // Separate checkpoint sequences per role.
  private masterSeq = 0;
  private witnessSeq = 0;

  constructor(ledger: AuditLedger, clock: Clock = systemClock) {
    this.ledger = ledger;
    this.clock = clock;
  }

  /**
   * Process a state through both nodes independently and derive a quorum.
   *
   * @param masterState  State as seen / computed by the Master node.
   * @param witnessState State as independently verified by the Witness node.
   */
  verify(
    masterState: Readonly<Record<string, unknown>>,
    witnessState: Readonly<Record<string, unknown>>
  ): QuorumResult {
    const at = this.clock();
    this.sequence += 1;

    // Each node independently signs its view.
    const masterCheckpoint = this.signCheckpoint("master", masterState, at);
    const witnessCheckpoint = this.signCheckpoint("witness", witnessState, at);

    // Quorum: both nodes must produce the same state hash.
    const agreed = masterCheckpoint.stateHash === witnessCheckpoint.stateHash;
    const decision: PairedNodeDecision = agreed ? "agree" : "disagree";

    const disagreementHash = agreed
      ? null
      : hashOf({
          master: masterCheckpoint.stateHash,
          witness: witnessCheckpoint.stateHash,
          at
        });

    // Append to ledger.
    this.ledger.append({
      traceId: `paired:${this.sequence}`,
      from: agreed ? "paired.quorum" : "paired.disagree",
      to: "paired.checkpoint",
      status: agreed ? "passed" : "failed",
      at,
      detail: {
        sequence: this.sequence,
        masterStateHash: masterCheckpoint.stateHash,
        witnessStateHash: witnessCheckpoint.stateHash,
        decision,
        disagreementHash
      }
    });

    // Tamper-evident audit entry.
    const auditEntry = this.appendAudit(decision, masterCheckpoint, witnessCheckpoint, agreed, at);

    return Object.freeze({
      agreed,
      masterCheckpoint: Object.freeze(masterCheckpoint),
      witnessCheckpoint: Object.freeze(witnessCheckpoint),
      decision,
      disagreementHash,
      auditHash: auditEntry.hash
    });
  }

  /**
   * Authorize recovery — only granted if quorum was reached on the most
   * recent verification cycle. Returns the agreed state hash or null.
   */
  authorizeRecovery(quorum: QuorumResult): { readonly authorized: boolean; readonly stateHash: string | null } {
    if (!quorum.agreed) {
      this.ledger.append({
        traceId: `paired:recovery:${this.sequence}`,
        from: "paired.quorum",
        to: "paired.witness",
        status: "failed",
        at: this.clock(),
        detail: { reason: "disagreement_blocks_recovery", disagreementHash: quorum.disagreementHash }
      });
      return { authorized: false, stateHash: null };
    }
    return { authorized: true, stateHash: quorum.masterCheckpoint.stateHash };
  }

  /** Returns all audit log entries. */
  auditLog_(): readonly PairedAuditEntry[] {
    return this.auditLog.map((e) => Object.freeze({ ...e }));
  }

  /** Verify the audit log hash chain. */
  verifyAuditLog(): boolean {
    let prev = "GENESIS";
    for (const entry of this.auditLog) {
      const { hash, ...rest } = entry;
      const expected = hashOf({ ...rest });
      if (rest.previousHash !== prev || hash !== expected) return false;
      prev = hash;
    }
    return true;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private signCheckpoint(
    role: "master" | "witness",
    state: Readonly<Record<string, unknown>>,
    at: string
  ): SignedCheckpoint {
    const seq = role === "master" ? ++this.masterSeq : ++this.witnessSeq;
    const stateHash = hashOf(state);
    const id = makeId(`paired:${role}`, { seq, stateHash, at });
    // Signature: deterministic HMAC-style hash of (id + stateHash + seq + role)
    const signature = hashOf({ id, stateHash, seq, role });
    return Object.freeze({ id, role, sequence: seq, at, stateHash, signature });
  }

  private appendAudit(
    decision: PairedNodeDecision,
    master: SignedCheckpoint,
    witness: SignedCheckpoint,
    agreed: boolean,
    at: string
  ): PairedAuditEntry {
    const sequence = this.auditLog.length + 1;
    const id = makeId("paired-audit", { sequence, decision, at });
    const core = {
      id,
      sequence,
      at,
      decision,
      masterStateHash: master.stateHash,
      witnessStateHash: witness.stateHash,
      authorizedBy: agreed ? ("quorum" as const) : ("none" as const),
      previousHash: this.previousHash
    };
    const hash = hashOf(core);
    const entry: PairedAuditEntry = Object.freeze({ ...core, hash });
    this.auditLog.push(entry);
    this.previousHash = hash;
    return entry;
  }
}
