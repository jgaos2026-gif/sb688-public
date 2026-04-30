import type { Result } from "../contracts/result";
import { ok } from "../contracts/result";
import type { ConsciousReport, SpinePermit, StemPacket, TruthReport, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";
import { DecisionRouter } from "./DecisionRouter";
import { MemoryRouter } from "./MemoryRouter";
import { PersonalityRouter } from "./PersonalityRouter";

export class StemTriBraid {
  constructor(
    private readonly decision = new DecisionRouter(),
    private readonly memory = new MemoryRouter([
      "SB689 requires Spine governance before execution.",
      "SB688 contributes braided Decision, Memory, and Personality routing.",
      "Brain must be a voice adapter, not the governing authority."
    ]),
    private readonly personality = new PersonalityRouter()
  ) {}

  braid(intent: UserIntent, permit: SpinePermit, truth: TruthReport, conscious: ConsciousReport): Result<StemPacket> {
    const decision = this.decision.route(intent, permit, truth, conscious);
    const memory = this.memory.recall(intent);
    const personality = this.personality.frame(intent);

    return ok({
      decision,
      memory,
      personality,
      braidSignature: hashOf({ decision, memory, personality, permit: permit.spineSignature, truth: truth.meshSignature, conscious: conscious.consciousSignature })
    });
  }
}
