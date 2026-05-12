import type { AuditEntry } from "../contracts/audit";

/** Result of one anomaly analysis pass. */
export interface AnomalyReport {
  readonly score: number;
  readonly isAnomaly: boolean;
  readonly predictedThreat: string | null;
  readonly recentFailureCount: number;
}

/**
 * AnomalyDetector — sliding-window failure tracker.
 *
 * Observes AuditLedger entries and flags unusual failure density.
 * The predicted threat is the runtime stage with the most recent failures,
 * used by SentinelLayer to recommend targeted hardening actions.
 */
export class AnomalyDetector {
  private static readonly ANOMALY_THRESHOLD = 0.4;

  private readonly window: number;
  private readonly observations: Array<{ stage: string; at: string }> = [];

  constructor(window = 20) {
    this.window = window;
  }

  /** Feed new ledger entries into the detector. Only failed entries are counted. */
  observe(entries: readonly AuditEntry[]): void {
    for (const entry of entries) {
      if (entry.status === "failed") {
        this.observations.push({ stage: String(entry.from), at: entry.at });
        if (this.observations.length > this.window) {
          this.observations.shift();
        }
      }
    }
  }

  /** Analyse the current observation window and return a report. */
  analyze(): AnomalyReport {
    const score = Math.min(1.0, this.observations.length / Math.max(1, this.window));
    const isAnomaly = score >= AnomalyDetector.ANOMALY_THRESHOLD;

    const stageCounts = this.observations.reduce<Record<string, number>>((acc, o) => {
      acc[o.stage] = (acc[o.stage] ?? 0) + 1;
      return acc;
    }, {});

    let predictedThreat: string | null = null;
    if (Object.keys(stageCounts).length > 0) {
      predictedThreat = Object.entries(stageCounts).sort(([, a], [, b]) => b - a)[0][0];
    }

    return {
      score,
      isAnomaly,
      predictedThreat,
      recentFailureCount: this.observations.length
    };
  }
}
