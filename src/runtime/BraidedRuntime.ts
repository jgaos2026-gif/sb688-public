import type { AuditLedger } from "../ledger/AuditLedger";
import { SpineGovernor } from "../spine/SpineGovernor";
import { LiquidTruthNodeMesh } from "../truth/LiquidTruthNodeMesh";
import { ConsciousBrick } from "../conscious/ConsciousBrick";
import { StemTriBraid } from "../stem/StemTriBraid";
import type { BrainAdapter } from "../brain/BrainAdapter";
import { DefaultBrainAdapter } from "../brain/BrainAdapter";
import { GhostNode, responseState } from "../ghost/GhostNode";
import { FailureManager } from "../failure/FailureManager";
import type { RuntimeError, RuntimeStage } from "../contracts/result";
import type { RuntimeResponse, RuntimeSnapshot, UserIntent } from "../contracts/runtime";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { makeId } from "../utils/hash";

export interface BraidedRuntimeDeps {
  readonly ledger: AuditLedger;
  readonly spine?: SpineGovernor;
  readonly truth?: LiquidTruthNodeMesh;
  readonly conscious?: ConsciousBrick;
  readonly stem?: StemTriBraid;
  readonly brain?: BrainAdapter;
  readonly ghost?: GhostNode;
  readonly clock?: Clock;
}

export class BraidedRuntime {
  private readonly ledger: AuditLedger;
  private readonly spine: SpineGovernor;
  private readonly truth: LiquidTruthNodeMesh;
  private readonly conscious: ConsciousBrick;
  private readonly stem: StemTriBraid;
  private readonly brain: BrainAdapter;
  private readonly ghost: GhostNode;
  private readonly clock: Clock;

  constructor(deps: BraidedRuntimeDeps) {
    this.ledger = deps.ledger;
    this.spine = deps.spine ?? new SpineGovernor();
    this.truth = deps.truth ?? new LiquidTruthNodeMesh();
    this.conscious = deps.conscious ?? new ConsciousBrick();
    this.stem = deps.stem ?? new StemTriBraid();
    this.brain = deps.brain ?? new DefaultBrainAdapter();
    this.clock = deps.clock ?? systemClock;
    this.ghost = deps.ghost ?? new GhostNode(this.clock);
  }

  async run(intent: UserIntent): Promise<RuntimeResponse> {
    const traceId = makeId("trace", { intent, at: this.clock() });
    let currentStage: RuntimeStage = "intent";
    let lastStableSnapshot: RuntimeSnapshot = this.snapshot(traceId, intent, currentStage, true);

    try {
      this.transition(traceId, "intent", "spine", "started", { intentId: intent.id });
      currentStage = "spine";
      const spine = this.spine.govern(intent);
      if (!spine.ok) throw spine.error;
      this.transition(traceId, "spine", "truth.pre", "passed", { spineSignature: spine.value.spineSignature });
      lastStableSnapshot = this.snapshot(traceId, intent, "spine", true);

      currentStage = "truth.pre";
      const preTruth = this.truth.validatePreBrain(intent, spine.value);
      if (!preTruth.ok) throw preTruth.error;
      this.transition(traceId, "truth.pre", "conscious-brick", "passed", { meshSignature: preTruth.value.meshSignature, confidence: preTruth.value.confidence });
      lastStableSnapshot = this.snapshot(traceId, intent, "truth.pre", true);

      currentStage = "conscious-brick";
      const conscious = this.conscious.inspect(intent, spine.value, preTruth.value);
      if (!conscious.ok) throw conscious.error;
      this.transition(traceId, "conscious-brick", "stem", "passed", { consciousSignature: conscious.value.consciousSignature });
      lastStableSnapshot = this.snapshot(traceId, intent, "conscious-brick", true);

      currentStage = "stem";
      const stem = this.stem.braid(intent, spine.value, preTruth.value, conscious.value);
      if (!stem.ok) throw stem.error;
      this.transition(traceId, "stem", "brain", "passed", { braidSignature: stem.value.braidSignature, route: stem.value.decision.route });
      lastStableSnapshot = this.snapshot(traceId, intent, "stem", true);

      currentStage = "brain";
      const brainOutput = await this.brain.speak({ intent: { id: intent.id, text: intent.text }, stem: stem.value });
      this.transition(traceId, "brain", "truth.post", "passed", { usedStemSignature: brainOutput.usedStemSignature });
      lastStableSnapshot = this.snapshot(traceId, intent, "brain", true);

      currentStage = "truth.post";
      const postTruth = this.truth.validatePostBrain(brainOutput, stem.value);
      if (!postTruth.ok) throw postTruth.error;
      this.transition(traceId, "truth.post", "ghost-node", "passed", { meshSignature: postTruth.value.meshSignature, confidence: postTruth.value.confidence });
      lastStableSnapshot = this.snapshot(traceId, intent, "truth.post", true);

      const responseWithoutCheckpoint: RuntimeResponse = {
        traceId,
        output: brainOutput.text,
        verified: true,
        auditHash: this.ledger.latestHash()
      };

      currentStage = "ghost-node";
      const checkpoint = this.ghost.checkpoint({
        traceId,
        intent,
        stage: "ghost-node",
        state: responseState(responseWithoutCheckpoint),
        label: "verified-output"
      });
      this.transition(traceId, "ghost-node", "ledger", "passed", { checkpointId: checkpoint.id, stateHash: checkpoint.stateHash });
      lastStableSnapshot = this.snapshot(traceId, intent, "ghost-node", true);

      currentStage = "ledger";
      if (!this.ledger.verifyChain()) {
        throw {
          code: "LEDGER_APPEND_FAILED",
          stage: "ledger",
          message: "Audit ledger hash chain failed verification.",
          recoverable: true
        } satisfies RuntimeError;
      }
      this.transition(traceId, "ledger", "response", "passed", { chainValid: true });

      return {
        ...responseWithoutCheckpoint,
        auditHash: this.ledger.latestHash(),
        checkpoint
      };
    } catch (cause) {
      const error = this.toRuntimeError(cause, currentStage);
      const failure = new FailureManager(this.ledger, this.truth, this.ghost, this.clock);
      return failure.recover({ traceId, intent, error, currentStage, lastStableSnapshot });
    }
  }

  private transition(
    traceId: string,
    from: RuntimeStage,
    to: RuntimeStage,
    status: "started" | "passed" | "failed" | "recovered",
    detail: Readonly<Record<string, unknown>>
  ): void {
    this.ledger.append({
      traceId,
      from,
      to,
      status,
      at: this.clock(),
      detail
    });
  }

  private snapshot(traceId: string, intent: UserIntent, stage: RuntimeStage, stable: boolean): RuntimeSnapshot {
    return {
      traceId,
      intent,
      stage,
      auditHash: this.ledger.latestHash(),
      stable
    };
  }

  private toRuntimeError(cause: unknown, currentStage: RuntimeStage): RuntimeError {
    if (this.isRuntimeError(cause)) {
      return cause;
    }

    return {
      code: currentStage === "brain" ? "BRAIN_FAILURE" : "UNKNOWN",
      stage: currentStage,
      message: cause instanceof Error ? cause.message : "Unknown runtime failure.",
      recoverable: true,
      cause
    };
  }

  private isRuntimeError(value: unknown): value is RuntimeError {
    return Boolean(
      value &&
      typeof value === "object" &&
      "code" in value &&
      "stage" in value &&
      "message" in value &&
      "recoverable" in value
    );
  }
}
