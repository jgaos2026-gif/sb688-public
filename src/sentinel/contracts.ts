/**
 * Sentinel self-awareness contracts.
 *
 * The Sentinel layer sits above the Omega supervisor and provides
 * proactive health monitoring, anomaly detection, threat prediction,
 * adaptive decision-making, and incident learning for the Sovereign OS.
 */

/** Classified threat level emitted each sentinel cycle. */
export type ThreatLevel = "NOMINAL" | "WATCHFUL" | "ELEVATED" | "CRITICAL";

/** A single detected anomaly event. */
export interface AnomalyEvent {
  /** Stable unique identifier for this anomaly instance. */
  readonly id: string;
  /** Wall-clock instant the anomaly was detected. */
  readonly detectedAt: string;
  /** Machine-readable kind tag (e.g. "resurrection_surge", "pulse_lost"). */
  readonly kind: string;
  /** Human-readable detail for audit / alert purposes. */
  readonly detail: string;
}

/** Sentinel status report emitted every monitor cycle. */
export interface SentinelReport {
  /** Monotonic sentinel cycle counter (independent of omega cycle). */
  readonly cycle: number;
  /** Wall-clock instant this report was produced. */
  readonly detectedAt: string;
  /** Classified threat level for this cycle. */
  readonly threatLevel: ThreatLevel;
  /** All anomalies detected in this cycle. */
  readonly anomalies: readonly AnomalyEvent[];
  /** Human-readable recommended remediation action. */
  readonly recommendation: string;
  /** True when the sentinel autonomously triggered a self-healing action. */
  readonly selfHealTriggered: boolean;
  /** Running count of incidents observed since sentinel construction. */
  readonly incidentCount: number;
  /** Adaptive alert threshold currently in effect. */
  readonly alertThreshold: number;
}

/** Incident record stored for adaptive learning. */
export interface SentinelIncident {
  readonly id: string;
  readonly at: string;
  readonly kind: string;
  readonly detail: string;
  readonly omegaCycle: number;
}
