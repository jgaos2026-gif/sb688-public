import { gzipSync, gunzipSync } from "node:zlib";
import { hashOf } from "../utils/hash";

export interface StitchCapsule {
  readonly version: 1;
  readonly codec: "gzip+base64";
  readonly payload: string;
  readonly stitchHash: string;
  readonly memoryHash: string;
  readonly capsuleHash: string;
  readonly uncompressedBytes: number;
  readonly compressedBytes: number;
}

export interface RecoveryResult {
  readonly success: boolean;
  readonly state: Readonly<Record<string, unknown>>;
  readonly discardedLiveKeys: number;
  readonly trusted: false;
  readonly requiresHealthyScan: true;
  readonly elapsedMs: number;
  readonly reason?: string;
}

export interface HealthyScanResult {
  readonly healthy: boolean;
  readonly verified: boolean;
  readonly validated: boolean;
  readonly corruptionDetected: boolean;
}

export class StitchRecoveryCapsule {
  /**
   * Seal only pre-programmed Stitch control state plus explicitly usable memory.
   * Memory cannot override Stitch keys. Undefined, functions, symbols, bigint,
   * non-finite numbers, and non-serializable values are dropped.
   */
  static seal(
    stitchState: Readonly<Record<string, unknown>>,
    memoryState: Readonly<Record<string, unknown>> = {}
  ): StitchCapsule {
    const memory: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(memoryState)) {
      if (key in stitchState) continue;
      if (!this.isUsable(value)) continue;
      memory[key] = value;
    }

    const content = Object.freeze({
      stitch: Object.freeze({ ...stitchState }),
      memory: Object.freeze(memory)
    });
    const raw = JSON.stringify(content);
    const compressed = gzipSync(Buffer.from(raw, "utf8"));
    const payload = compressed.toString("base64");
    const stitchHash = hashOf(content.stitch);
    const memoryHash = hashOf(content.memory);
    const capsuleHash = hashOf({ version: 1, stitchHash, memoryHash, payload });

    return Object.freeze({
      version: 1,
      codec: "gzip+base64",
      payload,
      stitchHash,
      memoryHash,
      capsuleHash,
      uncompressedBytes: Buffer.byteLength(raw, "utf8"),
      compressedBytes: compressed.byteLength
    });
  }

  /**
   * Recovery is destructive toward the unhealthy live state: it is not merged,
   * repaired, or partially salvaged. The recovered state is reconstructed only
   * from the sealed capsule and remains untrusted until a healthy scan occurs.
   */
  static recover(
    liveState: Readonly<Record<string, unknown>>,
    capsule: StitchCapsule,
    nowMs: () => number = () => performance.now()
  ): RecoveryResult {
    const started = nowMs();
    const discardedLiveKeys = Object.keys(liveState).length;

    try {
      const expectedCapsuleHash = hashOf({
        version: capsule.version,
        stitchHash: capsule.stitchHash,
        memoryHash: capsule.memoryHash,
        payload: capsule.payload
      });
      if (expectedCapsuleHash !== capsule.capsuleHash) throw new Error("capsule_hash_mismatch");

      const raw = gunzipSync(Buffer.from(capsule.payload, "base64")).toString("utf8");
      const decoded = JSON.parse(raw) as {
        stitch?: Record<string, unknown>;
        memory?: Record<string, unknown>;
      };
      const stitch = decoded.stitch ?? {};
      const memory = decoded.memory ?? {};

      if (hashOf(stitch) !== capsule.stitchHash) throw new Error("stitch_hash_mismatch");
      if (hashOf(memory) !== capsule.memoryHash) throw new Error("memory_hash_mismatch");

      // Pre-programmed Stitch values always win over remembered data.
      const state = Object.freeze({ ...memory, ...stitch });

      return Object.freeze({
        success: true,
        state,
        discardedLiveKeys,
        trusted: false,
        requiresHealthyScan: true,
        elapsedMs: Math.max(0, nowMs() - started)
      });
    } catch (error) {
      return Object.freeze({
        success: false,
        state: Object.freeze({}),
        discardedLiveKeys,
        trusted: false,
        requiresHealthyScan: true,
        elapsedMs: Math.max(0, nowMs() - started),
        reason: error instanceof Error ? error.message : "recovery_failed"
      });
    }
  }

  /**
   * Mint the next capsule only from the first post-recovery scan that is clean,
   * independently verified, and validated. A failed or corrupt scan cannot
   * produce a replacement capsule.
   */
  static renewAfterHealthyScan(
    recoveredState: Readonly<Record<string, unknown>>,
    scan: HealthyScanResult,
    memoryState: Readonly<Record<string, unknown>> = {}
  ): StitchCapsule | null {
    if (!scan.healthy || !scan.verified || !scan.validated || scan.corruptionDetected) {
      return null;
    }
    return this.seal(recoveredState, memoryState);
  }

  private static isUsable(value: unknown): boolean {
    if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
      return false;
    }
    if (typeof value === "number" && !Number.isFinite(value)) return false;
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }
}
