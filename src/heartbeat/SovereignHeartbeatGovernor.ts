export type HeartbeatRole =
  | "PATROL"
  | "TRIO_MEMBER_1"
  | "TRIO_MEMBER_2"
  | "TRIO_MEMBER_3"
  | "PHOENIX"
  | "NODE_BRIGADE"
  | "IRONLINK_3"
  | "WATCHDOG_OVERSEER"
  | "STITCHBRICK_COORDINATOR";

export type HeartbeatAction =
  | "RECORD_HEARTBEAT"
  | "PATROL_SCAN"
  | "WATCHDOG_CORRELATE"
  | "TRIO_MEMBER_1_WAKE"
  | "TRIO_MEMBER_2_WAKE"
  | "TRIO_MEMBER_3_WAKE"
  | "CHECKPOINT_HEALTH_CHECK"
  | "MEMORY_BRAID_HEALTH_CHECK"
  | "FREEZE_TRUST_PROMOTION"
  | "ESCALATE_TO_TRIO"
  | "REQUEST_QUARANTINE"
  | "REQUEST_PHOENIX_RECOVERY"
  | "REQUEST_REVERIFICATION"
  | "REJOIN_PROBATION"
  | "REJOIN_REVIEW_ALLOWED";

export interface HeartbeatPolicy {
  readonly basePulseMs: number;
  readonly maxClockSkewMs: number;
  readonly trustFreezeAfterMissedBeats: number;
  readonly quarantineAfterMissedBeats: number;
  readonly phoenixAfterMissedBeats: number;
  readonly healthyBeatsBeforeRejoinReview: number;
  readonly checkpointHealthEveryBeats: number;
  readonly memoryHealthEveryBeats: number;
  readonly trioWakeEveryMs: number;
}

export const SUPER_HARD_HEARTBEAT_POLICY: HeartbeatPolicy = Object.freeze({
  basePulseMs: 10_000,
  maxClockSkewMs: 2_000,
  trustFreezeAfterMissedBeats: 1,
  quarantineAfterMissedBeats: 2,
  phoenixAfterMissedBeats: 3,
  healthyBeatsBeforeRejoinReview: 6,
  checkpointHealthEveryBeats: 6,
  memoryHealthEveryBeats: 6,
  trioWakeEveryMs: 2 * 60 * 60 * 1_000
});

export interface SovereignHeartbeat {
  readonly sovereignId: string;
  readonly sectionId: string;
  readonly nodeId: string;
  readonly role: HeartbeatRole;
  readonly epoch: number;
  readonly sequence: number;
  readonly emittedAtMs: number;
  readonly receivedAtMs: number;
  readonly policyVersion: string;
  readonly lastCheckpointId?: string;
  readonly lastVerificationId?: string;
  readonly sourceAuthenticated: boolean;
  readonly provenancePresent: boolean;
  readonly evidenceRef: string;
}

export interface HeartbeatDecision {
  readonly accepted: boolean;
  readonly healthy: boolean;
  readonly reasons: readonly string[];
  readonly actions: readonly HeartbeatAction[];
  readonly missedBeats: number;
  readonly consecutiveHealthyBeats: number;
  readonly activeTrioMember: 1 | 2 | 3;
  readonly trustPromotionFrozen: boolean;
  readonly quarantineRequested: boolean;
  readonly phoenixRecoveryRequested: boolean;
  readonly rejoinReviewAllowed: boolean;
}

interface NodeHeartbeatState {
  epoch: number;
  sequence: number;
  receivedAtMs: number;
  consecutiveHealthyBeats: number;
  trustPromotionFrozen: boolean;
  quarantineRequested: boolean;
  phoenixRecoveryRequested: boolean;
}

/**
 * Timing governor for a sovereign runtime.
 *
 * It governs WHEN work may be requested. It does not decide truth, certify
 * recovery, repair state, or write a Spine. Those authorities remain separate.
 */
export class SovereignHeartbeatGovernor {
  private readonly state = new Map<string, NodeHeartbeatState>();
  readonly policy: HeartbeatPolicy;

  constructor(
    readonly sovereignId: string,
    readonly policyVersion: string,
    policy: HeartbeatPolicy = SUPER_HARD_HEARTBEAT_POLICY
  ) {
    if (!sovereignId.trim()) throw new Error("sovereignId is required");
    if (!policyVersion.trim()) throw new Error("policyVersion is required");
    if (policy.basePulseMs <= 0) throw new Error("basePulseMs must be positive");
    this.policy = Object.freeze({ ...policy });
  }

