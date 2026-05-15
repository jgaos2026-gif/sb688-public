import type { AuditLedger } from "../ledger/AuditLedger";
import { UploadSentinel } from "./UploadSentinel";
import { hashOf } from "../utils/hash";
import { systemClock } from "../utils/time";
import type { Clock } from "../utils/time";
import type {
  DispatchRequest,
  DispatchResult,
  UploadLogEntry,
  UploadRequest,
  UploadResult
} from "./contracts";

/** Maximum number of files held in the in-memory store. */
const MAX_STORE_COUNT = 1_000;

/** Maximum aggregate byte-length of all stored file contents combined (100 MB). */
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

interface StoredFile {
  readonly filename: string;
  readonly content: string;
  readonly contentType: string;
  readonly contentHash: string;
  readonly size: number;
  readonly storedAt: string;
}

/**
 * FileUploadManager handles incoming file uploads and autonomous self-dispatch.
 *
 * All events are recorded in two places:
 *   1. A tamper-evident upload log (its own hash-chained sequence, entries are frozen).
 *   2. The shared AuditLedger so every upload appears in the main audit trail.
 *
 * Incoming files are scanned by the UploadSentinel before acceptance.
 * Dispatched files have their content hash re-verified for integrity.
 * The store enforces a per-file-count cap and a total-bytes cap to prevent memory abuse.
 */
export class FileUploadManager {
  private readonly ledger: AuditLedger;
  private readonly sentinel: UploadSentinel;
  private readonly clock: Clock;
  private readonly store = new Map<string, StoredFile>();
  /**
   * Running total of UTF-8 bytes across all files currently in the store.
   * Files remain in the store after dispatch (they are not evicted), so this
   * counter stays accurate for the lifetime of the manager.
   */
  private totalStoredBytes = 0;
  private readonly log: Readonly<UploadLogEntry>[] = [];
  private previousHash = "GENESIS";

  constructor(ledger: AuditLedger, sentinel?: UploadSentinel, clock?: Clock) {
    this.ledger = ledger;
    this.sentinel = sentinel ?? new UploadSentinel();
    this.clock = clock ?? systemClock;
  }

  /** Accept an incoming upload. The file is scanned by the sentinel before storage. */
  receive(request: UploadRequest): UploadResult {
    const { filename, content, contentType = "application/octet-stream" } = request;
    const at = this.clock();
    const byteSize = Buffer.byteLength(content, "utf8");

    // Pre-sentinel storage cap checks to avoid any processing of content that would exceed limits.
    if (this.store.has(filename)) {
      const anomalies = ["filename_already_stored"];
      const contentHash = hashOf(content);
      this.appendLog("receive", filename, "rejected", contentHash, at, { anomalies });
      this.ledger.append({
        traceId: `upload:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: { action: "receive_upload", filename, anomalies, contentHash }
      });
      return {
        accepted: false,
        filename,
        contentHash,
        size: byteSize,
        anomalies,
        ledgerHash: this.ledger.latestHash()
      };
    }

    if (this.store.size >= MAX_STORE_COUNT) {
      const anomalies = ["store_count_limit_exceeded"];
      const contentHash = hashOf(content);
      this.appendLog("receive", filename, "rejected", contentHash, at, { anomalies });
      this.ledger.append({
        traceId: `upload:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: { action: "receive_upload", filename, anomalies, contentHash }
      });
      return {
        accepted: false,
        filename,
        contentHash,
        size: byteSize,
        anomalies,
        ledgerHash: this.ledger.latestHash()
      };
    }

    if (this.totalStoredBytes + byteSize > MAX_TOTAL_BYTES) {
      const anomalies = ["store_total_size_limit_exceeded"];
      const contentHash = hashOf(content);
      this.appendLog("receive", filename, "rejected", contentHash, at, { anomalies });
      this.ledger.append({
        traceId: `upload:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: { action: "receive_upload", filename, anomalies, contentHash }
      });
      return {
        accepted: false,
        filename,
        contentHash,
        size: byteSize,
        anomalies,
        ledgerHash: this.ledger.latestHash()
      };
    }

    const scan = this.sentinel.scan(filename, content, contentType);

    if (!scan.clean) {
      this.appendLog("receive", filename, "rejected", scan.contentHash, at, {
        anomalies: scan.anomalies
      });
      this.ledger.append({
        traceId: `upload:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: {
          action: "receive_upload",
          filename,
          anomalies: scan.anomalies,
          contentHash: scan.contentHash
        }
      });
      return {
        accepted: false,
        filename,
        contentHash: scan.contentHash,
        size: byteSize,
        anomalies: scan.anomalies,
        ledgerHash: this.ledger.latestHash()
      };
    }

    const stored: StoredFile = {
      filename,
      content,
      contentType,
      contentHash: scan.contentHash,
      size: byteSize,
      storedAt: at
    };
    this.store.set(filename, stored);
    this.totalStoredBytes += byteSize;

    this.appendLog("receive", filename, "accepted", scan.contentHash, at, {
      size: byteSize,
      contentType
    });
    this.ledger.append({
      traceId: `upload:${filename}`,
      from: "intent",
      to: "ledger",
      status: "passed",
      at,
      detail: {
        action: "receive_upload",
        filename,
        contentHash: scan.contentHash,
        size: byteSize,
        contentType
      }
    });

    return {
      accepted: true,
      filename,
      contentHash: scan.contentHash,
      size: byteSize,
      anomalies: [],
      ledgerHash: this.ledger.latestHash()
    };
  }

