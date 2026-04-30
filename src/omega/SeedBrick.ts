import { hashOf } from "../utils/hash";
import { systemClock, type Clock } from "../utils/time";
import type { GoldenImage } from "./contracts";

/**
 * BRICK_A_SEED — Golden Image, Read Only.
 *
 * The seed is the only truth when the pulse fails. It is forged once,
 * checksum-locked, and exposed as a deep-frozen, immutable artifact.
 */
export class SeedBrick {
  public static readonly IDENT = "BRICK_A_SEED" as const;
  public static readonly STATE = "STATIC_HARDENED" as const;
  public static readonly RECOVERY_POINTER = "0x8000";

  private readonly image: GoldenImage;

  constructor(state: Readonly<Record<string, unknown>>, clock: Clock = systemClock) {
    const frozen = deepFreeze({ ...state });
    this.image = Object.freeze({
      recoveryPointer: SeedBrick.RECOVERY_POINTER,
      checksum: hashOf(frozen),
      state: frozen,
      forgedAt: clock()
    });
  }

  /** Return the read-only golden image. */
  golden(): GoldenImage {
    return this.image;
  }

  /** Verify a candidate state payload matches the sealed checksum. */
  verify(candidate: Readonly<Record<string, unknown>>): boolean {
    return hashOf(candidate) === this.image.checksum;
  }

  /** Self-check the seed has not been tampered with in memory. */
  selfCheck(): boolean {
    return hashOf(this.image.state) === this.image.checksum;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}
