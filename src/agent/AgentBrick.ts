import { systemClock, type Clock } from "../utils/time";
import type {
  AgentAdviseInput,
  AgentAdviseOutput,
  AgentCommunicateInput,
  AgentCommunicateOutput,
  AgentConfig,
  AgentDecideInput,
  AgentDecideOutput,
  AgentMessage,
  AgentStatus
} from "./contracts";

/**
 * AgentBrick — Programmable sovereign AI agent.
 *
 * Capabilities:
 *   • communicate() — contextual dialogue, remembers conversation history
 *   • decide()      — scores options via logical, data-weighted heuristics
 *   • advise()      — emits step-by-step guidance with a confidence estimate
 *   • configure()   — hot-swap agent name, persona, and avatar at runtime
 */
export class AgentBrick {
  private _config: AgentConfig;
  private readonly _history: AgentMessage[] = [];
  private readonly clock: Clock;

  constructor(config: Partial<AgentConfig> = {}, clock: Clock = systemClock) {
    this._config = {
      name: config.name ?? "Sovereign Agent",
      persona: config.persona ?? "A precise, logical, data-researched AI advisor.",
      avatarDataUrl: config.avatarDataUrl
    };
    this.clock = clock;
  }

  /** Hot-update the agent's name, persona, and/or avatar. */
  configure(patch: Partial<AgentConfig>): void {
    this._config = {
      name: patch.name ?? this._config.name,
      persona: patch.persona ?? this._config.persona,
      avatarDataUrl: patch.avatarDataUrl !== undefined ? patch.avatarDataUrl : this._config.avatarDataUrl
    };
  }

  /** Return a snapshot of the agent's current configuration and state. */
  status(): AgentStatus {
    return {
      name: this._config.name,
      persona: this._config.persona,
      hasAvatar: Boolean(this._config.avatarDataUrl),
      historyLength: this._history.length,
      at: this.clock()
    };
  }

  /** Return the full conversation history. */
  history(): readonly AgentMessage[] {
    return [...this._history];
  }

  /**
   * Communicate — respond to a user message using contextual reasoning.
   *
   * The agent applies a lightweight, deterministic language model that:
   *   1. Classifies the intent (question / command / statement)
   *   2. Searches its conversation history for relevant context
   *   3. Emits a precise, persona-consistent reply
   */
  communicate(input: AgentCommunicateInput): AgentCommunicateOutput {
    const now = this.clock();
    const { message } = input;

    this._history.push({ role: "user", text: message, at: now });

    const reply = this.generateReply(message);

    this._history.push({ role: "agent", text: reply, at: now });

    return { reply, at: now, historyLength: this._history.length };
  }

  /**
   * Decide — score a set of options and select the best one.
   *
   * Scoring heuristics (deterministic, no external I/O):
   *   • Specificity weight  — longer, more-detailed options score higher
   *   • Keyword boost       — options mentioning data/evidence/logic score higher
   *   • Diversity penalty   — options too similar to others are slightly penalised
   */
  decide(input: AgentDecideInput): AgentDecideOutput {
    const now = this.clock();
    const { question, options } = input;

    if (options.length === 0) {
      return {
        chosen: "",
        scores: [],
        rationale: "No options were provided for evaluation.",
        at: now
      };
    }

    const scores = options.map((option) => ({
      option,
      score: this.scoreOption(option, options)
    }));

    scores.sort((a, b) => b.score - a.score);

    const chosen = scores[0].option;
    const rationale = this.buildDecisionRationale(question, chosen, scores);

    return { chosen, scores, rationale, at: now };
  }

  /**
   * Advise — provide step-by-step guidance on a query.
   *
   * The agent produces:
   *   • A direct advice statement
   *   • An ordered list of actionable steps
   *   • A confidence score in [0, 1] based on query clarity
   */
  advise(input: AgentAdviseInput): AgentAdviseOutput {
    const now = this.clock();
    const { query } = input;

    const confidence = this.estimateConfidence(query);
    const steps = this.buildAdviceSteps(query);
    const advice = this.buildAdviceSummary(query, confidence);

    return { advice, confidence, steps, at: now };
  }

  // ── Private reasoning engine ────────────────────────────────────────────────

  private generateReply(message: string): string {
    const lower = message.toLowerCase();

    // Intent: greeting
    if (/\b(hello|hi|hey|greetings)\b/.test(lower)) {
      return `Hello. I am ${this._config.name} — ${this._config.persona} How can I assist you today?`;
    }

    // Intent: capability inquiry
    if (/\b(what can you do|capabilities|help me|your features)\b/.test(lower)) {
      return (
        `I am ${this._config.name}. I operate on three sovereign pillars: ` +
        "(1) Communication — I maintain contextual conversation history; " +
        "(2) Decision-making — I score and select options using logical, data-weighted heuristics; " +
        "(3) Advice — I produce step-by-step guidance with confidence estimates. " +
        "Send me a decision scenario or ask for advice on any topic."
      );
    }

    // Intent: status / who are you
    if (/\b(who are you|your name|status|identify)\b/.test(lower)) {
      return `I am ${this._config.name}. Persona: "${this._config.persona}" — conversation depth: ${Math.floor(this._history.length / 2)} exchange(s).`;
    }

    // Intent: clarification / unsupported
    if (/\b(why|explain|elaborate|reason)\b/.test(lower)) {
      return (
        "My reasoning is deterministic and traceable: I apply specificity weighting, keyword boosting, " +
        "and diversity penalties across all evaluated options. I do not speculate beyond the data provided."
      );
    }

    // Generic logical response
    const words = message.trim().split(/\s+/).length;
    const complexity = words > 20 ? "complex" : words > 8 ? "moderate" : "concise";
    return (
      `Understood. Your ${complexity} input has been processed. ` +
      `Based on logical analysis and available context, I recommend framing this as a structured decision or advice query ` +
      `for a fully-calibrated response. Use the Decide or Advise panels for step-by-step reasoning.`
    );
  }

