import type { AuditEntry, AuditTransition } from "../contracts/audit";
import { hashOf } from "../utils/hash";

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
}
