/**
 * TrustStateMachine — Phase 2 formal trust state enforcement.
 *
 * Governing principle: NO ACTIVE STATE BECOMES TRUSTED STATE WITHOUT VERIFICATION.
 * Recovery is not success. A recovered state becomes trusted only after
 * independent re-verification. RECOVERING → CERTIFIED is an illegal transition.
 *
 * Legal state graph:
 *
 *   UNTRUSTED  → STAGED
 *   STAGED     → VERIFYING
 *   VERIFYING  → CERTIFIED
 *   VERIFYING  → QUARANTINED
 *   VERIFYING  → REJECTED
 *   QUARANTINED→ RECOVERING
 *   RECOVERING → REVERIFYING
 *   REVERIFYING→ CERTIFIED
 *   REVERIFYING→ REJECTED
 *
 * Any other transition raises an error. State is immutable once set except
 * through the `transition()` method, which enforces the graph.
 */
export type TrustState =
  | "UNTRUSTED"
  | "STAGED"
  | "VERIFYING"
  | "CERTIFIED"
  | "QUARANTINED"
  | "RECOVERING"
  | "REVERIFYING"
  | "REJECTED";

export interface TrustTransitionRecord {
  readonly from: TrustState;
  readonly to: TrustState;
  readonly at: string;
  readonly reason: string;
}

/** Adjacency map: from → allowed targets. */
const LEGAL_TRANSITIONS: ReadonlyMap<TrustState, ReadonlySet<TrustState>> = new Map([
  ["UNTRUSTED",   new Set<TrustState>(["STAGED"])],
  ["STAGED",      new Set<TrustState>(["VERIFYING"])],
  ["VERIFYING",   new Set<TrustState>(["CERTIFIED", "QUARANTINED", "REJECTED"])],
  ["CERTIFIED",   new Set<TrustState>()],          // terminal — cannot leave without explicit reset
  ["QUARANTINED", new Set<TrustState>(["RECOVERING"])],
  ["RECOVERING",  new Set<TrustState>(["REVERIFYING"])],   // NEVER directly to CERTIFIED
  ["REVERIFYING", new Set<TrustState>(["CERTIFIED", "REJECTED"])],
  ["REJECTED",    new Set<TrustState>()],          // terminal
]);

export class IllegalTrustTransitionError extends Error {
  constructor(
    public readonly from: TrustState,
    public readonly to: TrustState,
  ) {
    super(
      `Illegal trust state transition: ${from} → ${to}. ` +
      `RECOVERING→CERTIFIED is forbidden — use RECOVERING→REVERIFYING→CERTIFIED.`,
    );
    this.name = "IllegalTrustTransitionError";
  }
}

export class TrustStateMachine {
  private _state: TrustState;
  private readonly _history: TrustTransitionRecord[] = [];
  private readonly _clock: () => string;

  constructor(
    initial: TrustState = "UNTRUSTED",
    clock: () => string = () => new Date().toISOString(),
  ) {
    this._state = initial;
    this._clock = clock;
  }

  get state(): TrustState {
    return this._state;
  }

  /** Returns an immutable snapshot of the transition history. */
  history(): readonly TrustTransitionRecord[] {
    return this._history.map((r) => Object.freeze({ ...r }));
  }

  /**
   * Attempt a state transition.
   * Throws `IllegalTrustTransitionError` if the transition is not legal.
   */
  transition(to: TrustState, reason = ""): TrustTransitionRecord {
    const allowed = LEGAL_TRANSITIONS.get(this._state);
    if (!allowed || !allowed.has(to)) {
      throw new IllegalTrustTransitionError(this._state, to);
    }

    const record: TrustTransitionRecord = Object.freeze({
      from: this._state,
      to,
      at: this._clock(),
      reason,
    });

    this._history.push(record);
    this._state = to;
    return record;
  }

  /** Returns true iff the given transition is currently legal. */
  canTransition(to: TrustState): boolean {
    return LEGAL_TRANSITIONS.get(this._state)?.has(to) ?? false;
  }

  /** Returns all states reachable from the current state in one step. */
  allowedTransitions(): readonly TrustState[] {
    return Array.from(LEGAL_TRANSITIONS.get(this._state) ?? []);
  }

  /**
   * Full recovery path: QUARANTINED → RECOVERING → REVERIFYING → CERTIFIED.
   * Calls the provided verify function between REVERIFYING and CERTIFIED.
   * Returns "CERTIFIED" if verify passes, "REJECTED" if it fails.
   */
  recoverAndReverify(
    verifyFn: () => boolean,
    quarantineReason = "corruption detected",
    recoveryReason = "recovery initiated",
    reverifyReason = "post-recovery verification",
  ): TrustState {
    if (this._state !== "QUARANTINED") {
      throw new IllegalTrustTransitionError(this._state, "RECOVERING");
    }
    this.transition("RECOVERING", recoveryReason);
    this.transition("REVERIFYING", reverifyReason);

    const passed = verifyFn();
    this.transition(passed ? "CERTIFIED" : "REJECTED",
      passed ? "re-verification passed" : "re-verification failed");
    void quarantineReason;
    return this._state;
  }

  /** Reset to UNTRUSTED (e.g., for a new transaction cycle). */
  reset(): void {
    this._state = "UNTRUSTED";
  }
}

/** Convenience: build and return legal-transitions map (for external inspection). */
export function legalTransitions(): ReadonlyMap<TrustState, ReadonlySet<TrustState>> {
  return LEGAL_TRANSITIONS;
}
