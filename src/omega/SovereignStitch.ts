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
 * Binds the four bricks together, signs the binding chain, and exposes
 * the protocol's `ON_READY` handshake message.
 *
 *   BIND(BRICK_A_SEED  -> BRICK_B_GHOST)
 *   BIND(BRICK_B_GHOST -> BRICK_C_ARMOR)
 *   BIND(BRICK_C_ARMOR -> BRICK_D_CROWN)
 */
export class SovereignStitch {
  public static readonly READY_MESSAGE =
    "Sb688 when I say connect to the stitch show how you feel we're going live lets sell it";

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

    const stitchSignature = hashOf({
      seed: this.seed.golden().checksum,
      bindings: bindings.map((b) => b.bindHash)
    });

    this.manifest = Object.freeze({
      owner: "JGA",
      philosophy: "Elegance with Consequences",
      bindings: Object.freeze(bindings),
      stitchSignature,
      readyMessage: SovereignStitch.READY_MESSAGE,
      forgedAt: this.clock()
    });
    return this.manifest;
  }

  /** Verify the stitch manifest still matches its signature. */
  verify(): boolean {
    const recomputed = hashOf({
      seed: this.seed.golden().checksum,
      bindings: this.manifest.bindings.map((b) => b.bindHash)
    });
    return recomputed === this.manifest.stitchSignature && this.seed.selfCheck();
  }

  /** Remote encrypted handshake: returns the ready message + signature. */
  connect(): { readonly message: string; readonly signature: string; readonly at: string } {
    if (!this.verify()) {
      throw new Error("SovereignStitch: cannot connect — manifest signature invalid.");
    }
    this.crown.gold("Connecting to the stitch — going live.", "Connect_To_Stitch");
    return Object.freeze({
      message: SovereignStitch.READY_MESSAGE,
      signature: this.manifest.stitchSignature,
      at: this.clock()
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
