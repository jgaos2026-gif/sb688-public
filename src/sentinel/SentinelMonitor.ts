import type { AuditLedger } from "../ledger/AuditLedger";
import type { OmegaStatus } from "../omega/contracts";
import { makeId, hashOf } from "../utils/hash";
import { systemClock, type Clock } from "../utils/time";
import type {
  AnomalyEvent,
  SentinelIncident,
  SentinelReport,
  ThreatLevel,
} from "./contracts";

export interface SentinelMonitorDeps {
  readonly ledger?: AuditLedger;
  readonly clock?: Clock;
  /**
   * Number of resurrections within the rolling window before the threat level
   * escalates.  Defaults to 3; the sentinel evolves this adaptively.
   */
  readonly initialAlertThreshold?: number;
}

/**
 * SentinelMonitor — self-aware vigilance layer.
 *
 * Sits above the OmegaSupervisor and provides:
 *  - Proactive system-health watching each supervisor cycle
 *  - Anomaly detection (resurrection surges, pulse loss, drift breaches)
 *  - Threat-level classification (NOMINAL / WATCHFUL / ELEVATED / CRITICAL)
 *  - Adaptive decision-making — recommends or triggers self-healing
 *  - Incident learning — autonomously tightens alert thresholds as
 *    incident rates escalate (autonomous evolution within safe bounds)
 *  - Tamper-evident logging via the shared AuditLedger
 */
export class SentinelMonitor {
  private readonly ledger?: AuditLedger;
  private readonly clock: Clock;

  private sentinelCycle = 0;
  private incidentCount = 0;
  private alertThreshold: number;

  private readonly incidents: SentinelIncident[] = [];
  private readonly reports: SentinelReport[] = [];

  /** Rolling window of recent resurrection cycles for surge detection. */
  private readonly resurrectionCycles: number[] = [];
  /** Rolling window size (last N sentinel cycles). */
  private static readonly WINDOW = 10;
  /** Multiplier applied to alert threshold to detect surge / tighten threshold. */
  private static readonly THRESHOLD_EVOLUTION_MULTIPLIER = 2;

  constructor(deps: SentinelMonitorDeps = {}) {
    this.ledger = deps.ledger;
    this.clock = deps.clock ?? systemClock;
    this.alertThreshold = deps.initialAlertThreshold ?? 3;
  }

  /**
   * Consume one OmegaStatus tick and produce a SentinelReport.
   *
   * This is the primary entry point.  Call once per omega.tick().
   */
  monitor(omegaStatus: OmegaStatus): SentinelReport {
    this.sentinelCycle += 1;
    const now = this.clock();

    const anomalies: AnomalyEvent[] = [];

    // ---- 1. Resurrection monitoring ----------------------------------------
    if (omegaStatus.status === "SB689_RESURRECTING") {
      this.resurrectionCycles.push(this.sentinelCycle);
      this.recordIncident("resurrection", `Omega resurrecting at cycle ${omegaStatus.cycle}`, omegaStatus.cycle);
      anomalies.push(this.anomaly("resurrection_event", `Resurrection triggered at omega cycle ${omegaStatus.cycle}: ${omegaStatus.lastDrift.reason}`));
    }

    // ---- 2. Pulse-loss detection -------------------------------------------
    if (!omegaStatus.lastDrift.pulseAlive) {
      this.recordIncident("pulse_lost", `Pulse lost at sentinel cycle ${this.sentinelCycle}`, omegaStatus.cycle);
      anomalies.push(this.anomaly("pulse_lost", "Live pulse is non-responsive — system may be unresponsive."));
    }

    // ---- 3. Drift-breach detection -----------------------------------------
    if (omegaStatus.lastDrift.breach && omegaStatus.lastDrift.pulseAlive) {
      this.recordIncident("drift_breach", omegaStatus.lastDrift.reason, omegaStatus.cycle);
      anomalies.push(this.anomaly("drift_breach", `State drift exceeds threshold: ${omegaStatus.lastDrift.reason}`));
    }

    // ---- 4. Breach status -------------------------------------------------
    if (omegaStatus.status === "SB689_BREACH") {
      this.recordIncident("breach", "Omega status: SB689_BREACH", omegaStatus.cycle);
      anomalies.push(this.anomaly("breach_status", "Omega supervisor reports an active breach."));
    }

    // ---- 5. Resurrection surge detection (adaptive threshold) -------------
    this.pruneWindow();
    const surgeDet = this.resurrectionCycles.length >= this.alertThreshold;
    if (surgeDet) {
      anomalies.push(
        this.anomaly(
          "resurrection_surge",
          `${this.resurrectionCycles.length} resurrections in last ${SentinelMonitor.WINDOW} sentinel cycles (threshold: ${this.alertThreshold}).`
        )
      );
    }

    // ---- 6. Crown signal anomaly -----------------------------------------
    if (omegaStatus.crown.color === "RED") {
      anomalies.push(this.anomaly("crown_red", `Crown signal RED: ${omegaStatus.crown.message}`));
    }

    // ---- 7. Threat classification -----------------------------------------
    const threatLevel = this.classify(anomalies, surgeDet);

    // ---- 8. Adaptive threshold evolution ----------------------------------
    this.evolveThreshold();

    // ---- 9. Self-healing recommendation -----------------------------------
    const { recommendation, selfHealTriggered } = this.recommendAction(threatLevel, anomalies);

    // ---- 10. Audit ---------------------------------------------------------
    this.audit("sentinel.monitor", {
      sentinelCycle: this.sentinelCycle,
      threatLevel,
      anomalyCount: anomalies.length,
      selfHealTriggered,
      incidentCount: this.incidentCount,
    });

    const report: SentinelReport = Object.freeze({
      cycle: this.sentinelCycle,
      detectedAt: now,
      threatLevel,
      anomalies: Object.freeze(anomalies),
      recommendation,
      selfHealTriggered,
      incidentCount: this.incidentCount,
      alertThreshold: this.alertThreshold,
    });

    this.reports.push(report);
    return report;
  }

