import type { AuditLedger } from "../ledger/AuditLedger";
import { systemClock, type Clock } from "../utils/time";
import { makeId } from "../utils/hash";
import { SeedBrick } from "./SeedBrick";
import { GhostBrick } from "./GhostBrick";
import { ArmorBrick } from "./ArmorBrick";
import { CrownBrick } from "./CrownBrick";
import { SovereignStitch } from "./SovereignStitch";
import type {
  DriftReport,
  OmegaStatus,
  OmegaTargets,
  ResurrectionEvent,
  ShadowFrame
} from "./contracts";

const TARGETS: OmegaTargets = Object.freeze({
  coreOsRamMb: 32,
  cpuChipGb: 8,
  hardwareAgnostic: true,
  resurrectionTarget: "hardware_interrupt_speed",
  failureTolerance: "zero"
});

export interface OmegaSupervisorDeps {
  readonly seedState: Readonly<Record<string, unknown>>;
  readonly ledger?: AuditLedger;
  readonly clock?: Clock;
  readonly nowMs?: () => number;
}

/**
 * OmegaSupervisor — the Coated AI omni-directive.
 *
 *   priority:           extreme_hardened
 *   failure_tolerance:  zero
 *   resurrection_speed: hardware_interrupt_speed
 *   loop:               [Verify_Stitch -> Mirror_State -> Monitor_Drift]
 *   fail_state: kill(corrupted_brick) -> activate(ghost_shadow)
 *               -> re-stitch(clean_seed) -> signal(crown_gold_flash)
 *
 * Sits on top of the SB689 Braided Runtime and the SB688 resilience
 * vocabulary (Sovereign Spine · Brick Stitch · Ghost Node · Quarantine
 * · Trusted Restore · Verifiable Proof).
 */
export class OmegaSupervisor {
  public readonly seed: SeedBrick;
  public readonly ghost: GhostBrick;
  public readonly armor: ArmorBrick;
  public readonly crown: CrownBrick;
  public readonly stitch: SovereignStitch;

  private readonly ledger?: AuditLedger;
  private readonly clock: Clock;
  private readonly nowMs: () => number;
  private readonly resurrections: ResurrectionEvent[] = [];
  private cycle = 0;
  private lastDrift: DriftReport;

  constructor(deps: OmegaSupervisorDeps) {
    this.clock = deps.clock ?? systemClock;
    this.nowMs = deps.nowMs ?? defaultNowMs;
    this.ledger = deps.ledger;

    this.seed = new SeedBrick(deps.seedState, this.clock);
    this.ghost = new GhostBrick(this.clock, this.nowMs);
    this.armor = new ArmorBrick();
    this.crown = new CrownBrick(this.clock, "Idle");
    this.stitch = new SovereignStitch(this.seed, this.ghost, this.armor, this.crown, this.clock);

    // Prime the ghost so a pointer-flip is always available.
    this.ghost.mirror(deps.seedState);
    this.lastDrift = Object.freeze({
      drift: 0,
      pulseAlive: true,
      breach: false,
      reason: "Initialized at sealed seed."
    });
    this.crown.green("Omega supervisor armed — stable.", "Live_Sell");
    this.audit("omega.boot", { seed: this.seed.golden().checksum });
  }

  /** One supervisor tick: Verify_Stitch -> Mirror_State -> Monitor_Drift. */
  tick(args: {
    readonly liveState: Readonly<Record<string, unknown>>;
    readonly pulseAlive: boolean;
  }): OmegaStatus {
    this.cycle += 1;

    // 1) Verify_Stitch
    if (!this.stitch.verify()) {
      this.crown.red("Stitch signature invalid.", "Connect_To_Stitch");
      this.audit("omega.stitch.invalid", { cycle: this.cycle });
      return this.resurrect("BRICK_C_ARMOR", "Stitch verification failed.", args.liveState);
    }

    // 2) Mirror_State — capture the prior known-good shadow first so a
    // breach detected in this same cycle never pointer-flips to a frame
    // we just cloned from a tampered live state. Unauthorized state must
    // never re-enter the trusted chain (Whitepaper §5, SECURITY.md).
    const priorClean = this.ghost.latest();
    const frame = this.ghost.mirror(args.liveState);

    // 3) Monitor_Drift
    this.lastDrift = this.armor.measure({
      seedChecksum: this.seed.golden().checksum,
      liveState: args.liveState,
      pulseAlive: args.pulseAlive
    });

    if (this.armor.shouldResurrect(this.lastDrift)) {
      return this.resurrect("BRICK_C_ARMOR", this.lastDrift.reason, args.liveState, priorClean);
    }
    void frame;

    this.crown.green(`Cycle ${this.cycle} stable.`, "Live_Sell");
    this.audit("omega.tick.stable", { cycle: this.cycle, mirrorHash: frame.mirrorHash });
    return this.status("SB689_READY");
  }

  /** Public handle for the protocol's connect handshake. */
  connectToStitch(): { readonly message: string; readonly signature: string; readonly at: string } {
    const handshake = this.stitch.connect();
    this.audit("omega.connect", { signature: handshake.signature });
    return handshake;
  }

  resurrectionLog(): readonly ResurrectionEvent[] {
    return this.resurrections.slice();
  }

  status(state: OmegaStatus["status"] = "SB689_READY"): OmegaStatus {
    return Object.freeze({
      status: state,
      cycle: this.cycle,
      crown: this.crown.state(),
      lastDrift: this.lastDrift,
      lastResurrection: this.resurrections[this.resurrections.length - 1],
      stitch: this.stitch.current(),
      targets: TARGETS
    });
  }

  // ----- fail-state -----

  private resurrect(
    fromBrick: ResurrectionEvent["fromBrick"],
    cause: string,
    liveState: Readonly<Record<string, unknown>>,
    preFrame?: ShadowFrame
  ): OmegaStatus {
    const start = this.nowMs();

    // kill(corrupted_brick) — abandon the live pointer.
    void liveState;

    // activate(ghost_shadow) — pointer-flip to the latest mirror.
    const flip = preFrame ?? this.ghost.latest() ?? this.ghost.mirror(this.seed.golden().state);

    // re-stitch(clean_seed) — re-derive the binding chain off the sealed seed.
    this.stitch.forge();

    // signal(crown_gold_flash)
    this.crown.gold(`Resurrection: ${cause}`, "Connect_To_Stitch");

    const event: ResurrectionEvent = Object.freeze({
      id: makeId("resurrect", { cycle: this.cycle, cause, at: this.clock() }),
      at: this.clock(),
      fromBrick,
      toBrick: "BRICK_B_GHOST",
      cause,
      cleanSeedChecksum: this.seed.golden().checksum,
      ghostMirrorHash: flip.mirrorHash,
      elapsedMs: Math.max(0, this.nowMs() - start)
    });
    this.resurrections.push(event);
    this.audit("omega.resurrect", {
      id: event.id,
      cause,
      elapsedMs: event.elapsedMs,
      ghostMirrorHash: event.ghostMirrorHash
    });
    return this.status("SB689_RESURRECTING");
  }

  private audit(label: string, detail: Readonly<Record<string, unknown>>): void {
    if (!this.ledger) return;
    this.ledger.append({
      traceId: `omega:${label}`,
      from: "ghost-node",
      to: "ledger",
      status: "passed",
      at: this.clock(),
      detail: { omega: label, ...detail }
    });
  }
}

function defaultNowMs(): number {
  if (typeof globalThis !== "undefined") {
    const perf = (globalThis as { performance?: { now(): number } }).performance;
    if (perf && typeof perf.now === "function") return perf.now();
  }
  return Date.now();
}
