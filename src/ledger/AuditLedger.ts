import * as fs from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import type { AuditEntry, AuditTransition } from "../contracts/audit";
import { hashOf } from "../utils/hash";
import { deepCloneValue, deepFreezeValue } from "../utils/deep";
import { acquireFileLock, releaseFileLock, type FileLockHandle } from "../utils/fileLock";

export interface LedgerAnchor {
  readonly recordCount: number;
  readonly headHash: string;
  readonly wholeFileDigest: string;
  readonly anchoredAt: string;
}

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
   *
   * FINDING C — multi-process coordination: when a file path is set,
   * every verify+append is serialized through an OS-level lockfile
   * (`<filePath>.lock`, atomic O_EXCL creation — see
   * src/utils/fileLock.ts). Two processes can no longer load the same
   * head and append competing successors: the second waits for the
   * lock (up to `lockTimeoutMs`) and then re-verifies the chain from
   * the updated file state before appending. A process-local lock
   * would not solve this; the lockfile does.
   */
  readonly filePath?: string;
  /** How long an append waits for the single-writer lock. Default 10_000 ms. */
  readonly lockTimeoutMs?: number;
  /** Age after which an unparseable lock file counts as stale. Default 30_000 ms. */
  readonly lockStaleMs?: number;
}

export class AuditLedger {
  private readonly store: AuditEntry[] = [];
  private readonly filePath?: string;
  private readonly lockTimeoutMs: number;
  private readonly lockStaleMs: number;

