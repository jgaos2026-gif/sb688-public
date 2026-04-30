import type { RuntimeStage } from "./result";

export interface UserIntent {
  readonly id: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SpinePermit {
  readonly intentId: string;
  readonly approved: true;
  readonly constraints: readonly string[];
  readonly spineSignature: string;
}

export interface TruthFinding {
  readonly nodeId: string;
  readonly passed: boolean;
  readonly confidence: number;
  readonly message: string;
}

export interface TruthReport {
  readonly phase: "pre-brain" | "post-brain" | "failure-verify";
  readonly verified: boolean;
  readonly confidence: number;
  readonly findings: readonly TruthFinding[];
  readonly meshSignature: string;
}

export interface ConsciousReport {
  readonly goal: string;
  readonly ethicalPass: boolean;
  readonly consequencePass: boolean;
  readonly consequenceSummary: string;
  readonly consciousSignature: string;
}

export interface DecisionRoute {
  readonly route: "answer" | "clarify" | "refuse" | "degraded-recovery";
  readonly rationale: string;
}

export interface MemoryContext {
  readonly recalled: readonly string[];
  readonly memorySignature: string;
}

export interface PersonalityFrame {
  readonly tone: "precise" | "warm" | "neutral";
  readonly styleRules: readonly string[];
  readonly personalitySignature: string;
}

export interface StemPacket {
  readonly decision: DecisionRoute;
  readonly memory: MemoryContext;
  readonly personality: PersonalityFrame;
  readonly braidSignature: string;
}

export interface BrainOutput {
  readonly text: string;
  readonly adapterOnly: true;
  readonly usedStemSignature: string;
  readonly probabilisticTrace?: ProbabilityDistribution;
}

export interface ProbabilityPoint {
  readonly label: string;
  readonly probability: number;
}

export interface ProbabilityDistribution {
  readonly name: string;
  readonly points: readonly ProbabilityPoint[];
  readonly tolerance?: number;
}

export interface QuantumValidationReport {
  readonly valid: boolean;
  readonly normalized: readonly ProbabilityPoint[];
  readonly total: number;
  readonly maxDeviation: number;
  readonly issues: readonly string[];
}

export interface GhostCheckpoint {
  readonly id: string;
  readonly intentId: string;
  readonly createdAt: string;
  readonly stage: RuntimeStage;
  readonly stateHash: string;
  readonly label: "verified-output" | "failure-recovery";
}

export interface RuntimeResponse {
  readonly traceId: string;
  readonly output: string;
  readonly verified: boolean;
  readonly auditHash: string;
  readonly checkpoint?: GhostCheckpoint;
}

export interface RuntimeSnapshot {
  readonly traceId: string;
  readonly intent: UserIntent;
  readonly stage: RuntimeStage;
  readonly auditHash: string;
  readonly stable: boolean;
}