  observe(beat: SovereignHeartbeat): HeartbeatDecision {
    const reasons: string[] = [];
    const actions: HeartbeatAction[] = ["RECORD_HEARTBEAT"];

    if (beat.sovereignId !== this.sovereignId) reasons.push("wrong sovereign identity");
    if (!beat.sectionId.trim()) reasons.push("missing section identity");
    if (!beat.nodeId.trim()) reasons.push("missing node identity");
    if (!beat.sourceAuthenticated) reasons.push("heartbeat source not authenticated");
    if (!beat.provenancePresent) reasons.push("heartbeat provenance missing");
    if (!beat.evidenceRef.trim()) reasons.push("heartbeat evidence reference missing");
    if (beat.policyVersion !== this.policyVersion) reasons.push("heartbeat policy drift");
    if (!Number.isInteger(beat.epoch) || beat.epoch < 0) reasons.push("invalid heartbeat epoch");
    if (!Number.isInteger(beat.sequence) || beat.sequence < 0) reasons.push("invalid heartbeat sequence");
    if (Math.abs(beat.receivedAtMs - beat.emittedAtMs) > this.policy.maxClockSkewMs) reasons.push("heartbeat clock skew exceeded");

    const key = this.key(beat);
    const previous = this.state.get(key);
    let missedBeats = 0;

    if (previous) {
      if (beat.epoch < previous.epoch) reasons.push("heartbeat epoch rollback detected");
      if (beat.epoch === previous.epoch && beat.sequence <= previous.sequence) reasons.push("heartbeat replay or duplicate detected");

      if (beat.receivedAtMs <= previous.receivedAtMs) {
        reasons.push("non-monotonic heartbeat arrival detected");
      } else {
        const elapsed = beat.receivedAtMs - previous.receivedAtMs;
        const expectedIntervals = Math.max(1, Math.round(elapsed / this.policy.basePulseMs));
        missedBeats = Math.max(0, expectedIntervals - 1);
      }
    }

    const accepted = reasons.length === 0;
    const healthy = accepted && missedBeats === 0;
    const activeTrioMember = this.trioMemberAt(beat.receivedAtMs);

    let consecutiveHealthyBeats = healthy ? (previous?.consecutiveHealthyBeats ?? 0) + 1 : 0;
    let trustPromotionFrozen = previous?.trustPromotionFrozen ?? false;
    let quarantineRequested = previous?.quarantineRequested ?? false;
    let phoenixRecoveryRequested = previous?.phoenixRecoveryRequested ?? false;

    if (!accepted) {
      trustPromotionFrozen = true;
      quarantineRequested = true;
      actions.push("FREEZE_TRUST_PROMOTION", "REQUEST_QUARANTINE", "ESCALATE_TO_TRIO");
    }

    if (missedBeats >= this.policy.trustFreezeAfterMissedBeats) {
      trustPromotionFrozen = true;
      actions.push("FREEZE_TRUST_PROMOTION", "ESCALATE_TO_TRIO");
    }
    if (missedBeats >= this.policy.quarantineAfterMissedBeats) {
      quarantineRequested = true;
      actions.push("REQUEST_QUARANTINE");
    }
    if (missedBeats >= this.policy.phoenixAfterMissedBeats) {
      phoenixRecoveryRequested = true;
      actions.push("REQUEST_PHOENIX_RECOVERY");
    }

    if (accepted) {
      actions.push("PATROL_SCAN", "WATCHDOG_CORRELATE");
      if (beat.sequence % this.policy.checkpointHealthEveryBeats === 0) actions.push("CHECKPOINT_HEALTH_CHECK");
      if (beat.sequence % this.policy.memoryHealthEveryBeats === 0) actions.push("MEMORY_BRAID_HEALTH_CHECK");
      this.addTrioWakeAction(actions, activeTrioMember, beat.receivedAtMs);
    }

    const inRecovery = trustPromotionFrozen || quarantineRequested || phoenixRecoveryRequested;
    if (inRecovery && consecutiveHealthyBeats > 0) {
      actions.push("REJOIN_PROBATION", "REQUEST_REVERIFICATION");
    }

    const rejoinReviewAllowed =
      accepted &&
      consecutiveHealthyBeats >= this.policy.healthyBeatsBeforeRejoinReview &&
      !quarantineRequested &&
      !phoenixRecoveryRequested;

    if (rejoinReviewAllowed) actions.push("REJOIN_REVIEW_ALLOWED");

    if (accepted) {
      // A healthy heartbeat may clear the timing-side freeze only after the full
      // probation window. It never clears quarantine/recovery authority itself.
      if (consecutiveHealthyBeats >= this.policy.healthyBeatsBeforeRejoinReview) {
        trustPromotionFrozen = false;
      }
      this.state.set(key, {
        epoch: beat.epoch,
        sequence: beat.sequence,
        receivedAtMs: beat.receivedAtMs,
        consecutiveHealthyBeats,
        trustPromotionFrozen,
        quarantineRequested,
        phoenixRecoveryRequested
      });
    }

    return Object.freeze({
      accepted,
      healthy,
      reasons: Object.freeze(reasons),
      actions: Object.freeze(unique(actions)),
      missedBeats,
      consecutiveHealthyBeats,
      activeTrioMember,
      trustPromotionFrozen,
      quarantineRequested,
      phoenixRecoveryRequested,
      rejoinReviewAllowed
    });
  }

  acknowledgeGovernedRecovery(
    nodeId: string,
    sectionId: string,
    evidence: {
      readonly verified: boolean;
      readonly validated: boolean;
      readonly certified: boolean;
      readonly checkpointPresent: boolean;
      readonly evidencePreserved: boolean;
    }
  ): boolean {
    const key = `${sectionId}::${nodeId}`;
    const current = this.state.get(key);
    if (!current) return false;
    if (!evidence.verified || !evidence.validated || !evidence.certified) return false;
    if (!evidence.checkpointPresent || !evidence.evidencePreserved) return false;

    current.quarantineRequested = false;
    current.phoenixRecoveryRequested = false;
    current.trustPromotionFrozen = true;
    current.consecutiveHealthyBeats = 0;
    return true;
  }

  private key(beat: SovereignHeartbeat): string {
    return `${beat.sectionId}::${beat.nodeId}`;
  }

  private trioMemberAt(nowMs: number): 1 | 2 | 3 {
    const slot = Math.floor(nowMs / this.policy.trioWakeEveryMs) % 3;
    return (slot + 1) as 1 | 2 | 3;
  }

  private addTrioWakeAction(actions: HeartbeatAction[], member: 1 | 2 | 3, nowMs: number): void {
    const phase = nowMs % this.policy.trioWakeEveryMs;
    if (phase >= this.policy.basePulseMs) return;
    actions.push(`TRIO_MEMBER_${member}_WAKE` as HeartbeatAction);
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
