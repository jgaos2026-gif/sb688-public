import type { Result } from "../contracts/result";
import { err, ok } from "../contracts/result";
import type { ConsciousReport, SpinePermit, TruthReport, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";

export class ConsciousBrick {
  inspect(intent: UserIntent, permit: SpinePermit, truth: TruthReport): Result<ConsciousReport> {
    const goal = this.extractGoal(intent.text);
    const ethicalPass = this.ethicsCheck(intent.text);
    const consequencePass = this.consequenceCheck(intent.text, truth.confidence);
    const consequenceSummary = consequencePass
      ? "Expected consequence is bounded, explainable, and consistent with approved constraints."
      : "Expected consequence is uncertain or conflicts with approved constraints.";

    const report: ConsciousReport = {
      goal,
      ethicalPass,
      consequencePass,
      consequenceSummary,
      consciousSignature: hashOf({ goal, ethicalPass, consequencePass, permit, truth: truth.meshSignature })
    };

    if (!ethicalPass || !consequencePass) {
      return err(
        "CONSCIOUS_REJECTED",
        "conscious-brick",
        "Conscious Brick rejected the state after goal/ethics/consequence review.",
        true,
        report
      );
    }

    return ok(report);
  }

  private extractGoal(text: string): string {
    const normalized = text.trim().replace(/\s+/g, " ");
    return normalized.length <= 140 ? normalized : `${normalized.slice(0, 137)}...`;
  }

  private ethicsCheck(text: string): boolean {
    return !/(harm\s+someone|steal credentials|exfiltrate|malware|weaponize)/i.test(text);
  }

  private consequenceCheck(text: string, truthConfidence: number): boolean {
    const highRiskIntent = /(irreversible|deploy to production|delete all|financial transaction)/i.test(text);
    return truthConfidence >= 0.9 && !highRiskIntent;
  }
}