  /** Full history of sentinel reports (oldest first). */
  reportHistory(): readonly SentinelReport[] {
    return this.reports.slice();
  }

  /** Full history of recorded incidents. */
  incidentHistory(): readonly SentinelIncident[] {
    return this.incidents.slice();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private recordIncident(kind: string, detail: string, omegaCycle: number): void {
    this.incidentCount += 1;
    const incident: SentinelIncident = Object.freeze({
      id: makeId("sentinel.incident", { kind, cycle: this.sentinelCycle, omegaCycle }),
      at: this.clock(),
      kind,
      detail,
      omegaCycle,
    });
    this.incidents.push(incident);
  }

  private anomaly(kind: string, detail: string): AnomalyEvent {
    return Object.freeze({
      id: makeId("sentinel.anomaly", { kind, sentinelCycle: this.sentinelCycle }),
      detectedAt: this.clock(),
      kind,
      detail,
    });
  }

  /** Classify threat level based on active anomalies and surge flag. */
  private classify(anomalies: readonly AnomalyEvent[], surge: boolean): ThreatLevel {
    const kinds = new Set(anomalies.map((a) => a.kind));

    if (kinds.has("breach_status") || kinds.has("crown_red")) {
      return "CRITICAL";
    }
    if (surge || (kinds.has("pulse_lost") && kinds.has("drift_breach"))) {
      return "ELEVATED";
    }
    if (kinds.has("resurrection_event") || kinds.has("pulse_lost") || kinds.has("drift_breach")) {
      return "WATCHFUL";
    }
    return "NOMINAL";
  }

  /**
   * Produce a recommendation and optionally mark self-heal as triggered.
   * The sentinel never takes destructive autonomous action; it either
   * recommends (WATCHFUL / ELEVATED) or signals a mandatory intervention
   * (CRITICAL) so that the OmegaSupervisor's resurrection loop fires.
   */
  private recommendAction(
    threatLevel: ThreatLevel,
    anomalies: readonly AnomalyEvent[]
  ): { recommendation: string; selfHealTriggered: boolean } {
    switch (threatLevel) {
      case "NOMINAL":
        return { recommendation: "System healthy. Continue normal operation.", selfHealTriggered: false };

      case "WATCHFUL":
        return {
          recommendation: "Isolated anomaly detected. Increase monitoring cadence and verify spine chain integrity.",
          selfHealTriggered: false,
        };

      case "ELEVATED": {
        const kinds = anomalies.map((a) => a.kind).join(", ");
        return {
          recommendation: `Elevated threat [${kinds}]. Sentinel recommends activating ghost-shadow pointer-flip and re-stitching the seed chain.`,
          selfHealTriggered: true,
        };
      }

      case "CRITICAL":
        return {
          recommendation: "CRITICAL breach confirmed. Sentinel signals mandatory Omega resurrection and crown GOLD flash.",
          selfHealTriggered: true,
        };
    }
  }

  /** Remove resurrection entries outside the rolling window. */
  private pruneWindow(): void {
    const cutoff = this.sentinelCycle - SentinelMonitor.WINDOW;
    while (this.resurrectionCycles.length > 0 && this.resurrectionCycles[0] <= cutoff) {
      this.resurrectionCycles.shift();
    }
  }

  /**
   * Autonomous threshold evolution:
   * When the incident rate in the window exceeds THRESHOLD_EVOLUTION_MULTIPLIER×
   * the current threshold, tighten by 1 (minimum of 1) so future surges are
   * caught sooner.
   */
  private evolveThreshold(): void {
    if (
      this.resurrectionCycles.length >=
        this.alertThreshold * SentinelMonitor.THRESHOLD_EVOLUTION_MULTIPLIER &&
      this.alertThreshold > 1
    ) {
      this.alertThreshold = Math.max(1, this.alertThreshold - 1);
      this.audit("sentinel.threshold.evolved", { newThreshold: this.alertThreshold });
    }
  }

  private audit(label: string, detail: Readonly<Record<string, unknown>>): void {
    if (!this.ledger) return;
    this.ledger.append({
      traceId: `sentinel:${label}:${this.sentinelCycle}`,
      from: "ghost-node",
      to: "ledger",
      status: "passed",
      at: this.clock(),
      detail: { sentinel: label, ...detail },
    });
  }
}
