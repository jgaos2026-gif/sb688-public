import { hashOf, makeId } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import type { AuditLedger } from "../ledger/AuditLedger";
import type { PhoenixRecovery } from "./PhoenixRecovery";
import type { PatrolAuditEntry, PatrolFinding, PatrolReport } from "./contracts";

/**
 * PhoenixPatrol — Phase 3 continuous health-monitoring service.
 *
 * Responsibilities:
 *   • continuous health monitoring
 *   • corruption scanning
 *   • upload monitoring (delegates to caller-supplied probe)
 *   • braid verification
 *   • integrity verification
 *   • automatic quarantine
 *   • anomaly reporting
 *   • audit logging (tamper-evident chain)
 */
export class PhoenixPatrol {
  private readonly ledger: AuditLedger;
  private readonly recovery: PhoenixRecovery;
  private readonly clock: Clock;
  private readonly auditLog: PatrolAuditEntry[] = [];
  private readonly quarantine: Set<string> = new Set();
  private previousHash = "GENESIS";
  private cycle = 0;

  constructor(ledger: AuditLedger, recovery: PhoenixRecovery, clock: Clock = systemClock) {
    this.ledger = ledger;
    this.recovery = recovery;
    this.clock = clock;
  }

  /**
   * Run one patrol cycle.
   *
   * @param liveState   current system state to inspect
   * @param seedState   reference clean state to compare against
   * @param uploadLog   optional array of upload filenames to scan for anomalies
   * @param braidSignatures optional map of braid-id → expected hash for braid verification
   */
  patrol(options: {
    readonly liveState: Readonly<Record<string, unknown>>;
    readonly seedState: Readonly<Record<string, unknown>>;
    readonly uploadLog?: readonly string[];
    readonly braidSignatures?: ReadonlyMap<string, string>;
    readonly filesystemPaths?: readonly string[];
  }): PatrolReport {
    this.cycle += 1;
    const at = this.clock();
    const id = makeId("patrol", { cycle: this.cycle, at });
    const findings: PatrolFinding[] = [];
    const anomalies: string[] = [];
    const quarantined: string[] = [];

    // 1. Health check — verify recovery chain integrity
    const validation = this.recovery.validateChain();
    if (!validation.valid || !validation.journalValid) {
      findings.push("corruption_detected");
      anomalies.push("recovery_chain_invalid");
      this.recordAudit("corruption_detected", { reason: "recovery_chain_invalid", validation });
    } else {
      findings.push("healthy");
      this.recordAudit("healthy", { chainLength: validation.length });
    }

    // 2. Integrity check — compare live state hash against seed hash
    const liveHash = hashOf(options.liveState);
    const seedHash = hashOf(options.seedState);
    if (liveHash !== seedHash) {
      // Not necessarily corruption — just a drift. Log as anomaly if keys diverge.
      const driftedKeys = Object.keys(options.seedState).filter(
        (k) => JSON.stringify(options.liveState[k]) !== JSON.stringify(options.seedState[k])
      );
      if (driftedKeys.length > 0) {
        findings.push("integrity_failed");
        anomalies.push(`state_drift:${driftedKeys.join(",")}`);
        this.recordAudit("integrity_failed", { driftedKeys, liveHash, seedHash });
      }
    }

    // 3. Upload monitoring
    if (options.uploadLog) {
      for (const filename of options.uploadLog) {
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          findings.push("upload_anomaly");
          anomalies.push(`suspicious_upload:${filename}`);
          quarantined.push(filename);
          this.quarantine.add(filename);
          this.recordAudit("upload_anomaly", { filename, reason: "suspicious_path" });
        }
      }
    }

    // 4. Braid verification
    if (options.braidSignatures) {
      for (const [braidId, expectedHash] of options.braidSignatures) {
        const liveValue = (options.liveState as Record<string, unknown>)[braidId];
        const liveHash2 = hashOf(liveValue ?? null);
        if (liveHash2 !== expectedHash) {
          findings.push("braid_invalid");
          anomalies.push(`braid_mismatch:${braidId}`);
          quarantined.push(braidId);
          this.quarantine.add(braidId);
          this.recordAudit("braid_invalid", { braidId, expectedHash, actualHash: liveHash2 });
        }
      }
    }

    // 5. Filesystem path scan (basic anomaly detection)
    if (options.filesystemPaths) {
      for (const p of options.filesystemPaths) {
        if (p.includes("..") || p.startsWith("/etc") || p.startsWith("/proc")) {
          findings.push("filesystem_anomaly");
          anomalies.push(`suspicious_path:${p}`);
          quarantined.push(p);
          this.quarantine.add(p);
          this.recordAudit("filesystem_anomaly", { path: p });
        }
      }
    }

    const healthy = anomalies.length === 0;
    const chainHash = hashOf({ id, cycle: this.cycle, findings, anomalies, quarantined, at });

    // Append patrol summary to audit ledger
    this.ledger.append({
      traceId: `patrol:${id}`,
      from: "patrol.health",
      to: "patrol.anomaly",
      status: healthy ? "passed" : "failed",
      at,
      detail: { cycle: this.cycle, healthy, anomalyCount: anomalies.length, quarantinedCount: quarantined.length }
    });

    return Object.freeze({
      id,
      at,
      cycle: this.cycle,
      findings: Object.freeze([...findings]) as readonly PatrolFinding[],
      quarantined: Object.freeze([...quarantined]),
      anomalies: Object.freeze([...anomalies]),
      healthy,
      chainHash
    });
  }

  /** Returns the current quarantine set (items flagged for isolation). */
  quarantineList(): readonly string[] {
    return [...this.quarantine];
  }

  /** Returns the full tamper-evident patrol audit log. */
  patrolAuditLog(): readonly PatrolAuditEntry[] {
    return this.auditLog.map((e) => Object.freeze({ ...e }));
  }

  /** Verify the patrol audit log hash chain. */
  verifyAuditLog(): boolean {
    let prev = "GENESIS";
    for (const entry of this.auditLog) {
      const { hash, ...rest } = entry;
      const expected = hashOf({ ...rest });
      if (rest.previousHash !== prev || hash !== expected) return false;
      prev = hash;
    }
    return true;
  }

  private recordAudit(finding: PatrolFinding, detail: Readonly<Record<string, unknown>>): void {
    const sequence = this.auditLog.length + 1;
    const at = this.clock();
    const id = makeId("patrol-audit", { sequence, finding, at });
    const core = { id, sequence, at, cycle: this.cycle, finding, detail, previousHash: this.previousHash };
    const hash = hashOf(core);
    const entry: PatrolAuditEntry = Object.freeze({ ...core, hash });
    this.auditLog.push(entry);
    this.previousHash = hash;
  }
}
