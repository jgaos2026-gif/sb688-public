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
  /**
   * Ed25519 signature (base64) over the canonical permit contents —
   * see src/truth/SpinePermitCrypto.ts. A permit without a signature
   * that verifies against a trusted public key is NOT trusted.
   * The old `spineSignature` sha256 binding is kept for determinism
   * and backwards compatibility; it is a content hash, not a signature,
   * and proves nothing about who issued the permit.
   */
  readonly signature?: string;
  /** Issuer identifier (key id / operator name). */
  readonly issuer?: string;
  /** ISO timestamp the permit was issued. */
  readonly issuedAt?: string;
  /** ISO timestamp after which the permit is dead. */
  readonly expiresAt?: string;
  /** Per-permit random nonce — makes every signature unique. */
  readonly nonce?: string;
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
  /**
   * Last-stable captured state of each rollback participant, with the
   * hash of the captured state recorded at capture time. The
   * FailureManager restores from these captures and verifies the
   * restored hash matches — that is what makes a rollback demonstrable
   * rather than claimed.
   */
  readonly participantStates?: Readonly<Record<string, RollbackParticipantState>>;
}

/** One participant's captured state plus its hash at capture time. */
export interface RollbackParticipantState {
  readonly captured: unknown;
  readonly hash: string;
}