  /** Dispatch a previously uploaded file to a designated logical destination. */
  dispatch(request: DispatchRequest): DispatchResult {
    const { filename, destination } = request;
    const at = this.clock();

    const stored = this.store.get(filename);
    if (!stored) {
      this.appendLog("dispatch", filename, "failed", "none", at, {
        reason: "file_not_found",
        destination
      });
      this.ledger.append({
        traceId: `upload:dispatch:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: { action: "dispatch_upload", filename, destination, reason: "file_not_found" }
      });
      return {
        dispatched: false,
        filename,
        destination,
        contentHash: "none",
        ledgerHash: this.ledger.latestHash()
      };
    }

    // Destination must be a simple label: no path separators anywhere.
    if (destination.includes("/") || destination.includes("\\")) {
      this.appendLog("dispatch", filename, "rejected", stored.contentHash, at, {
        reason: "invalid_destination",
        destination
      });
      this.ledger.append({
        traceId: `upload:dispatch:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: { action: "dispatch_upload", filename, destination, reason: "invalid_destination" }
      });
      return {
        dispatched: false,
        filename,
        destination,
        contentHash: stored.contentHash,
        ledgerHash: this.ledger.latestHash()
      };
    }

    const currentHash = hashOf(stored.content);
    if (currentHash !== stored.contentHash) {
      this.appendLog("dispatch", filename, "failed", stored.contentHash, at, {
        reason: "integrity_check_failed",
        destination
      });
      this.ledger.append({
        traceId: `upload:dispatch:${filename}`,
        from: "intent",
        to: "ledger",
        status: "failed",
        at,
        detail: {
          action: "dispatch_upload",
          filename,
          destination,
          reason: "integrity_check_failed"
        }
      });
      return {
        dispatched: false,
        filename,
        destination,
        contentHash: stored.contentHash,
        ledgerHash: this.ledger.latestHash()
      };
    }

    this.appendLog("dispatch", filename, "dispatched", stored.contentHash, at, {
      destination,
      size: stored.size
    });
    this.ledger.append({
      traceId: `upload:dispatch:${filename}`,
      from: "intent",
      to: "ledger",
      status: "passed",
      at,
      detail: {
        action: "dispatch_upload",
        filename,
        destination,
        contentHash: stored.contentHash,
        size: stored.size
      }
    });

    return {
      dispatched: true,
      filename,
      destination,
      contentHash: stored.contentHash,
      ledgerHash: this.ledger.latestHash()
    };
  }

  /**
   * Returns all upload log entries in append order.
   * Each entry is a frozen copy — mutations by callers do not affect internal state.
   */
  uploadLog(): readonly Readonly<UploadLogEntry>[] {
    return this.log.map((entry) => Object.freeze({ ...entry }));
  }

  /** Verifies the integrity of the upload-specific hash chain. */
  verifyUploadLog(): boolean {
    let prev = "GENESIS";
    for (const entry of this.log) {
      const { hash, previousHash, ...rest } = entry;
      const expected = hashOf({ ...rest, previousHash: prev });
      if (previousHash !== prev || hash !== expected) {
        return false;
      }
      prev = hash;
    }
    return true;
  }

  private appendLog(
    action: "receive" | "dispatch",
    filename: string,
    status: "accepted" | "rejected" | "dispatched" | "failed",
    contentHash: string,
    at: string,
    detail: Record<string, unknown>
  ): void {
    const sequence = this.log.length + 1;
    const core = { sequence, action, filename, status, contentHash, at, detail };
    const hash = hashOf({ ...core, previousHash: this.previousHash });
    const entry: Readonly<UploadLogEntry> = Object.freeze({
      ...core,
      previousHash: this.previousHash,
      hash
    });
    this.log.push(entry);
    this.previousHash = hash;
  }
}