  constructor(options: AuditLedgerOptions = {}) {
    this.filePath = options.filePath;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 10_000;
    this.lockStaleMs = options.lockStaleMs ?? 30_000;
    if (this.filePath) {
      const dir = path.dirname(this.filePath);
      if (dir !== "." && dir !== "") {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Load under the single-writer lock: another process must not
      // append (or recover a torn tail) while this load runs.
      const lock = this.acquireLock();
      try {
        this.loadFromFile(this.filePath);
      } finally {
        releaseFileLock(lock);
      }
    }
  }

  private get lockPath(): string {
    return `${this.filePath as string}.lock`;
  }

  private acquireLock(): FileLockHandle {
    return acquireFileLock(this.lockPath, { timeoutMs: this.lockTimeoutMs, staleMs: this.lockStaleMs });
  }

  /**
   * Append a transition. FAIL CLOSED: the existing chain is verified
   * first — if it is already corrupt, the append is refused (throws)
   * instead of extending a broken chain and hiding the corruption.
   *
   * FINDING B — disk before memory: the entry is serialized, written
   * to disk AND fsynced BEFORE it is published to the in-memory
   * store. If the write fails, memory is untouched and the append
   * throws — memory can never hold an entry the disk does not, and
   * the next append never chains off an entry that was never durably
   * recorded. (Round 2 persisted after the in-memory push, so a
   * failed write left exactly that divergence.)
   *
   * FINDING C — the whole sync+verify+append runs under the
   * single-writer lock when a file path is set, so two processes
   * cannot append competing successors to the same head. Before
   * appending, the instance syncs with the file (see
   * syncWithFileLocked): entries another writer recorded since this
   * instance last loaded are adopted, so the next sequence number is
   * always computed from the latest durable state — never from stale
   * memory.
   */
  append(transition: AuditTransition): AuditEntry {
    const lock = this.filePath ? this.acquireLock() : undefined;
    try {
      if (this.filePath) {
        this.syncWithFileLocked();
      }
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

      // Disk FIRST (finding B): only after the write + fsync succeed
      // does the entry exist in memory.
      if (this.filePath) {
        this.persistEntry(entry);
      }
      this.store.push(entry);
      return entry;
    } finally {
      if (lock) releaseFileLock(lock);
    }
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
    return AuditLedger.entriesChainValid(this.store);
  }

  /**
   * Capture a durable integrity anchor. When file-backed, synchronize under
   * the cross-process writer lock so the anchor includes every acknowledged
   * append and refuses a divergent or corrupt on-disk chain.
   */
  computeAnchor(clock: () => string = () => new Date().toISOString()): LedgerAnchor {
    const lock = this.filePath ? this.acquireLock() : undefined;
    try {
      if (this.filePath) this.syncWithFileLocked();
      if (!this.verifyChain()) {
        throw new Error("LEDGER_ANCHOR_REFUSED: audit chain failed verification.");
      }
      const jsonLines = this.entriesJsonLines();
      return Object.freeze({
        recordCount: this.store.length,
        headHash: this.latestHash(),
        wholeFileDigest: createHash("sha256").update(jsonLines, "utf8").digest("hex"),
        anchoredAt: clock()
      });
    } finally {
      if (lock) releaseFileLock(lock);
    }
  }

  verifyAnchor(anchor: LedgerAnchor): boolean {
    try {
      const current = this.computeAnchor(() => anchor.anchoredAt);
      return current.recordCount === anchor.recordCount &&
        current.headHash === anchor.headHash &&
        current.wholeFileDigest === anchor.wholeFileDigest;
    } catch {
      return false;
    }
  }

  private static entriesChainValid(entries: readonly AuditEntry[]): boolean {
    let previousHash = "GENESIS";

    for (const entry of entries) {
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

  /**
   * Reconcile this instance's memory with the durable file. MUST be
   * called while holding the single-writer lock. Three cases:
   *
   *   - File extends memory (another writer appended since this
   *     instance loaded): adopt the newer entries into memory, so
   *     the next sequence number is computed from the latest durable
   *     state. This is what makes multi-process appends safe.
   *   - Memory extends the file (the file lost entries — deleted or
   *     truncated after this instance loaded them): repair the file
   *     from memory. Every in-memory entry was previously fsynced,
   *     so memory is authoritative for acknowledged entries.
   *   - The two histories DIVERGE (same position, different hash):
   *     fail closed with LEDGER_DIVERGED. Never clobber one history
   *     with the other, and never append onto a fork.
   *
   * A torn final line is recovered by truncation (see
   * readEntriesFromFile); any other corruption fails closed and
   * memory is left untouched.
   */
  private syncWithFileLocked(): void {
    const filePath = this.filePath as string;
    const fileEntries = this.readEntriesFromFile(filePath);
    let common = 0;
    while (
      common < this.store.length &&
      common < fileEntries.length &&
      this.store[common].hash === fileEntries[common].hash
    ) {
      common++;
    }
    if (common < this.store.length && common < fileEntries.length) {
      throw new Error(
        `LEDGER_DIVERGED: the durable ledger file ${filePath} and this instance's memory fork at sequence ${common + 1} (different entry hashes) — refusing to append onto a fork. Construct a fresh AuditLedger to load the current durable state, and investigate the divergence before appending again.`
      );
    }
    if (fileEntries.length > this.store.length) {
      this.store.push(...fileEntries.slice(this.store.length));
      return;
    }
    if (this.store.length > fileEntries.length) {
      const missing = this.store.slice(fileEntries.length);
      const fd = fs.openSync(filePath, "a");
      try {
        fs.writeFileSync(fd, missing.map((entry) => `${JSON.stringify(entry)}\n`).join(""), "utf-8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
  }

  private loadFromFile(filePath: string): void {
    const entries = this.readEntriesFromFile(filePath);
    this.store.push(...entries);
  }

  /**
   * Read and validate the entries in a JSONL ledger file. Returns a
   * fresh array; the caller's store is untouched on failure. Missing
   * file (ENOENT) returns []. A torn FINAL line is truncated away
   * (an interrupted write, never an acknowledged entry); any other
   * corruption throws LEDGER_LOAD_FAILED.
   */
  private readEntriesFromFile(filePath: string): AuditEntry[] {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return []; // No file yet — start empty; the first append creates it.
      }
      throw error;
    }
    // Split keeping each line's byte offset, so a torn final line can
    // be truncated (see below).
    const lines: Array<{ text: string; start: number }> = [];
    let start = 0;
    for (let i = 0; i <= raw.length; i++) {
      if (i === raw.length || raw[i] === "\n") {
        const text = raw.slice(start, i);
        if (text.trim().length > 0) lines.push({ text, start });
        start = i + 1;
      }
    }
    const entries: AuditEntry[] = [];
    let tornTailStart: number | undefined;
    for (let li = 0; li < lines.length; li++) {
      const { text, start: lineStart } = lines[li];
      const isLast = li === lines.length - 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        if (isLast) {
          // TORN-WRITE RECOVERY (finding B): only the final line can
          // be torn — a write that was interrupted (crash, power loss)
          // before the entry was ever acknowledged. Truncate it away
          // and load the intact prefix. A corrupt line anywhere else
          // is tampering, not a torn write, and fails closed below.
          tornTailStart = lineStart;
          break;
        }
        throw new Error(`LEDGER_LOAD_FAILED: corrupt JSONL line in ${filePath}; refusing to load a broken ledger.`);
      }
      if (!isAuditEntryShape(parsed)) {
        // A torn write cannot produce a well-formed-but-wrong entry, so
        // a shape failure is tampering even on the last line.
        throw new Error(`LEDGER_LOAD_FAILED: malformed audit entry in ${filePath}; refusing to load a broken ledger.`);
      }
      entries.push(deepFreezeValue(parsed));
    }
    if (tornTailStart !== undefined) {
      fs.truncateSync(filePath, tornTailStart);
    }
    // Entries must be a clean 1..n sequence or the file was tampered with.
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].sequence !== i + 1) {
        throw new Error(`LEDGER_LOAD_FAILED: non-sequential audit entries in ${filePath}; refusing to load a broken ledger.`);
      }
    }
    if (!AuditLedger.entriesChainValid(entries)) {
      throw new Error(`LEDGER_LOAD_FAILED: audit hash chain in ${filePath} failed verification; refusing to load a broken ledger.`);
    }
    return entries;
  }

  private persistEntry(entry: AuditEntry): void {
    const filePath = this.filePath as string;
    const dir = path.dirname(filePath);
    if (dir !== "." && dir !== "") {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Record the pre-append size: if the write fails part-way, the
    // file is truncated back so the torn line does not sit mid-file
    // (where load would have to fail closed on it) — the entry was
    // never published to memory, so the file must not keep it either.
    let sizeBefore = 0;
    try {
      sizeBefore = fs.statSync(filePath).size;
    } catch {
      sizeBefore = 0; // No file yet.
    }
    const fd = fs.openSync(filePath, "a");
    try {
      fs.writeFileSync(fd, `${JSON.stringify(entry)}\n`, "utf-8");
      fs.fsyncSync(fd);
    } catch (error) {
      try {
        fs.fsyncSync(fd);
      } catch { /* best effort */ }
      try {
        fs.closeSync(fd);
      } catch { /* best effort */ }
      try {
        fs.truncateSync(filePath, sizeBefore);
      } catch { /* best effort — load-time torn-tail recovery is the backstop */ }
      throw error;
    }
    fs.closeSync(fd);
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
