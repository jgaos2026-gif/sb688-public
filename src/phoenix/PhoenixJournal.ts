import { hashOf, makeId } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import type { PhoenixJournalEntry, PhoenixRecoveryOp, PhoenixRecoveryStatus } from "./contracts";

/**
 * PhoenixJournal — tamper-evident, append-only recovery operation journal.
 *
 * Every recovery operation is recorded here with a hash chain so that
 * the full history can be replayed and verified deterministically.
 */
export class PhoenixJournal {
  private readonly entries: PhoenixJournalEntry[] = [];
  private previousHash = "GENESIS";

  constructor(private readonly clock: Clock = systemClock) {}

  record(
    op: PhoenixRecoveryOp,
    status: PhoenixRecoveryStatus,
    detail: Readonly<Record<string, unknown>>,
    snapshotId?: string
  ): PhoenixJournalEntry {
    const sequence = this.entries.length + 1;
    const at = this.clock();
    const id = makeId("journal", { sequence, op, status, at });
    const core = { id, sequence, at, op, status, snapshotId, detail, previousHash: this.previousHash };
    const hash = hashOf(core);
    const entry: PhoenixJournalEntry = Object.freeze({ ...core, hash });
    this.entries.push(entry);
    this.previousHash = hash;
    return entry;
  }

  all(): readonly PhoenixJournalEntry[] {
    return this.entries.map((e) => Object.freeze({ ...e }));
  }

  latestHash(): string {
    return this.previousHash;
  }

  /** Verify the entire journal hash chain. */
  verify(): boolean {
    let prev = "GENESIS";
    for (const entry of this.entries) {
      const { hash, ...rest } = entry;
      const expected = hashOf({ ...rest });
      if (rest.previousHash !== prev || hash !== expected) return false;
      prev = hash;
    }
    return true;
  }
}
