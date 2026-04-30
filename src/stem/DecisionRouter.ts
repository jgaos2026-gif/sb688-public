import type { ConsciousReport, DecisionRoute, SpinePermit, TruthReport, UserIntent } from "../contracts/runtime";

export class DecisionRouter {
  route(intent: UserIntent, permit: SpinePermit, truth: TruthReport, conscious: ConsciousReport): DecisionRoute {
    if (!permit.approved || !truth.verified || !conscious.ethicalPass || !conscious.consequencePass) {
      return {
        route: "refuse",
        rationale: "One or more governing checks failed."
      };
    }

    if (/\?$/.test(intent.text.trim()) || /explain|build|implement|create|show/i.test(intent.text)) {
      return {
        route: "answer",
        rationale: "Intent is approved and can be answered directly."
      };
    }

    return {
      route: "clarify",
      rationale: "Intent is safe but underspecified."
    };
  }
}
