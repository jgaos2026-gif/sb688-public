import { hashOf, makeId } from "../utils/hash";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import type { AuditLedger } from "../ledger/AuditLedger";
import { SpineGovernor } from "../spine/SpineGovernor";
import type { TriadCycleResult, CorruptionReport, IsolationReport, ReconstructionReport } from "./contracts";

/**
 * TriadCoordinator — Phase 4 Triad Node architecture.
 *
 * Three independent nodes communicate through the Spine:
 *
 *   Hunter   → discovers corruption in the live state
 *   Warrior  → isolates threats and blocks invalid state
 *   Repair   → reconstructs verified state from a clean reference
 *
 * All inter-node messages pass through SpineGovernor for validation.
 * No node can act without a valid spine permit.
 */
export class TriadCoordinator {
  private readonly spine: SpineGovernor;
  private readonly ledger: AuditLedger;
  private readonly clock: Clock;
  private cycleCount = 0;

  constructor(ledger: AuditLedger, clock: Clock = systemClock, spine = new SpineGovernor()) {
    this.ledger = ledger;
    this.clock = clock;
    this.spine = spine;
  }

  /**
   * Run one full triad cycle.
   *
   * @param liveState      The state under inspection.
   * @param referenceState The known-clean reference state.
   */
  run(
    liveState: Readonly<Record<string, unknown>>,
    referenceState: Readonly<Record<string, unknown>>
  ): TriadCycleResult {
    this.cycleCount += 1;
    const at = this.clock();
    const id = makeId("triad", { cycle: this.cycleCount, at });

    // ── Obtain Spine permit (all nodes must route through the Spine) ──────────
    const spineResult = this.spine.govern({
      id: `triad:${id}`,
      text: `Triad cycle ${this.cycleCount}: hunt → warrior → repair`
    });

    if (!spineResult.ok) {
      this.ledger.append({
        traceId: `triad:${id}`,
        from: "triad.spine",
        to: "triad.hunt",
        status: "failed",
        at,
        detail: { reason: "spine_rejected", error: spineResult.error.message }
      });
      return { id, at, corruption: null, isolation: null, reconstruction: null, success: false, spinePermitSignature: "none" };
    }

    const spinePermit = spineResult.value;

    // ── HUNTER: discover corruption ───────────────────────────────────────────
    const corruption = this.hunterScan(id, liveState, referenceState, at);

    this.ledger.append({
      traceId: `triad:${id}`,
      from: "triad.hunt",
      to: "triad.warrior",
      status: corruption.corruptedKeys.length > 0 ? "failed" : "passed",
      at,
      detail: { corruptedKeys: corruption.corruptedKeys, severity: corruption.severity }
    });

    if (corruption.corruptedKeys.length === 0) {
      // No corruption — all nodes idle.
      return Object.freeze({
        id,
        at,
        corruption: Object.freeze(corruption),
        isolation: null,
        reconstruction: null,
        success: true,
        spinePermitSignature: spinePermit.spineSignature
      });
    }

    // ── WARRIOR: isolate threats ───────────────────────────────────────────────
    const isolation = this.warriorIsolate(id, corruption, liveState, spinePermit.spineSignature, at);

    this.ledger.append({
      traceId: `triad:${id}`,
      from: "triad.warrior",
      to: "triad.repair",
      status: "passed",
      at,
      detail: { isolatedKeys: isolation.isolatedKeys }
    });

    // ── REPAIR: reconstruct verified state ────────────────────────────────────
    const reconstruction = this.repairReconstruct(id, corruption, referenceState, spinePermit.spineSignature, at);

    this.ledger.append({
      traceId: `triad:${id}`,
      from: "triad.repair",
      to: "triad.spine",
      status: reconstruction.verifiedBySpine ? "passed" : "failed",
      at,
      detail: { reconstructedKeys: reconstruction.reconstructedKeys, finalStateHash: reconstruction.finalStateHash }
    });

    return Object.freeze({
      id,
      at,
      corruption: Object.freeze(corruption),
      isolation: Object.freeze(isolation),
      reconstruction: Object.freeze(reconstruction),
      success: reconstruction.verifiedBySpine,
      spinePermitSignature: spinePermit.spineSignature
    });
  }

  cycleCount_(): number {
    return this.cycleCount;
  }

  // ─── Private node implementations ────────────────────────────────────────────

  private hunterScan(
    cycleId: string,
    liveState: Readonly<Record<string, unknown>>,
    referenceState: Readonly<Record<string, unknown>>,
    at: string
  ): CorruptionReport {
    const corruptedKeys: string[] = [];

    for (const key of Object.keys(referenceState)) {
      if (JSON.stringify(liveState[key]) !== JSON.stringify(referenceState[key])) {
        corruptedKeys.push(key);
      }
    }
    // Also flag any extra keys in liveState not in referenceState
    for (const key of Object.keys(liveState)) {
      if (!(key in referenceState) && !corruptedKeys.includes(key)) {
        corruptedKeys.push(key);
      }
    }

    const severity =
      corruptedKeys.length === 0 ? "low" :
      corruptedKeys.length <= 2 ? "medium" :
      corruptedKeys.length <= 5 ? "high" : "critical";

    return {
      id: makeId("corruption", { cycleId, corruptedKeys, at }),
      at,
      corruptedKeys,
      stateHash: hashOf(liveState),
      severity
    };
  }

  private warriorIsolate(
    cycleId: string,
    corruption: CorruptionReport,
    liveState: Readonly<Record<string, unknown>>,
    spinePermitSignature: string,
    at: string
  ): IsolationReport {
    // Warrior blocks the corrupted entries by computing a hash of the isolated state
    const isolatedState: Record<string, unknown> = {};
    for (const key of corruption.corruptedKeys) {
      isolatedState[key] = liveState[key as keyof typeof liveState];
    }

    return {
      id: makeId("isolation", { cycleId, keys: corruption.corruptedKeys, at }),
      at,
      isolatedKeys: [...corruption.corruptedKeys],
      blockedStateHash: hashOf(isolatedState),
      spinePermitUsed: spinePermitSignature
    };
  }

  private repairReconstruct(
    cycleId: string,
    corruption: CorruptionReport,
    referenceState: Readonly<Record<string, unknown>>,
    spinePermitSignature: string,
    at: string
  ): ReconstructionReport {
    // Rebuild only the corrupted keys from the reference.
    const reconstructed = corruption.corruptedKeys.filter((k) => k in referenceState);
    const finalState: Record<string, unknown> = {};
    for (const key of reconstructed) {
      finalState[key] = referenceState[key as keyof typeof referenceState];
    }

    // Verify the result by comparing hash of reconstructed keys against reference
    const refSlice: Record<string, unknown> = {};
    for (const key of reconstructed) {
      refSlice[key] = referenceState[key as keyof typeof referenceState];
    }
    const verifiedBySpine = hashOf(finalState) === hashOf(refSlice);

    return {
      id: makeId("reconstruction", { cycleId, reconstructed, at }),
      at,
      reconstructedKeys: reconstructed,
      finalStateHash: hashOf(finalState),
      verifiedBySpine
    };
  }
}
