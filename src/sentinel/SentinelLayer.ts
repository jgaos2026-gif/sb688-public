import type { AuditLedger } from "../ledger/AuditLedger";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { hashOf, makeId } from "../utils/hash";
import { AnomalyDetector } from "./AnomalyDetector";
import type {
  AlertLevel,
  BraidedJudgment,
  SentinelResurrectionEvent,
  SentinelAdaptReport,
  SentinelAlert,
  SentinelFullReport,
  SentinelStatus,
  SentinelWatchReport,
  SentinelShadowFrame
} from "./contracts";

export interface SentinelLayerDeps {
  readonly ledger: AuditLedger;
  readonly clock?: Clock;
  readonly anomalyWindow?: number;
  readonly maxResurrections?: number;
}

/**
 * SentinelLayer — self-awareness layer for the SB688/SB689 Sovereign OS.
 *
 * Inspired by SB689 OMEGA · Sovereign Stitch:
 *   loop: [Watch → Detect → Judge → Heal/Alert → Mirror → Adapt]
 *   fail: resurrect(ghost_shadow) → re-stitch → signal(crown_gold_flash)
 *
 * Capabilities
 * ============
 * • Proactive self-monitoring  — watch() mirrors ledger state each cycle.
 * • Anomaly detection          — AnomalyDetector flags unusual failure density.
 * • Adaptive decision-making   — braidedJudge() routes ethical actions via
 *                                personality · moral · judgment braiding.
 * • Ghost shadow mirroring     — captureFrame() snapshots state before drift.
 * • Omega resurrection loop    — resurrect() pointer-flips to a clean mirror,
 *                                ensuring tampered state never re-enters the
 *                                trusted chain (Whitepaper §5).
 * • Autonomous evolution       — adapt() learns from incident memory and emits
 *                                hardening recommendations.
 */
export class SentinelLayer {
  private readonly ledger: AuditLedger;
  private readonly clock: Clock;
  private readonly detector: AnomalyDetector;
  private readonly maxResurrections: number;

  private readonly alertLog: SentinelAlert[] = [];
  private readonly frames: SentinelShadowFrame[] = [];
  private readonly resurrectionLog: SentinelResurrectionEvent[] = [];
  private readonly incidents: Array<{ component: string; action: string; at: string }> = [];
  private readonly judgmentLog: BraidedJudgment[] = [];

  private _status: SentinelStatus = "SENTINEL_ARMED";
  private _armed = true;
  private _cycle = 0;