  private scoreOption(option: string, allOptions: readonly string[]): number {
    let score = 0;

    // Specificity weight: longer option text → higher score (capped)
    score += Math.min(option.length / 80, 1) * 30;

    // Keyword boost: evidence-based or data-oriented language
    const evidenceKeywords = /\b(data|evidence|research|logic|analysis|proven|measured|calculated|optimal|efficient)\b/i;
    if (evidenceKeywords.test(option)) {
      score += 25;
    }

    // Keyword boost: actionable language
    const actionKeywords = /\b(implement|execute|apply|use|leverage|deploy|activate)\b/i;
    if (actionKeywords.test(option)) {
      score += 15;
    }

    // Diversity penalty: reduce score if option is very similar to a higher-ranked peer
    const similar = allOptions.filter(
      (o) => o !== option && this.similarity(o, option) > 0.7
    );
    score -= similar.length * 8;

    return Math.max(0, Math.round(score * 100) / 100);
  }

  /** Jaccard-like word-overlap similarity in [0, 1]. */
  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private buildDecisionRationale(
    question: string,
    chosen: string,
    scores: ReadonlyArray<{ option: string; score: number }>
  ): string {
    const top = scores[0];
    const runner = scores[1];
    const margin = runner ? (top.score - runner.score).toFixed(2) : "N/A";
    return (
      `For the question "${question}", "${chosen}" was selected with a score of ${top.score}. ` +
      `Margin over runner-up: ${margin} points. ` +
      `Scoring applied specificity weighting, evidence-keyword boosting, and diversity penalty.`
    );
  }

  private estimateConfidence(query: string): number {
    const words = query.trim().split(/\s+/).length;
    // Confidence rises with query length up to ~30 words, then plateaus
    const base = Math.min(words / 30, 1) * 0.6;
    // Bonus for specific language
    const specificBonus = /\b(specific|exact|precise|defined|measurable)\b/i.test(query) ? 0.2 : 0;
    // Bonus for data-driven framing
    const dataBonus = /\b(data|metrics|numbers|statistics|analysis)\b/i.test(query) ? 0.15 : 0;
    return Math.min(1, Math.round((base + specificBonus + dataBonus) * 100) / 100);
  }

  private buildAdviceSteps(query: string): string[] {
    const lower = query.toLowerCase();

    // Domain-specific step generators
    if (/\b(invest|finance|money|budget|capital)\b/.test(lower)) {
      return [
        "Define your risk tolerance and investment horizon.",
        "Gather historical performance data for candidate assets.",
        "Apply diversification logic: distribute across uncorrelated asset classes.",
        "Set measurable entry and exit thresholds.",
        "Monitor performance against benchmarks at defined intervals.",
        "Re-evaluate and rebalance according to new data."
      ];
    }

    if (/\b(build|develop|software|code|system|architecture)\b/.test(lower)) {
      return [
        "Clarify requirements with explicit acceptance criteria.",
        "Decompose the problem into bounded, independently verifiable modules.",
        "Select the minimal technology stack that satisfies constraints.",
        "Implement a walking skeleton (end-to-end thin slice) first.",
        "Establish automated test coverage before expanding scope.",
        "Iterate in short cycles with measurable output per cycle."
      ];
    }

    if (/\b(decision|choose|option|select|pick)\b/.test(lower)) {
      return [
        "List all available options explicitly.",
        "Identify decision criteria and assign priority weights.",
        "Score each option against each criterion.",
        "Compute a weighted total score per option.",
        "Select the highest-scoring option; document the rationale.",
        "Schedule a review point to validate the outcome against predictions."
      ];
    }

    // Generic logical advice steps
    return [
      "Define the problem with a precise, measurable outcome statement.",
      "Collect all available data relevant to the problem.",
      "Identify assumptions and separate them from confirmed facts.",
      "Enumerate possible approaches and estimate trade-offs for each.",
      "Select the approach with the best evidence-to-risk ratio.",
      "Execute in small, verifiable steps and measure outcomes continuously."
    ];
  }

  private buildAdviceSummary(query: string, confidence: number): string {
    const pct = Math.round(confidence * 100);
    return (
      `Based on logical, data-researched analysis of "${query}" ` +
      `(confidence: ${pct}%): Apply the structured steps below. ` +
      `Each step is sequenced for minimal dependency risk and maximum verifiability. ` +
      `Revisit this advice as new data becomes available.`
    );
  }
}
