import type { MemoryContext, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";

export class MemoryRouter {
  private readonly facts: readonly string[];

  constructor(facts: readonly string[] = []) {
    this.facts = facts;
  }

  recall(intent: UserIntent): MemoryContext {
    const tokens = new Set(intent.text.toLowerCase().split(/\W+/).filter(Boolean));
    const recalled = this.facts.filter((fact) =>
      fact.toLowerCase().split(/\W+/).some((word) => tokens.has(word))
    );

    return {
      recalled,
      memorySignature: hashOf({ intentId: intent.id, recalled })
    };
  }
}
