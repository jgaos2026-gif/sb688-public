/**
 * Triad Recovery — contracts.
 *
 * Phase 4: Three independent nodes (Hunter / Warrior / Repair) that
 * communicate exclusively through the Spine.
 */

export type TriadNodeRole = "hunter" | "warrior" | "repair";

export type TriadNodeStatus = "idle" | "active" | "scanning" | "blocking" | "reconstructing" | "done" | "failed";

export interface TriadMessage {
  readonly id: string;
  readonly from: TriadNodeRole;
  readonly to: TriadNodeRole | "coordinator";
  readonly type: "corruption_found" | "threat_isolated" | "state_reconstructed" | "status_report" | "spine_permit";
  readonly payload: Readonly<Record<string, unknown>>;
  readonly at: string;
  readonly signature: string;
}

export interface CorruptionReport {
  readonly id: string;
  readonly at: string;
  readonly corruptedKeys: readonly string[];
  readonly stateHash: string;
  readonly severity: "low" | "medium" | "high" | "critical";
}

export interface IsolationReport {
  readonly id: string;
  readonly at: string;
  readonly isolatedKeys: readonly string[];
  readonly blockedStateHash: string;
  readonly spinePermitUsed: string;
}

export interface ReconstructionReport {
  readonly id: string;
  readonly at: string;
  readonly reconstructedKeys: readonly string[];
  readonly finalStateHash: string;
  readonly verifiedBySpine: boolean;
}

export interface TriadCycleResult {
  readonly id: string;
  readonly at: string;
  readonly corruption: CorruptionReport | null;
  readonly isolation: IsolationReport | null;
  readonly reconstruction: ReconstructionReport | null;
  readonly success: boolean;
  readonly spinePermitSignature: string;
}
