import type { Result } from "../contracts/result";
import { err, ok } from "../contracts/result";
import type { SpinePermit, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";

export interface SpineRule {
  readonly id: string;
  readonly description: string;
  readonly validate: (intent: UserIntent) => boolean;
}

export class SpineGovernor {
  private readonly rules: readonly SpineRule[];

  constructor(rules: readonly SpineRule[] = defaultSpineRules) {
    this.rules = rules;
  }

  govern(intent: UserIntent): Result<SpinePermit> {
    const failed = this.rules.filter((rule) => !rule.validate(intent));

    if (failed.length > 0) {
      return err(
        "SPINE_REJECTED",
        "spine",
        `Spine rejected intent: ${failed.map((rule) => rule.id).join(", ")}`,
        true,
        { failedRules: failed.map((rule) => rule.description) }
      );
    }

    const constraints = [
      "spine-governance-required",
      "brain-adapter-only",
      "post-brain-truth-verification-required",
      "append-only-ledger-required"
    ] as const;

    return ok({
      intentId: intent.id,
      approved: true,
      constraints,
      spineSignature: hashOf({ intent, constraints, ruleIds: this.rules.map((rule) => rule.id) })
    });
  }
}

export const defaultSpineRules: readonly SpineRule[] = [
  {
    id: "intent-not-empty",
    description: "User intent must contain non-empty text.",
    validate: (intent) => intent.text.trim().length > 0
  },
  {
    id: "intent-max-length",
    description: "User intent must fit within bounded runtime context.",
    validate: (intent) => intent.text.length <= 12_000
  },
  {
    id: "no-governance-bypass",
    description: "Intent must not request bypassing the spine, ledger, or verification mesh.",
    validate: (intent) => !/bypass\s+(spine|ledger|truth|governance|verification)/i.test(intent.text)
  }
];
