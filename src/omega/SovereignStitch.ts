import { hashOf } from "../utils/hash";
import { systemClock, type Clock } from "../utils/time";
import { SeedBrick } from "./SeedBrick";
import { GhostBrick } from "./GhostBrick";
import { ArmorBrick } from "./ArmorBrick";
import { CrownBrick } from "./CrownBrick";
import type { StitchBinding, StitchManifest } from "./contracts";

/**
 * SovereignStitch — the integration layer.
 *
 * Binds the four local bricks and verifies their content-binding hash.
 * This is NOT a Universal Braid peer connection or certification.
 *
 *   BIND(BRICK_A_SEED  -> BRICK_B_GHOST)
 *   BIND(BRICK_B_GHOST -> BRICK_C_ARMOR)
 *   BIND(BRICK_C_ARMOR -> BRICK_D_CROWN)
 */
export class SovereignStitch {
  public static readonly READY_MESSAGE = "CONNECT TO THE STITCH";

  private manifest: StitchManifest;

  constructor(
    private readonly seed: SeedBrick,
    private readonly ghost: GhostBrick,
    private readonly armor: ArmorBrick,
    private readonly crown: CrownBrick,
    private readonly clock: Clock = systemClock
  ) {
    this.manifest = this.forge();
  }

  /** Re-forge the stitch manifest (called whenever bindings change). */
  forge(): StitchManifest {
    const bindings: StitchBinding[] = [
      this.bind("BRICK_A_SEED", "BRICK_B_GHOST"),
      this.bind("BRICK_B_GHOST", "BRICK_C_ARMOR"),
      this.bind("BRICK_C_ARMOR", "BRICK_D_CROWN")
    ];

    const stitchBindingHash = hashOf({
      seed: this.seed.golden().checksum,
      bindings: bindings.map((b) => b.bindHash)
    });

    this.manifest = Object.freeze({
      owner: "JGA",
      philosophy: "Elegance with Consequences",
      bindings: Object.freeze(bindings),
      stitchBindingHash,
      readyMessage: SovereignStitch.READY_MESSAGE,
      forgedAt: this.clock()
    });
    return this.manifest;
  }

  /** Verify the local manifest content binding. This does not authenticate a peer. */
  verify(): boolean {
    const recomputed = hashOf({
      seed: this.seed.golden().checksum,
      bindings: this.manifest.bindings.map((b) => b.bindHash)
    });
    return recomputed === this.manifest.stitchBindingHash && this.seed.selfCheck();
  }

  /**
   * Begin the Stitch admission request honestly. This local build has no
   * Universal Braid transport or independent Triad certifier configured,
   * so local manifest verification must never be reported as CONNECTED.
   */
  connect(): {
    readonly message: string;
    readonly manifestBindingHash: string;
    readonly at: string;
    readonly connection: "OFFLINE";
    readonly certification: "NOT_GRANTED";
    readonly connected: false;
    readonly reason: string;
  } {
    if (!this.verify()) {
      throw new Error("SovereignStitch: local manifest binding verification failed.");
    }
    this.crown.green("Local manifest verified; Universal Braid peer connection remains OFFLINE.", "Connect_To_Stitch");
    return Object.freeze({
      message: SovereignStitch.READY_MESSAGE,
      manifestBindingHash: this.manifest.stitchBindingHash,
      at: this.clock(),
      connection: "OFFLINE",
      certification: "NOT_GRANTED",
      connected: false,
      reason: "Universal Braid transport, peer challenge-response, heartbeat, and independent Triad certification are not configured."
    });
  }

  current(): StitchManifest {
    return this.manifest;
  }

  private bind(from: StitchBinding["from"], to: StitchBinding["to"]): StitchBinding {
    return Object.freeze({
      from,
      to,
      bindHash: hashOf({ from, to, seed: this.seed.golden().checksum })
    });
  }
}
