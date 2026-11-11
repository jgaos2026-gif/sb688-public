/**
 * Durable permit replay protection (round 3).
 *
 * The mesh's seen-signature set used to live only in memory: a
 * previously accepted, unexpired permit became usable again after a
 * restart. This store persists used permit signatures (one JSON line
 * per signature: `{"signature":"<base64>"}`) next to the ledger
 * persistence, append + fsync, so a restart reloads them.
 *
 * Ordering (same rule as the ledger): DISK FIRST. `record()` writes +
 * fsyncs before the signature is published to the in-memory set — a
 * failed write never leaves a permit marked used in memory only.
 *
 * Multi-process: `record()` re-reads the file under the single-writer
 * lock before appending, and `has()` re-reads the file when the
 * signature is not in the in-memory set, so a permit used by another
 * process is still caught. A torn final line (interrupted write) is
 * recovered the same way as the ledger's: truncated on load, ignored
 * on read. Any other corrupt line fails closed.
 *
 * No new dependencies; Node built-ins only.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { acquireFileLock, releaseFileLock } from "../utils/fileLock";

export interface PermitReplayStoreOptions {
  /** How long `record()` waits for the single-writer lock. Default 10_000 ms. */
  readonly lockTimeoutMs?: number;
  /** Age after which an unparseable lock file counts as stale. Default 30_000 ms. */
  readonly lockStaleMs?: number;
}

export class PermitReplayStore {
  private readonly filePath: string;
  private readonly lockTimeoutMs: number;
  private readonly lockStaleMs: number;
  private readonly seen = new Set<string>();

  constructor(filePath: string, options: PermitReplayStoreOptions = {}) {
    this.filePath = filePath;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 10_000;
    this.lockStaleMs = options.lockStaleMs ?? 30_000;
    const dir = path.dirname(filePath);
    if (dir !== "." && dir !== "") {
      fs.mkdirSync(dir, { recursive: true });
    }
    const lock = acquireFileLock(this.lockPath, { timeoutMs: this.lockTimeoutMs, staleMs: this.lockStaleMs });
    try {
      this.loadFromFile();
    } finally {
      releaseFileLock(lock);
    }
  }

  private get lockPath(): string {
    return `${this.filePath}.lock`;
  }

  /**
   * True when this signature has already been used. Consults the
   * in-memory set first; on a miss, re-reads the durable file, so a
   * signature recorded by another process (or before a restart) is
   * still caught. A torn final line is ignored here — it is an
   * interrupted write, never an acknowledged use; `record()` truncates
   * it away under the lock before appending.
   */
  has(signature: string): boolean {
    if (this.seen.has(signature)) return true;
    // Catch up with the durable file (other processes / restarts).
    for (const stored of this.readSignatures(() => undefined)) {
      this.seen.add(stored);
    }
    return this.seen.has(signature);
  }

  /**
   * Durably record a signature as used. Returns true when this call
   * newly recorded it, false when it was already recorded (by this
   * process, another process, or a previous run) — the caller must
   * treat "already recorded" as a replay, not a success.
   * Throws when the durable write fails (fail closed): the permit
   * must not be trusted if its one-time use could not be recorded.
   */
  record(signature: string): boolean {
    if (this.has(signature)) return false;
    const lock = acquireFileLock(this.lockPath, { timeoutMs: this.lockTimeoutMs, staleMs: this.lockStaleMs });
    try {
      // A torn tail left by an interrupted write must be truncated
      // BEFORE appending, or it would sit mid-file and fail every
      // later load. Then re-check under the lock: another process may
      // have recorded the signature between this.has() and the lock.
      this.truncateTornTailIfAny();
      for (const stored of this.readSignatures(() => undefined)) {
        this.seen.add(stored);
      }
      if (this.seen.has(signature)) return false;
      const fd = fs.openSync(this.filePath, "a");
      try {
        fs.writeFileSync(fd, `${JSON.stringify({ signature })}\n`, "utf-8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      this.seen.add(signature);
      return true;
    } finally {
      releaseFileLock(lock);
    }
  }

  /** Number of distinct signatures recorded (in-memory view). */
  get size(): number {
    return this.seen.size;
  }

  private loadFromFile(): void {
    this.truncateTornTailIfAny();
    for (const signature of this.readSignatures(() => undefined)) {
      this.seen.add(signature);
    }
  }

  /** Truncate a torn final line, if one is present. Callers must hold the lock. */
  private truncateTornTailIfAny(): void {
    let tornTailStart: number | undefined;
    this.readSignatures((start) => {
      tornTailStart = start;
    });
    if (tornTailStart !== undefined) {
      fs.truncateSync(this.filePath, tornTailStart);
    }
  }

  /**
   * Read all recorded signatures from the file. A torn FINAL line is
   * reported via `onTornTail` (load truncates it; `has()` ignores it)
   * — it is an interrupted write, never an acknowledged use. Any
   * other corrupt line fails closed.
   */
  private readSignatures(onTornTail?: (start: number) => void): string[] {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const out: string[] = [];
    let start = 0;
    const lines: Array<{ text: string; start: number }> = [];
    for (let i = 0; i <= raw.length; i++) {
      if (i === raw.length || raw[i] === "\n") {
        const text = raw.slice(start, i);
        if (text.trim().length > 0) lines.push({ text, start });
        start = i + 1;
      }
    }
    for (let li = 0; li < lines.length; li++) {
      const { text, start: lineStart } = lines[li];
      const isLast = li === lines.length - 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        if (isLast && onTornTail) {
          onTornTail(lineStart);
          break;
        }
        throw new Error(
          `REPLAY_STORE_LOAD_FAILED: corrupt line in permit replay store ${this.filePath}; refusing to load a broken replay record.`
        );
      }
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        typeof (parsed as Record<string, unknown>).signature !== "string" ||
        ((parsed as Record<string, unknown>).signature as string).length === 0
      ) {
        throw new Error(
          `REPLAY_STORE_LOAD_FAILED: malformed entry in permit replay store ${this.filePath}; refusing to load a broken replay record.`
        );
      }
      out.push((parsed as Record<string, string>).signature);
    }
    return out;
  }
}
