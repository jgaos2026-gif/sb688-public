import type { BrainOutput, StemPacket, UserIntent } from "../contracts/runtime";

export interface BrainAdapterInput {
  readonly intent: Pick<UserIntent, "id" | "text">;
  readonly stem: StemPacket;
}

export interface BrainAdapter {
  speak(input: BrainAdapterInput): Promise<BrainOutput> | BrainOutput;
}

export class DefaultBrainAdapter implements BrainAdapter {
  speak(input: BrainAdapterInput): BrainOutput {
    const { intent, stem } = input;

    if (/force-brain-failure/i.test(intent.text)) {
      throw new Error("Synthetic Brain failure requested by test/demo input.");
    }

    const response = stem.decision.route === "answer"
      ? this.answer(intent.text, stem)
      : stem.decision.route === "clarify"
        ? "The governed route is clarify: please provide a more specific target, constraint, or desired output shape."
        : "The governed route is refuse: the request could not pass the braided governance checks.";

    return {
      text: response,
      adapterOnly: true,
      usedStemSignature: stem.braidSignature,
      probabilisticTrace: {
        name: "brain.route.selection",
        tolerance: 1e-6,
        points: [
          { label: stem.decision.route, probability: 0.82 },
          { label: "alternate", probability: 0.18 }
        ]
      }
    };
  }

  private answer(text: string, stem: StemPacket): string {
    const memoryLine = stem.memory.recalled.length > 0
      ? `Memory braid recalled: ${stem.memory.recalled.join(" | ")}`
      : "Memory braid recalled no prior facts.";

    return [
      "SB689 braided runtime execution completed through the approved route.",
      `Decision braid: ${stem.decision.rationale}`,
      memoryLine,
      `Personality braid: ${stem.personality.tone}; ${stem.personality.styleRules.join(", ")}.`,
      `Adapter response: ${text.trim()}`
    ].join("\n");
  }
}
