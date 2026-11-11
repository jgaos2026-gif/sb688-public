/**
 * OS-level single-writer lock, via an atomic lockfile (finding C).
 *
 * A process-local mutex does NOT solve multi-process coordination:
 * two processes can load the same head, both verify, and both append
 * different successors. This lock is enforced by the filesystem
 * itself: the lock file is created with O_EXCL ("wx"), so exactly one
 * process can hold it at a time, on any OS — no flock, no new
 * dependency (Node has no stdlib flock).
 *
 * Lockfile contents: "<pid>\n<acquired-at-ms>\n". A lock whose owner
 * process is dead (checked with kill(pid, 0)) is stale and may be
 * removed by the next acquirer; a lock whose owner is alive is never
 * removed, however old — a wedged-but-alive holder must be cleared
 * by the operator, because silently breaking a live holder's lock
 * would re-introduce the race. A lock file with unparseable contents
 * older than `staleMs` is treated as stale (a crashed writer).
 *
 * Acquisition blocks (sleeping briefly between attempts) until
 * `timeoutMs` and then THROWS (fail closed) — the caller must not
 * proceed to write without the lock. Always release in a `finally`.
 */
import * as fs from "node:fs";

export interface FileLockHandle {
  readonly lockPath: string;
  readonly fd: number;
  readonly pid: number;
}

export interface FileLockOptions {
  /** How long to wait for the lock before failing closed. Default 10_000 ms. */
  readonly timeoutMs?: number;
  /** Sleep between acquisition attempts. Default 25 ms. */
  readonly retryMs?: number;
  /** Age after which an unparseable lock file counts as stale. Default 30_000 ms. */
  readonly staleMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_MS = 25;
const DEFAULT_STALE_MS = 30_000;

export function acquireFileLock(lockPath: string, options: FileLockOptions = {}): FileLockHandle {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}\n${Date.now()}\n`, "utf-8");
        fs.fsyncSync(fd);
      } catch (error) {
        try { fs.closeSync(fd); } catch { /* best effort */ }
        try { fs.unlinkSync(lockPath); } catch { /* best effort */ }
        throw error;
      }
      return { lockPath, fd, pid: process.pid };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }

    // A lock file already exists. Remove it only if it is stale, then retry.
    if (tryRemoveStaleLock(lockPath, staleMs)) {
      continue;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `LEDGER_LOCK_TIMEOUT: could not acquire the single-writer lock ${lockPath} within ${timeoutMs}ms — another process holds it; refusing to write concurrently (fail closed).`
      );
    }
    sleepSync(retryMs);
  }
}

/** Release a lock previously acquired by this process. Best effort; never throws. */
export function releaseFileLock(handle: FileLockHandle): void {
  try {
    fs.closeSync(handle.fd);
  } catch { /* already closed — ignore */ }
  try {
    // Only remove the lock if it is still ours: a successor may have
    // legitimately acquired it after we released the fd.
    const content = fs.readFileSync(handle.lockPath, "utf-8");
    if (content.split("\n")[0] === String(handle.pid)) {
      fs.unlinkSync(handle.lockPath);
    }
  } catch { /* already gone or replaced — ignore */ }
}

/** Run `fn` while holding the lock for `lockPath`. The lock is always released. */
export function withFileLock<T>(lockPath: string, options: FileLockOptions, fn: () => T): T {
  const handle = acquireFileLock(lockPath, options);
  try {
    return fn();
  } finally {
    releaseFileLock(handle);
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but we may not signal it.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Remove the lock file if it is stale. Returns true when the file is
 * gone (removed here, or already gone) so the caller should retry the
 * acquisition immediately; false when a live owner holds it.
 */
function tryRemoveStaleLock(lockPath: string, staleMs: number): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    return true; // Gone between the EEXIST and the stat — retry.
  }
  let content = "";
  try {
    content = fs.readFileSync(lockPath, "utf-8");
  } catch {
    return false; // Cannot read it; do not touch a lock we cannot inspect.
  }
  const pid = parseInt(content.split("\n")[0] ?? "", 10);
  if (Number.isInteger(pid) && pid > 0) {
    // A live owner — even our own pid — is never evicted.
    if (isPidAlive(pid)) return false;
    // Dead owner: stale.
  } else if (Date.now() - stat.mtimeMs <= staleMs) {
    // Unparseable contents, but fresh: a writer may still be
    // mid-creation. Leave it alone.
    return false;
  }
  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false; // Someone else removed or replaced it — retry normally.
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
