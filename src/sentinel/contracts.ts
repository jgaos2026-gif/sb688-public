/**
 * SentinelLayer contracts — self-awareness types for the SB688/SB689 Sovereign OS.
 *
 * Owner:      JGA (John Arenz)
 * Philosophy: Elegance with Consequences
 *
 * The sentinel layer sits above the Braided Runtime and provides proactive
 * self-monitoring, anomaly detection, braided ethical logic, ghost shadow
 * mirroring, and an omega resurrection loop — integrating seamlessly with
 * the existing spine ledger and healing mechanisms.
 */

export type SentinelStatus =
  | "SENTINEL_ARMED"
  | "SENTINEL_WATCHING"
  | "SENTINEL_ANOMALY"
  | "SENTINEL_RESURRECTING"
  | "SENTINEL_EVOLVED"
  | "SENTINEL_BREACH";

export type AlertLevel = "INFO" | "WARNING" | "HIGH" | "CRITICAL" | "FAULT" | "RESURRECTION";

/** A tamper-evident alert emitted by the sentinel. */
export interface SentinelAlert {
  readonly id: string;
  readonly level: AlertLevel;
  readonly message: string;
  readonly at: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

/**
 * Braided ethical judgment produced by personality · moral · judgment routing.
 * Guardian personality prioritises protection of ledger integrity.
 */
export interface BraidedJudgment {
  readonly action: "rollback" | "restart" | "quarantine" | "resurrect" | "heal" | "alert";
  readonly moralScore: number;
  readonly personality: string;
  readonly reasoning: string;
  readonly at: string;
}

/** A single ghost shadow frame captured by the sentinel before potential drift. */
export interface SentinelShadowFrame {
  readonly cycle: number;
  readonly hash: string;
  readonly capturedAt: string;
  readonly state: Readonly<Record<string, unknown>>;
}

/** Result of one sentinel watch cycle. */
export interface SentinelWatchReport {
  readonly status: SentinelStatus;
  readonly frameCycle: number;
  readonly frameHash: string;
  readonly anomaly: boolean;
  readonly anomalyScore: number;
  readonly predictedThreat: string | null;
  readonly chainValid: boolean;
}

/** A hardening recommendation derived from incident memory. */
export interface SentinelRecommendation {
  readonly component: string;
  readonly action: string;
  readonly reason: string;
}

/** Result of the autonomous-evolution adaptation pass. */
export interface SentinelAdaptReport {
  readonly recommendations: readonly SentinelRecommendation[];
  readonly evolved: boolean;
  readonly incidentsAnalyzed: number;
}

/** Record of a single sentinel omega resurrection event. */
export interface SentinelResurrectionEvent {
  readonly id: number;
  readonly cause: string;
  readonly at: string;
  readonly ghostFrameHash: string | null;
}

/** Complete sentinel status snapshot. */
export interface SentinelFullReport {
  readonly status: SentinelStatus;
  readonly armed: boolean;
  readonly watch: SentinelWatchReport;
  readonly adaptation: SentinelAdaptReport;
  readonly alertCount: number;
  readonly resurrectionCount: number;
  readonly incidentCount: number;
  readonly judgmentCount: number;
}

// ── SentinelMonitor contracts ─────────────────────────────────────────────────

/** Classified threat level emitted each sentinel monitor cycle. */
export type ThreatLevel = "NOMINAL" | "WATCHFUL" | "ELEVATED" | "CRITICAL";

/** A single detected anomaly event recorded by the SentinelMonitor. */
export interface AnomalyEvent {
  /** Stable unique identifier for this anomaly instance. */
  readonly id: string;
  /** Wall-clock instant the anomaly was detected. */
  readonly detectedAt: string;
  /** Machine-readable kind tag (e.g. "resurrection_event", "pulse_lost"). */
  readonly kind: string;
  /** Human-readable detail for audit / alert purposes. */
  readonly detail: string;
}

/** Sentinel monitor report emitted every monitor cycle. */
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

/** Incident record stored for adaptive learning by SentinelMonitor. */
export interface SentinelIncident {
  readonly id: string;
  readonly at: string;
  readonly kind: string;
  readonly detail: string;
  readonly omegaCycle: number;
}
