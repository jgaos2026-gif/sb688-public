/**
 * Evidence-ledger cross-check (finding H) — the MECHANISM that stops
 * head anchoring from depending only on operator-controlled state.
 *
 * Problem: the BctHeadRegistry is seeded by the operator (or lives in
 * memory). If the operator seeds a wrong head — or a process restarts
 * with a stale one — the verifier anchors to it and cannot tell. The
 * fix is a second, durable record of heads that the operator does not
 * control from the verify path: an EVIDENCE LEDGER (in this project,
 * a Supabase table — see docs/EVIDENCE_LEDGER_CROSS_CHECK.md).
 *
 * This module is the mechanism, not the wiring:
 *
 *   - `verifyHeadAgainstLedger(identity, localHead, reader)` checks
 *     one local head against the evidence ledger through the
 *     `EvidenceLedgerReader` interface. It performs NO network calls
 *     and touches NO live Supabase project — the caller supplies the
 *     reader. Tests use `InMemoryEvidenceLedger` as a local stand-in.
 *   - `BctVerifier` accepts an optional reader (4th constructor
 *     argument). When one is set, the audit layer additionally
 *     requires the evidence ledger to agree with the local head:
 *     a chained transition requires the ledger's head to EQUAL the
 *     prior head (a stale local head or a fork is rejected); a
 *     genesis transition requires the ledger to have NO record for
 *     the identity (an identity with a durable head can never start
 *     over). Without a reader, behaviour is unchanged.
 *
 * What the operator enables, and how — see
 * docs/EVIDENCE_LEDGER_CROSS_CHECK.md (env/config, the Supabase
 * reader to implement, the call site, and the write path that records
 * a new head after a trusted verification).
 */
import { isWellFormedHash } from "../utils/hash";

export interface EvidenceLedgerEntry {
  /** Identity the head belongs to (e.g. intentId, nodeId). */
  readonly identity: string;
  /** Latest verified state hash the evidence ledger records for this identity. */
  readonly headHash: string;
  /** ISO timestamp the head was recorded. */
  readonly recordedAt: string;
  /** Audit-ledger entry hash that recorded this head, when known. */
  readonly auditHash?: string;
}

/**
 * Read side of an evidence ledger. Implementations: a Supabase table
 * reader in production (see docs/EVIDENCE_LEDGER_CROSS_CHECK.md),
 * `InMemoryEvidenceLedger` in tests and local development.
 */
export interface EvidenceLedgerReader {
  /** Latest head the evidence ledger records for this identity, or undefined when the ledger has never seen it. */
  latestHead(identity: string): EvidenceLedgerEntry | undefined;
  /** Full ordered head history for the identity (oldest first), when the reader can provide it. */
  headHistory?(identity: string): readonly EvidenceLedgerEntry[];
}

export type HeadCrossCheckOutcome =
  | "MATCH"
  | "NO_LEDGER_RECORD"
  | "MISMATCH"
  | "STALE_LOCAL_HEAD";

export interface HeadCrossCheckResult {
  readonly outcome: HeadCrossCheckOutcome;
  /** True only for MATCH — the local head is exactly the durable head. */
  readonly verified: boolean;
  readonly identity: string;
  readonly localHead: string;
  readonly ledgerHead?: string;
  readonly reason: string;
  /** True when the local head appears in the ledger's history but is no longer the latest — i.e. the local head is stale, not forged. */
  readonly localHeadInLedgerHistory?: boolean;
}

/**
 * Verify one local head against the evidence ledger.
 *
 * `localHead` is a well-formed state hash, or "GENESIS" for a chain
 * with no prior head. Throws only for malformed arguments (bad
 * identity / bad head shape) — a ledger that disagrees is a failed
 * result, not an exception.
 */
export function verifyHeadAgainstLedger(
  identity: string,
  localHead: string,
  reader: EvidenceLedgerReader
): HeadCrossCheckResult {
  if (typeof identity !== "string" || identity.trim().length === 0) {
    throw new Error("EVIDENCE_LEDGER_CROSS_CHECK_REJECTED: identity must be a non-empty string.");
  }
  if (localHead !== "GENESIS" && !isWellFormedHash(localHead)) {
    throw new Error(
      `EVIDENCE_LEDGER_CROSS_CHECK_REJECTED: local head must be "GENESIS" or a well-formed 'sha256:' + 64 lowercase hex chars; got ${JSON.stringify(localHead)}.`
    );
  }
  if (!reader || typeof reader.latestHead !== "function") {
    throw new Error("EVIDENCE_LEDGER_CROSS_CHECK_REJECTED: evidence ledger reader is missing latestHead().");
  }

  const entry = reader.latestHead(identity);
  if (entry === undefined) {
    return {
      outcome: "NO_LEDGER_RECORD",
      verified: false,
      identity,
      localHead,
      reason: "The evidence ledger has no record for this identity — the local head is unanchored to any durable record."
    };
  }
  if (entry.headHash === localHead) {
    return {
      outcome: "MATCH",
      verified: true,
      identity,
      localHead,
      ledgerHead: entry.headHash,
      reason: "Local head matches the head recorded in the evidence ledger."
    };
  }
  const history = typeof reader.headHistory === "function" ? reader.headHistory(identity) : [];
  const inHistory = history.some((h) => h.headHash === localHead);
  if (inHistory) {
    return {
      outcome: "STALE_LOCAL_HEAD",
      verified: false,
      identity,
      localHead,
      ledgerHead: entry.headHash,
      localHeadInLedgerHistory: true,
      reason: "Local head is an OLD head: the evidence ledger has moved on to a newer head. The local chain is stale — re-seed from the durable record, do not verify against the old head."
    };
  }
  return {
    outcome: "MISMATCH",
    verified: false,
    identity,
    localHead,
    ledgerHead: entry.headHash,
    localHeadInLedgerHistory: false,
    reason: "Local head does not match the evidence ledger and does not appear in its history — forked, forged, or seeded from an untrusted source."
  };
}

/**
 * Local stand-in evidence ledger (tests, local development). Records
 * heads in memory, oldest first per identity. Production uses a
 * Supabase-backed reader — same interface, durable store.
 */
export class InMemoryEvidenceLedger implements EvidenceLedgerReader {
  private readonly heads = new Map<string, EvidenceLedgerEntry[]>();

  /** Record a head for an identity (the write path — see the docs). */
  record(identity: string, headHash: string, recordedAt: string, auditHash?: string): void {
    if (typeof identity !== "string" || identity.trim().length === 0) {
      throw new Error("EVIDENCE_LEDGER_REJECTED: identity must be a non-empty string.");
    }
    if (!isWellFormedHash(headHash)) {
      throw new Error(
        `EVIDENCE_LEDGER_REJECTED: head hash must be a well-formed 'sha256:' + 64 lowercase hex chars; got ${JSON.stringify(headHash)}.`
      );
    }
    const list = this.heads.get(identity) ?? [];
    list.push({ identity, headHash, recordedAt, ...(auditHash ? { auditHash } : {}) });
    this.heads.set(identity, list);
  }

  latestHead(identity: string): EvidenceLedgerEntry | undefined {
    const list = this.heads.get(identity);
    return list === undefined || list.length === 0 ? undefined : list[list.length - 1];
  }

  headHistory(identity: string): readonly EvidenceLedgerEntry[] {
    return [...(this.heads.get(identity) ?? [])];
  }
}
