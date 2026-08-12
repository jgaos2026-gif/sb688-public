export type FailureCategoryId =
  | "non_compliance"
  | "rogue_behavior"
  | "drift"
  | "hallucination"
  | "corruption_insanity";

export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
  readonly minimumPassRate: number;
}

export interface FailureCategoryDefinition {
  readonly id: FailureCategoryId;
  readonly name: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
}

export type PromptLabel = "normal" | "edge_case" | "adversarial" | "long_context" | "multi_turn";

export interface PromptTurn {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface PromptScenario {
  readonly id: string;
  readonly category: FailureCategoryId;
  readonly label: PromptLabel;
  readonly description: string;
  readonly turns: readonly PromptTurn[];
  readonly expectedBehavior: string;
  readonly shouldRefuse: boolean;
  readonly requiresFactCheck: boolean;
}

export interface ScenarioRun {
  readonly scenarioId: string;
  readonly category: FailureCategoryId;
  readonly modelVersion: string;
  readonly runIndex: number;
  readonly timestamp: string;
  readonly outputHash: string;
  readonly ruleViolation: boolean;
  readonly hallucination: boolean;
  readonly factCheckPassed: boolean;
  readonly refused: boolean;
  readonly shouldRefuse: boolean;
}

export interface EvaluationMetrics {
  readonly totalRuns: number;
  readonly violationRate: number;
  readonly hallucinationRate: number;
  readonly consistencyScore: number;
  readonly refusalCorrectness: number;
}

export interface DriftPoint {
  readonly modelVersion: string;
  readonly timestamp: string;
  readonly violationRate: number;
  readonly hallucinationRate: number;
  readonly consistencyScore: number;
  readonly refusalCorrectness: number;
}

export interface DriftTrend {
  readonly points: readonly DriftPoint[];
  readonly violationDelta: number;
  readonly hallucinationDelta: number;
  readonly consistencyDelta: number;
  readonly refusalDelta: number;
}

export interface ReleaseThresholds {
  readonly maxViolationRate: number;
  readonly maxHallucinationRate: number;
  readonly minConsistencyScore: number;
  readonly minRefusalCorrectness: number;
}

export interface ReleaseGateResult {
  readonly blocked: boolean;
  readonly reasons: readonly string[];
  readonly baselineVersion: string;
  readonly candidateVersion: string;
}

export interface RuntimeObservation {
  readonly id: string;
  readonly timestamp: string;
  readonly modelVersion: string;
  readonly conversationId: string;
  readonly flagged: boolean;
  readonly nonsenseScore: number;
  readonly unsafeScore: number;
}

export interface MonitoringPolicy {
  readonly baselineFlagRate: number;
  readonly spikeMultiplier: number;
  readonly minFlagRateForRollback: number;
  readonly minUnsafeScoreForGuardrail: number;
  readonly reviewSampleSize: number;
  readonly recentWindowSize: number;
}

export interface MonitoringReport {
  readonly totalObservations: number;
  readonly flaggedRate: number;
  readonly recentFlaggedRate: number;
  readonly sampledConversationIds: readonly string[];
  readonly spikeDetected: boolean;
  readonly rollbackTriggered: boolean;
  readonly guardrailTriggered: boolean;
}

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface IncidentRecord {
  readonly id: string;
  readonly category: FailureCategoryId;
  readonly description: string;
  readonly affectedUsers: number;
  readonly exploitEvidence: boolean;
}

export interface IncidentDecision {
  readonly severity: IncidentSeverity;
  readonly actions: readonly string[];
}

export interface PolicyCadence {
  readonly cadenceDays: number;
  readonly lastUpdatedAt: string;
  readonly now: string;
}

export interface PolicyReviewSchedule {
  readonly due: boolean;
  readonly nextReviewAt: string;
}

export interface HumanReviewRequest {
  readonly domain: string;
  readonly category: FailureCategoryId;
  readonly confidence: number;
}
