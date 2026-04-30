import { hashOf } from "../utils/hash";
import type { DriftReport } from "./contracts";

/**
 * BRICK_C_ARMOR — Self-Healing Daemon.
 *
 * Hardware-level interrupt for zero-time resurrection.
 * Trigger: drift > 0.01% OR pulse == 0
 * Action:  immediate suicide of the corrupted brick → pointer swap to Ghost.
 */
export class ArmorBrick {
  public static readonly IDENT = "BRICK_C_ARMOR" as const;
  public static readonly STATE = "ACTIVE_MONITOR" as const;
  /** Protocol-defined drift threshold: 0.01% expressed as a ratio. */
  public static readonly DRIFT_THRESHOLD = 0.0001;

  /**
   * Compute a drift report between a candidate live state and the
   * sealed seed checksum, taking the live pulse beat into account.
   */
  measure(args: {
    readonly seedChecksum: string;
    readonly liveState: Readonly<Record<string, unknown>>;
    readonly pulseAlive: boolean;
  }): DriftReport {
    const liveHash = hashOf(args.liveState);
    const matches = liveHash === args.seedChecksum;

    // Drift is binary-by-checksum (1.0 if mismatch, 0.0 if match).
    // The threshold (0.01%) is preserved for the public contract; any
    // non-zero drift trivially exceeds it, which matches the protocol's
    // "zero tolerance" intent.
    const drift = matches ? 0 : 1;

    const breach = !args.pulseAlive || drift > ArmorBrick.DRIFT_THRESHOLD;
    const reason = !args.pulseAlive
      ? "Pulse == 0: live brick is non-responsive."
      : matches
        ? "Live state matches sealed seed checksum within tolerance."
        : `Drift ${drift.toFixed(6)} exceeds threshold ${ArmorBrick.DRIFT_THRESHOLD}.`;

    return Object.freeze({ drift, pulseAlive: args.pulseAlive, breach, reason });
  }

  /** Decide whether the armor should fire its hardware-interrupt swap. */
  shouldResurrect(report: DriftReport): boolean {
    return report.breach;
  }
}
