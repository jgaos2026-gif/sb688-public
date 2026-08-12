/**
 * SB688 Agent — Programmable AI Agent contracts.
 *
 * Owner:       JGA (John Arenz)
 * Philosophy:  Logical · Data-Researched · Calculated
 *
 * The Agent layer provides a sovereign, programmable AI agent capable of:
 *   • Communication — structured dialogue with contextual memory
 *   • Decision-making — weighted option scoring with rationale
 *   • Advice — precise, logic-driven guidance backed by internal reasoning
 */

export interface AgentConfig {
  /** Display name for the agent. */
  readonly name: string;
  /** Short description / persona of the agent. */
  readonly persona: string;
  /** Base-64 data URL for the agent's avatar image, or undefined. */
  readonly avatarDataUrl?: string;
}

export interface AgentMessage {
  readonly role: "user" | "agent";
  readonly text: string;
  readonly at: string;
}

export interface AgentCommunicateInput {
  readonly message: string;
}

export interface AgentCommunicateOutput {
  readonly reply: string;
  readonly at: string;
  readonly historyLength: number;
}

export interface AgentDecideInput {
  /** Human-readable question or scenario. */
  readonly question: string;
  /** Two or more options to evaluate. */
  readonly options: readonly string[];
}

export interface AgentDecideOutput {
  readonly chosen: string;
  readonly scores: ReadonlyArray<{ readonly option: string; readonly score: number }>;
  readonly rationale: string;
  readonly at: string;
}

export interface AgentAdviseInput {
  /** The topic or situation the agent should advise on. */
  readonly query: string;
}

export interface AgentAdviseOutput {
  readonly advice: string;
  readonly confidence: number;
  readonly steps: readonly string[];
  readonly at: string;
}

export interface AgentStatus {
  readonly name: string;
  readonly persona: string;
  readonly hasAvatar: boolean;
  readonly historyLength: number;
  readonly at: string;
}
