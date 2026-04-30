import type { PersonalityFrame, UserIntent } from "../contracts/runtime";
import { hashOf } from "../utils/hash";

export class PersonalityRouter {
  frame(intent: UserIntent): PersonalityFrame {
    const wantsBuild = /build|implement|code|project/i.test(intent.text);
    const styleRules = wantsBuild
      ? ["be precise", "show runnable structure", "avoid unsupported authority claims"]
      : ["be clear", "stay bounded", "avoid unsupported authority claims"];

    return {
      tone: wantsBuild ? "precise" : "warm",
      styleRules,
      personalitySignature: hashOf({ intentId: intent.id, styleRules })
    };
  }
}
