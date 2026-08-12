import type { AuditEntry, AuditTransition } from "../contracts/audit";
import { hashOf } from "../utils/hash";
import { createHash } from "node:crypto";

export interface LedgerAnchor {
  /** Total number of records in the ledger at the time of anchoring. */
  readonly recordCount: number;
  /** Hash of the most-recent record. "GENESIS" when empty. */
  readonly headHash: string;
  /** sha256 hex of the canonical JSON-Lines serialization of all records. */
  readonly wholeFileDigest: string;
  /** ISO timestamp of anchor creation. */
  readonly anchoredAt: string;
}

export class AuditLedger {
  private readonly store: AuditEntry[] = [];

  append(transition: AuditTransition): AuditEntry {
    const previousHash = this.latestHash();
    const entry: AuditEntry = Object.freeze({
      ...transition,
      sequence: this.store.length + 1,
      previousHash,
      hash: hashOf({ sequence: this.store.length + 1, previousHash, transition })
    });

    this.store.push(entry);
    return entry;
  }

  entries(): readonly AuditEntry[] {
    return this.store.map((entry) => Object.freeze({ ...entry }));
  }

  entriesJsonLines(): string {
    return this.store.map((entry) => JSON.stringify(entry)).join("\n");
  }

  latestHash(): string {
    return this.store.length === 0 ? "GENESIS" : this.store[this.store.length - 1].hash;
  }

  verifyChain(): boolean {
    let previousHash = "GENESIS";

    for (const entry of this.store) {
      const { sequence, hash, previousHash: recordedPreviousHash, ...transition } = entry;
      const expected = hashOf({ sequence, previousHash, transition });

      if (recordedPreviousHash !== previousHash || hash !== expected) {
        return false;
      }

      previousHash = hash;
    }

    return true;
  }

  /**
   * Compute an integrity anchor for the current ledger state.
   * Contains: record count, head hash, and a sha256 digest of the
   * canonical JSON-Lines serialization of all records.
   */
  computeAnchor(clock: () => string = () => new Date().toISOString()): LedgerAnchor {
    const jsonLines = this.entriesJsonLines();
    const wholeFileDigest = createHash("sha256").update(jsonLines).digest("hex");
    return Object.freeze({
      recordCount: this.store.length,
      headHash: this.latestHash(),
      wholeFileDigest,
      anchoredAt: clock(),
    });
  }

  /**
   * Verify that a previously-computed anchor still matches the current
   * ledger state. Returns false if any field differs.
   */
  verifyAnchor(anchor: LedgerAnchor): boolean {
    const current = this.computeAnchor(() => anchor.anchoredAt);
    return (
      current.recordCount === anchor.recordCount &&
      current.headHash === anchor.headHash &&
      current.wholeFileDigest === anchor.wholeFileDigest
    );
  }
}
