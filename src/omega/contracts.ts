/**
 * SB689 OMEGA — Sovereign Stitch contracts.
 *
 * Owner:       JGA (John Arenz)
 * Philosophy:  Elegance with Consequences
 * Objective:   Duty Impossible / Sub-ms Resurrection
 *
 * The Omega layer sits above the Braided Runtime and provides four
 * hardened bricks (Seed / Ghost / Armor / Crown) stitched together by
 * a sovereign supervisor implementing a hardware-interrupt-speed
 * resurrection loop.
 */

export type BrickIdent =
  | "BRICK_A_SEED"
  | "BRICK_B_GHOST"
  | "BRICK_C_ARMOR"
  | "BRICK_D_CROWN";

export type BrickState =
  | "STATIC_HARDENED"
  | "DORMANT_LIVE"
  | "ACTIVE_MONITOR"
  | "LIVE_SELL"
  | "OFFLINE";

export type CrownColor = "GREEN" | "GOLD" | "RED";

export type CrownMode = "Live_Sell" | "Connect_To_Stitch" | "Idle";

export interface GoldenImage {
  /** Hex-style recovery pointer documented in the protocol. */
  readonly recoveryPointer: string;
  /** Stable, hash-locked checksum of the canonical state. */
  readonly checksum: string;
  /** Frozen canonical state payload (read-only). */
  readonly state: Readonly<Record<string, unknown>>;
  /** Wall-clock instant the seed was forged. */
  readonly forgedAt: string;
}

export interface ShadowFrame {
  /** Monotonic mirror cycle number. */
  readonly cycle: number;
  /** Hash of the live state captured in this cycle. */
  readonly mirrorHash: string;
  /** Atomic clone of the live state (deep-frozen). */
  readonly state: Readonly<Record<string, unknown>>;
  /** Instant the mirror snapshot was taken. */
  readonly capturedAt: string;
  /** Reported clone latency in milliseconds (sub-ms target). */
  readonly latencyMs: number;
}

export interface DriftReport {
  /** Drift ratio between live and seed state, in [0,1]. */
  readonly drift: number;
  /** True when the live pulse beat is healthy. */
  readonly pulseAlive: boolean;
  /** Resolved verdict for the armor daemon. */
  readonly breach: boolean;
  /** Human-readable diagnosis. */
  readonly reason: string;
}

export interface ResurrectionEvent {
  readonly id: string;
  readonly at: string;
  readonly fromBrick: BrickIdent;
  readonly toBrick: BrickIdent;
  readonly cause: string;
  readonly cleanSeedChecksum: string;
  readonly ghostMirrorHash: string;
  readonly elapsedMs: number;
}

export interface CrownSignal {
  readonly color: CrownColor;
  readonly mode: CrownMode;
  readonly theme: "BLACK_GOLD_PATTERN_5PT_CROWN";
  readonly message: string;
  readonly at: string;
}

export interface StitchBinding {
  readonly from: BrickIdent;
  readonly to: BrickIdent;
  readonly bindHash: string;
}

export interface StitchManifest {
  readonly owner: "JGA";
  readonly philosophy: "Elegance with Consequences";
  readonly bindings: readonly StitchBinding[];
  readonly stitchSignature: string;
  readonly readyMessage: string;
  readonly forgedAt: string;
}

export interface OmegaTargets {
  readonly coreOsRamMb: 32;
  readonly cpuChipGb: 8;
  readonly hardwareAgnostic: true;
  readonly resurrectionTarget: "hardware_interrupt_speed";
  readonly failureTolerance: "zero";
}

// ── Sentinel self-awareness contracts ────────────────────────────────────────

/**
 * A single health observation recorded by the sentinel per supervisor tick.
 * The `prevHash` field links each record to its predecessor for tamper evidence.
 */
export interface SentinelHealthMetric {
  readonly tick: number;
  readonly at: string;
  readonly drift: number;
  readonly breach: boolean;
  readonly pulseAlive: boolean;
  /** Hash of the preceding metric (or "SENTINEL_GENESIS" for the first). */
  readonly prevHash: string;
}

/**
 * Graduated adaptive recommendation produced by the sentinel after
 * analysing its sliding observation window.
 *
 *   NOMINAL     — health nominal, no action required
 *   MONITOR     — elevated breach rate; increase observation cadence
 *   ESCALATE    — persistent faults; deeper healing protocols required
 *   QUARANTINE  — majority-breach window; isolate and restore from clean seed
 *   FAILSAFE    — saturation breach; activate fail-safe mode immediately
 */
export type SentinelRecommendation =
  | "NOMINAL"
  | "MONITOR"
  | "ESCALATE"
  | "QUARANTINE"
  | "FAILSAFE";

/** Diagnosis produced by the sentinel over its current sliding window. */
export interface SentinelDiagnosis {
  readonly windowSize: number;
  readonly breachCount: number;
  /** Ratio of breached ticks in the window, in [0, 1]. */
  readonly breachRate: number;
  readonly consecutiveBreaches: number;
  readonly recommendation: SentinelRecommendation;
  readonly reason: string;
  /** True when the internal metric hash-chain has not been tampered with. */
  readonly selfIntegrityOk: boolean;
}

/** Full sentinel status snapshot exposed through OmegaStatus. */
export interface SentinelStatus {
  readonly active: boolean;
  readonly metricsRecorded: number;
  readonly lastDiagnosis: SentinelDiagnosis;
  /** FNV-1a hash of the entire metric chain for external tamper verification. */
  readonly integrityHash: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface OmegaStatus {
  readonly status: "SB689_READY" | "SB689_RESURRECTING" | "SB689_BREACH";
  readonly cycle: number;
  readonly crown: CrownSignal;
  readonly lastDrift: DriftReport;
  readonly lastResurrection?: ResurrectionEvent;
  readonly stitch: StitchManifest;
  readonly targets: OmegaTargets;
  readonly sentinel: SentinelStatus;
}