  constructor(deps: SentinelLayerDeps) {
    this.ledger = deps.ledger;
    this.clock = deps.clock ?? systemClock;
    this.detector = new AnomalyDetector(deps.anomalyWindow ?? 20);
    this.maxResurrections = deps.maxResurrections ?? 3;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Proactive watch cycle: mirror ledger state, run anomaly analysis,
   * verify hash chain integrity, and emit alerts as needed.
   */
  watch(liveState?: Readonly<Record<string, unknown>>): SentinelWatchReport {
    if (!this._armed) {
      return this.offlineReport();
    }

    const entries = this.ledger.entries();
    this.detector.observe(entries);
    const analysis = this.detector.analyze();
    const chainValid = this.ledger.verifyChain();

    const captureState = liveState ?? ({ ledgerSize: entries.length } as Readonly<Record<string, unknown>>);
    const frame = this.captureFrame(captureState);

    if (!chainValid) {
      this.emit("CRITICAL", "Ledger chain integrity violated — resurrection required.", {
        cycle: this._cycle
      });
      this._status = "SENTINEL_ANOMALY";
    } else if (analysis.isAnomaly) {
      this.emit("HIGH", `Anomaly detected: score=${analysis.score.toFixed(2)}`, {
        score: analysis.score,
        predictedThreat: analysis.predictedThreat
      });
      if (this._status === "SENTINEL_ARMED") {
        this._status = "SENTINEL_WATCHING";
      }
    }

    return Object.freeze({
      status: this._status,
      frameCycle: frame.cycle,
      frameHash: frame.hash,
      anomaly: analysis.isAnomaly,
      anomalyScore: analysis.score,
      predictedThreat: analysis.predictedThreat,
      chainValid
    });
  }

  /**
   * Braided ethical judgment: personality · moral · judgment routing.
   *
   * The Guardian personality prioritises ledger integrity and system
   * sovereignty. Moral weights encode the ethical cost of each action.
   */
  braidedJudge(context: {
    readonly component: string;
    readonly failureCode: string;
    readonly recoverable: boolean;
    readonly previousResurrections?: number;
  }): BraidedJudgment {
    const { component, failureCode, recoverable } = context;
    const previousResurrections = context.previousResurrections ?? this.resurrectionLog.length;

    const action: BraidedJudgment["action"] =
      !recoverable || previousResurrections >= this.maxResurrections - 1 ? "quarantine"
        : failureCode === "LEDGER_APPEND_FAILED" ? "resurrect"
          : failureCode === "BRAIN_FAILURE" ? "restart"
            : failureCode === "SPINE_REJECTED" ? "rollback"
              : "heal";

    const moralWeights: Record<string, number> = {
      rollback: 0.95,
      resurrect: 0.90,
      restart: 0.85,
      quarantine: 0.80,
      heal: 0.75,
      alert: 0.60
    };

    const judgment: BraidedJudgment = Object.freeze({
      action,
      moralScore: moralWeights[action] ?? 0.5,
      personality: "guardian",
      reasoning: (
        `Guardian judgment: ${action} for '${failureCode}' on '${component}' ` +
        `(recoverable=${recoverable}, prior_resurrections=${previousResurrections})`
      ),
      at: this.clock()
    });

    this.judgmentLog.push(judgment);
    return judgment;
  }

  /**
   * Omega resurrection loop: pointer-flip to the last clean ghost mirror.
   *
   * Returns true when a resurrection event is initiated; false when the
   * resurrection budget is exhausted (status transitions to SENTINEL_BREACH).
   * The tampered live state is abandoned — it never re-enters the trusted chain.
   */
  resurrect(cause: string): boolean {
    if (this.resurrectionLog.length >= this.maxResurrections) {
      this.emit("CRITICAL", "Max resurrections reached — SENTINEL_BREACH.", {
        count: this.resurrectionLog.length,
        cause
      });
      this._status = "SENTINEL_BREACH";
      return false;
    }

    const latest = this.frames.length > 0 ? this.frames[this.frames.length - 1] : null;
    const event: SentinelResurrectionEvent = Object.freeze({
      id: this.resurrectionLog.length + 1,
      cause,
      at: this.clock(),
      ghostFrameHash: latest?.hash ?? null
    });

    this.resurrectionLog.push(event);
    this.emit("RESURRECTION", `Omega resurrection #${event.id}: ${cause}`, {
      ghostFrameHash: event.ghostFrameHash
    });
    this._status = "SENTINEL_RESURRECTING";
    return true;
  }

  /** Record a healed incident for autonomous-evolution tracking. */
  recordHeal(component: string, action: string): void {
    this.incidents.push({ component, action, at: this.clock() });
    if (this.incidents.length > 50) {
      this.incidents.shift();
    }
  }

  /**
   * Autonomous evolution: analyse the incident memory and emit hardening
   * recommendations for components that show recurring failure patterns.
   */
  adapt(): SentinelAdaptReport {
    if (this.incidents.length === 0) {
      return Object.freeze({ recommendations: [], evolved: false, incidentsAnalyzed: 0 });
    }

    const counts = this.incidents.reduce<Record<string, number>>((acc, inc) => {
      acc[inc.component] = (acc[inc.component] ?? 0) + 1;
      return acc;
    }, {});

    const recommendations = Object.entries(counts)
      .filter(([, count]) => count >= 3)
      .map(([component, count]) => Object.freeze({
        component,
        action: "increase_monitoring",
        reason: `${component} has ${count} recorded incidents`
      }));

    const evolved = recommendations.length > 0;
    if (evolved) {
      this._status = "SENTINEL_EVOLVED";
    }

    return Object.freeze({ recommendations, evolved, incidentsAnalyzed: this.incidents.length });
  }

  /** Return a complete sentinel status snapshot. */
  fullReport(liveState?: Readonly<Record<string, unknown>>): SentinelFullReport {
    return Object.freeze({
      status: this._status,
      armed: this._armed,
      watch: this.watch(liveState),
      adaptation: this.adapt(),
      alertCount: this.alertLog.length,
      resurrectionCount: this.resurrectionLog.length,
      incidentCount: this.incidents.length,
      judgmentCount: this.judgmentLog.length
    });
  }

  status(): SentinelStatus {
    return this._status;
  }

  isArmed(): boolean {
    return this._armed;
  }

  disarm(): void {
    this._armed = false;
  }

  getAlerts(): readonly SentinelAlert[] {
    return this.alertLog.slice();
  }

  getResurrections(): readonly SentinelResurrectionEvent[] {
    return this.resurrectionLog.slice();
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private captureFrame(state: Readonly<Record<string, unknown>>): SentinelShadowFrame {
    this._cycle += 1;
    const frame: SentinelShadowFrame = Object.freeze({
      cycle: this._cycle,
      hash: hashOf(state),
      capturedAt: this.clock(),
      state
    });
    this.frames.push(frame);
    return frame;
  }

  private emit(level: AlertLevel, message: string, detail: Readonly<Record<string, unknown>>): void {
    const at = this.clock();
    const entry: SentinelAlert = Object.freeze({
      id: makeId("sentinel", { level, message, at }),
      level,
      message,
      at,
      detail
    });
    this.alertLog.push(entry);
  }

  private offlineReport(): SentinelWatchReport {
    return Object.freeze({
      status: "SENTINEL_BREACH" as SentinelStatus,
      frameCycle: this._cycle,
      frameHash: "offline",
      anomaly: false,
      anomalyScore: 0,
      predictedThreat: null,
      chainValid: false
    });
  }
}
