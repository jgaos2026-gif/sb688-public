import { hashOf } from "../utils/hash";
import { systemClock, type Clock } from "../utils/time";
import type {
  DriftReport,
  SentinelDiagnosis,
  SentinelHealthMetric,
  SentinelRecommendation,
  SentinelStatus
} from "./contracts";

/**
 * SENTINEL_LAYER — Autonomous self-awareness and adaptive vigilance.
 *
 * Maintains a bounded sliding window of health observations taken each
 * supervisor tick.  Observations are hash-linked (mirroring the Spine
 * ledger design) so any post-hoc tampering with the metric log is
 * detectable via `selfIntegrityOk` in the diagnosis output.
 *
 * Breach-rate thresholds map to a graduated recommendation:
 *
 *   NOMINAL     breach rate  < 20 %
 *   MONITOR     breach rate ≥ 20 %
 *   ESCALATE    breach rate ≥ 40 %
 *   QUARANTINE  breach rate ≥ 60 %  OR  ≥ 80 % consecutive
 *   FAILSAFE    breach rate ≥ 80 %  OR  100 % consecutive
 */
export class SentinelLayer {
  public static readonly IDENT = "SENTINEL_LAYER" as const;

  private static readonly THRESHOLD_MONITOR = 0.2;
  private static readonly THRESHOLD_ESCALATE = 0.4;
  private static readonly THRESHOLD_QUARANTINE = 0.6;
  private static readonly THRESHOLD_FAILSAFE = 0.8;

  private readonly metrics: SentinelHealthMetric[] = [];
  private readonly windowSize: number;
  private readonly clock: Clock;
  /** Running chain-head hash (advances with every `observe()` call). */
  private chainHead = "SENTINEL_GENESIS";

  constructor(opts?: { readonly windowSize?: number; readonly clock?: Clock }) {
    this.windowSize = opts?.windowSize ?? 10;
    this.clock = opts?.clock ?? systemClock;
  }

  /**
   * Record one health observation from an armor-drift report.
   * Each metric is hash-linked to the previous entry for tamper evidence.
   */
  observe(tick: number, report: DriftReport): void {
    const metric: SentinelHealthMetric = Object.freeze({
      tick,
      at: this.clock(),
      drift: report.drift,
      breach: report.breach,
      pulseAlive: report.pulseAlive,
      prevHash: this.chainHead
    });
    this.chainHead = hashOf(metric);
    this.metrics.push(metric);

    // Keep a bounded ring (2× window so history is available for diagnostics).
    if (this.metrics.length > this.windowSize * 2) {
      this.metrics.splice(0, this.metrics.length - this.windowSize * 2);
    }
  }

  /** Run self-diagnosis over the current sliding window. */
  diagnose(): SentinelDiagnosis {
    const window = this.metrics.slice(-this.windowSize);
    const windowSize = window.length;

    if (windowSize === 0) {
      return Object.freeze({
        windowSize: 0,
        breachCount: 0,
        breachRate: 0,
        consecutiveBreaches: 0,
        recommendation: "NOMINAL" as SentinelRecommendation,
        reason: "No observations recorded yet.",
        selfIntegrityOk: this._verifyChain()
      });
    }

    const breachCount = window.filter((m) => m.breach).length;
    const breachRate = breachCount / windowSize;

    let consecutiveBreaches = 0;
    for (let i = window.length - 1; i >= 0; i -= 1) {
      if (window[i].breach) {
        consecutiveBreaches += 1;
      } else {
        break;
      }
    }

    const recommendation = this._classify(breachRate, consecutiveBreaches, windowSize);
    const reason = this._explain(recommendation, breachRate, consecutiveBreaches);
    const selfIntegrityOk = this._verifyChain();

    return Object.freeze({
      windowSize,
      breachCount,
      breachRate,
      consecutiveBreaches,
      recommendation,
      reason,
      selfIntegrityOk
    });
  }

  /** FNV-1a hash of the entire metric chain for external tamper verification. */
  integrityHash(): string {
    return hashOf(this.metrics);
  }

  /** Full sentinel status snapshot. */
  status(): SentinelStatus {
    return Object.freeze({
      active: true,
      metricsRecorded: this.metrics.length,
      lastDiagnosis: this.diagnose(),
      integrityHash: this.integrityHash()
    });
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private _classify(
    breachRate: number,
    consecutiveBreaches: number,
    windowSize: number
  ): SentinelRecommendation {
    // Consecutive saturation takes priority over the aggregate rate.
    if (consecutiveBreaches >= windowSize) return "FAILSAFE";
    if (consecutiveBreaches >= Math.ceil(windowSize * 0.8)) return "QUARANTINE";
    if (breachRate >= SentinelLayer.THRESHOLD_FAILSAFE) return "FAILSAFE";
    if (breachRate >= SentinelLayer.THRESHOLD_QUARANTINE) return "QUARANTINE";
    if (breachRate >= SentinelLayer.THRESHOLD_ESCALATE) return "ESCALATE";
    if (breachRate >= SentinelLayer.THRESHOLD_MONITOR) return "MONITOR";
    return "NOMINAL";
  }

  private _explain(
    rec: SentinelRecommendation,
    breachRate: number,
    consecutiveBreaches: number
  ): string {
    switch (rec) {
      case "NOMINAL":
        return "System health nominal; breach rate within tolerance.";
      case "MONITOR":
        return `Breach rate ${(breachRate * 100).toFixed(1)}% exceeds baseline; increase observation cadence.`;
      case "ESCALATE":
        return `Persistent faults detected (rate ${(breachRate * 100).toFixed(1)}%); deeper healing protocols required.`;
      case "QUARANTINE":
        return `Majority-breach window (${consecutiveBreaches} consecutive); isolate affected bricks and restore from clean seed.`;
      case "FAILSAFE":
        return `Saturation breach (rate ${(breachRate * 100).toFixed(1)}%, ${consecutiveBreaches} consecutive); activate fail-safe mode immediately.`;
    }
  }

  /**
   * Replay the metric hash-chain to detect any post-hoc mutation of the log.
   * Returns true when the chain is intact.
   */
  private _verifyChain(): boolean {
    let current = "SENTINEL_GENESIS";
    for (const metric of this.metrics) {
      if (metric.prevHash !== current) return false;
      current = hashOf(metric);
    }
    return current === this.chainHead;
  }
}
