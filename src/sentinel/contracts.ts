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
