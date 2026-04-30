import { hashOf } from "../utils/hash";
import { systemClock, type Clock } from "../utils/time";
import type { ShadowFrame } from "./contracts";

/**
 * BRICK_B_GHOST — Shadow Mirror Protocol.
 *
 * Maintains an atomic clone of the live state every cycle. The latest
 * shadow frame is the pointer-flip target the armor daemon swaps to
 * during sub-ms resurrection.
 */
export class GhostBrick {
  public static readonly IDENT = "BRICK_B_GHOST" as const;
  public static readonly STATE = "DORMANT_LIVE" as const;
  public static readonly TARGET_LATENCY_MS = 0.0001;

  private readonly frames: ShadowFrame[] = [];
  private cycleCounter = 0;

  constructor(
    private readonly clock: Clock = systemClock,
    private readonly nowMs: () => number = defaultNowMs,
    private readonly maxFrames: number = 8
  ) {}

  /** Atomically clone the supplied live state into a new shadow frame. */
  mirror(liveState: Readonly<Record<string, unknown>>): ShadowFrame {
    const start = this.nowMs();
    const cloned = deepClone(liveState);
    const frozen = deepFreeze(cloned);
    const latencyMs = Math.max(0, this.nowMs() - start);

    this.cycleCounter += 1;
    const frame: ShadowFrame = Object.freeze({
      cycle: this.cycleCounter,
      mirrorHash: hashOf(frozen),
      state: frozen,
      capturedAt: this.clock(),
      latencyMs
    });

    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.splice(0, this.frames.length - this.maxFrames);
    }
    return frame;
  }

  /** Latest shadow frame, or undefined if no mirror has run yet. */
  latest(): ShadowFrame | undefined {
    return this.frames[this.frames.length - 1];
  }

  /** Return the bounded ring of shadow frames. */
  history(): readonly ShadowFrame[] {
    return this.frames.slice();
  }

  /** Pointer-flip: hand back the most recent frame for resurrection. */
  pointerFlip(): ShadowFrame {
    const frame = this.latest();
    if (!frame) {
      throw new Error("GhostBrick: pointer flip requested before any mirror cycle.");
    }
    return frame;
  }
}

function defaultNowMs(): number {
  if (typeof globalThis !== "undefined") {
    const perf = (globalThis as { performance?: { now(): number } }).performance;
    if (perf && typeof perf.now === "function") return perf.now();
  }
  return Date.now();
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}
