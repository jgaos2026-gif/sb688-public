export interface UploadRequest {
  readonly filename: string;
  /** Plain UTF-8 text content of the file being uploaded. Size is enforced in bytes. */
  readonly content: string;
  readonly contentType?: string;
}

export interface UploadResult {
  readonly accepted: boolean;
  readonly filename: string;
  readonly contentHash: string;
  readonly size: number;
  readonly anomalies: readonly string[];
  readonly ledgerHash: string;
}

export interface DispatchRequest {
  readonly filename: string;
  /** Logical destination label (e.g. "invoices", "state-backup"). No path separators allowed. */
  readonly destination: string;
}

export interface DispatchResult {
  readonly dispatched: boolean;
  readonly filename: string;
  readonly destination: string;
  readonly contentHash: string;
  readonly ledgerHash: string;
}

export interface UploadLogEntry {
  readonly sequence: number;
  readonly action: "receive" | "dispatch";
  readonly filename: string;
  readonly status: "accepted" | "rejected" | "dispatched" | "failed";
  readonly contentHash: string;
  readonly at: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly previousHash: string;
  readonly hash: string;
}
