import * as fs from "node:fs";
import * as path from "node:path";
import type { AuditEntry, AuditTransition } from "../contracts/audit";
import { hashOf } from "../utils/hash";
import { deepCloneValue, deepFreezeValue } from "../utils/deep";

export interface AuditLedgerOptions {
  /**
   * Optional JSONL persistence path. When supplied, every append is
   * written to this file (append + fsync) and an existing file is loaded
   * on construction, so history survives a process restart.
   *
   * OPERATOR STEP: pass a path the process may create/write, e.g.
   * `new AuditLedger({ filePath: "./data/audit-ledger.jsonl" })`.
   * Without a path the ledger is in-memory only and history is lost on
   * restart — that is the documented default, not a silent guarantee.
   * A tampered or internally inconsistent file fails construction
   * (fail closed) rather than loading a broken chain.
   */
  readonly filePath?: string;
}

export class AuditLedger {
  private readonly store: AuditEntry[] = [];
  private readonly filePath?: string;

  constructor(options: AuditLedgerOptions = {}) {
    this.filePath = options.filePath;
    if (this.filePath) {
      this.loadFromFile(this.filePath);
    }
  }

  /**
   * Append a transition. FAIL CLOSED: the existing chain is verified
   * first — if it is already corrupt, the append is refused (throws)
   * instead of extending a broken chain and hiding the corruption.
   */
  append(transition: AuditTransition): AuditEntry {
    if (!this.verifyChain()) {
      throw new Error(
        "LEDGER_CHAIN_CORRUPT: audit ledger hash chain failed verification; refusing append (fail closed)."
      );
    }
    const previousHash = this.latestHash();
    // Deep-clone + deep-freeze the transition so neither the caller
    // (mutating the object it passed in) nor a later reader (mutating a
    // returned entry) can corrupt the stored record.
    const frozenTransition = deepFreezeValue(deepCloneValue(transition)) as AuditTransition;
    const entry: AuditEntry = deepFreezeValue({
      ...frozenTransition,
      sequence: this.store.length + 1,
      previousHash,
      hash: hashOf({ sequence: this.store.length + 1, previousHash, transition: frozenTransition })
    });

    this.store.push(entry);
    if (this.filePath) {
      this.persistEntry(entry);
    }
    return entry;
  }

  /**
   * Deep-frozen deep copies: mutating a returned entry (at any depth)
   * cannot touch the stored record, and cannot corrupt the chain.
   */
  entries(): readonly AuditEntry[] {
    return this.store.map((entry) => deepFreezeValue(deepCloneValue(entry)));
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

  // ─── Durable JSONL persistence ────────────────────────────────────────────

  private loadFromFile(filePath: string): void {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return; // No file yet — start empty; the first append creates it.
      }
      throw error;
    }
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`LEDGER_LOAD_FAILED: corrupt JSONL line in ${filePath}; refusing to load a broken ledger.`);
      }
      if (!isAuditEntryShape(parsed)) {
        throw new Error(`LEDGER_LOAD_FAILED: malformed audit entry in ${filePath}; refusing to load a broken ledger.`);
      }
      this.store.push(deepFreezeValue(parsed));
    }
    // Entries must be a clean 1..n sequence or the file was tampered with.
    for (let i = 0; i < this.store.length; i++) {
      if (this.store[i].sequence !== i + 1) {
        this.store.length = 0;
        throw new Error(`LEDGER_LOAD_FAILED: non-sequential audit entries in ${filePath}; refusing to load a broken ledger.`);
      }
    }
    if (!this.verifyChain()) {
      this.store.length = 0;
      throw new Error(`LEDGER_LOAD_FAILED: audit hash chain in ${filePath} failed verification; refusing to load a broken ledger.`);
    }
  }

  private persistEntry(entry: AuditEntry): void {
    const filePath = this.filePath as string;
    const dir = path.dirname(filePath);
    if (dir !== "." && dir !== "") {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fd = fs.openSync(filePath, "a");
    try {
      fs.writeFileSync(fd, `${JSON.stringify(entry)}\n`, "utf-8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
}

function isAuditEntryShape(value: unknown): value is AuditEntry {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.traceId === "string" &&
    typeof v.from === "string" &&
    typeof v.to === "string" &&
    typeof v.status === "string" &&
    typeof v.at === "string" &&
    typeof v.sequence === "number" &&
    typeof v.previousHash === "string" &&
    typeof v.hash === "string" &&
    v.detail !== null &&
    typeof v.detail === "object"
  );
}
