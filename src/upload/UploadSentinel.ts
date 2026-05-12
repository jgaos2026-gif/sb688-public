import { hashOf } from "../utils/hash";

const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10 MB (base64 characters)

const ALLOWED_CONTENT_TYPES = new Set([
  "text/plain",
  "application/json",
  "application/pdf",
  "application/octet-stream",
  "text/csv"
]);

export interface SentinelScanResult {
  readonly clean: boolean;
  readonly anomalies: readonly string[];
  readonly contentHash: string;
}

/**
 * UploadSentinel scans incoming files for anomalies before they are accepted
 * into the brick file-system. It enforces size limits, content-type allow-list,
 * safe filename checks, and replay-attack detection via content-hash deduplication.
 */
export class UploadSentinel {
  private readonly seenHashes = new Set<string>();

  scan(filename: string, content: string, contentType: string): SentinelScanResult {
    const anomalies: string[] = [];

    if (content.length === 0) {
      anomalies.push("empty_content");
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      anomalies.push(`content_too_large:${content.length}`);
    }

    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      anomalies.push("suspicious_filename");
    }

    const normalizedType = contentType.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(normalizedType)) {
      anomalies.push(`unsupported_content_type:${normalizedType}`);
    }

    const contentHash = hashOf(content);

    if (this.seenHashes.has(contentHash)) {
      anomalies.push("duplicate_content_hash");
    }

    if (anomalies.length === 0) {
      this.seenHashes.add(contentHash);
    }

    return { clean: anomalies.length === 0, anomalies, contentHash };
  }
}
