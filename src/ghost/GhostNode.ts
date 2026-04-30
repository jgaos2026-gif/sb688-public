import type { GhostCheckpoint, RuntimeResponse, UserIntent } from "../contracts/runtime";
import type { RuntimeStage } from "../contracts/result";
import type { Clock } from "../utils/time";
import { systemClock } from "../utils/time";
import { hashOf, makeId } from "../utils/hash";

export class GhostNode {
  private readonly checkpoints: GhostCheckpoint[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  checkpoint(args: {
    readonly traceId: string;
    readonly intent: UserIntent;
    readonly stage: RuntimeStage;
    readonly state: unknown;
    readonly label: GhostCheckpoint["label"];
  }): GhostCheckpoint {
    const createdAt = this.clock();
    const stateHash = hashOf(args.state);
    const checkpoint: GhostCheckpoint = Object.freeze({
      id: makeId("ghost", { traceId: args.traceId, intentId: args.intent.id, createdAt, stateHash, label: args.label }),
      intentId: args.intent.id,
      createdAt,
      stage: args.stage,
      stateHash,
      label: args.label
    });

    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  all(): readonly GhostCheckpoint[] {
    return this.checkpoints.map((checkpoint) => Object.freeze({ ...checkpoint }));
  }

  latestFor(intentId: string): GhostCheckpoint | undefined {
    return [...this.checkpoints].reverse().find((checkpoint) => checkpoint.intentId === intentId);
  }
}

export function responseState(response: RuntimeResponse): unknown {
  return {
    traceId: response.traceId,
    output: response.output,
    verified: response.verified,
    auditHash: response.auditHash
  };
}
