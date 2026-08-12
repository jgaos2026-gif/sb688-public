import { AuditLedger } from "../ledger/AuditLedger";
import { IntegratedSystem } from "./IntegratedSystem";
import { TriadCoordinator } from "../triad/TriadCoordinator";
import { PhoenixRecovery } from "../phoenix/PhoenixRecovery";
import { PhoenixPatrol } from "../phoenix/PhoenixPatrol";

export interface AdversarialProfile {
  readonly name: string;
  readonly pulseAlive?: boolean;
  readonly tamperKeys?: readonly string[];
  readonly uploadAttacks?: readonly string[];
  readonly filesystemAttacks?: readonly string[];
  readonly injectValues?: Readonly<Record<string, unknown>>;
}

export interface IndustryDrillRequest {
  readonly industry: string;
  readonly intentText: string;
  readonly profile: AdversarialProfile;
}

export interface SovereignDrillResult {
  readonly sovereignId: string;
  readonly triadSuccess: boolean;
  readonly rollbackSuccess: boolean;
  readonly rollbackElapsedMs: number;
  readonly runtimeVerified: boolean;
  readonly omegaStatusDuringAttack: string;
  readonly omegaStatusAfterHeal: string;
  readonly resurrectionTriggered: boolean;
  readonly anomaliesBeforeHeal: number;
  readonly anomaliesAfterHeal: number;
  readonly ledgerValid: boolean;
  readonly passed: boolean;
}

export interface IndustryDrillReport {
  readonly industry: string;
  readonly profile: string;
  readonly sovereigns: readonly SovereignDrillResult[];
  readonly overallPassed: boolean;
}

export interface UniversalSovereignIntegrityFabricDeps {
  readonly sovereignSeeds?: readonly Readonly<Record<string, unknown>>[];
}

interface SovereignNode {
  readonly id: string;
  readonly seedState: Readonly<Record<string, unknown>>;
  readonly system: IntegratedSystem;
  readonly triad: TriadCoordinator;
  readonly recovery: PhoenixRecovery;
  readonly patrol: PhoenixPatrol;
}

const DEFAULT_SOVEREIGN_SEEDS: readonly Readonly<Record<string, unknown>>[] = Object.freeze([
  Object.freeze({ sovereign: "SOVEREIGN_A", protocol: "SB688/SB689/SB712", integrity: "verified", domain: "owner-edge" }),
  Object.freeze({ sovereign: "SOVEREIGN_B", protocol: "SB688/SB689/SB712", integrity: "verified", domain: "cloud-core" }),
  Object.freeze({ sovereign: "SOVEREIGN_C", protocol: "SB688/SB689/SB712", integrity: "verified", domain: "air-gap-recovery" })
]);

export class UniversalSovereignIntegrityFabric {
  private readonly sovereigns: readonly SovereignNode[];

  constructor(deps: UniversalSovereignIntegrityFabricDeps = {}) {
    const seeds = deps.sovereignSeeds ?? DEFAULT_SOVEREIGN_SEEDS;
    if (seeds.length !== 3) {
      throw new Error("UniversalSovereignIntegrityFabric requires exactly three sovereign seeds.");
    }

    this.sovereigns = Object.freeze(
      seeds.map((seedState, index) => {
        const ledger = new AuditLedger();
        const system = new IntegratedSystem({ ledger, seedState });
        const recovery = new PhoenixRecovery(ledger);
        const triad = new TriadCoordinator(ledger);
        const patrol = new PhoenixPatrol(ledger, recovery);
        return Object.freeze({
          id: `SOVEREIGN_${index + 1}`,
          seedState,
          system,
          triad,
          recovery,
          patrol
        });
      })
    );
  }

  sovereignCount(): number {
    return this.sovereigns.length;
  }

  async runIndustryDrill(request: IndustryDrillRequest): Promise<IndustryDrillReport> {
    const sovereigns = await Promise.all(
      this.sovereigns.map((node, index) => this.runSovereignDrill(node, request, index))
    );
    const overallPassed = sovereigns.every((entry) => entry.passed);
    return Object.freeze({
      industry: request.industry,
      profile: request.profile.name,
      sovereigns: Object.freeze(sovereigns),
      overallPassed
    });
  }

  private async runSovereignDrill(
    node: SovereignNode,
    request: IndustryDrillRequest,
    nodeIndex: number
  ): Promise<SovereignDrillResult> {
    const baselineState = Object.freeze({ ...node.seedState });
    const checkpoint = node.recovery.checkpoint(baselineState, `${request.industry}-baseline`);
    const corrupted = this.corruptState(baselineState, request.profile, nodeIndex);

    const before = node.patrol.patrol({
      liveState: corrupted,
      seedState: baselineState,
      uploadLog: request.profile.uploadAttacks,
      filesystemPaths: request.profile.filesystemAttacks
    });

    const triad = node.triad.run(corrupted, baselineState);
    const rollback = node.recovery.rollback(checkpoint.id);
    const healedState = rollback.success ? rollback.restoredState : baselineState;

    const runtime = await node.system.process(
      { id: `${request.industry}-${node.id}-${request.profile.name}`, text: request.intentText },
      { liveState: healedState, pulseAlive: request.profile.pulseAlive ?? true }
    );

    const after = node.patrol.patrol({ liveState: healedState, seedState: baselineState });
    const postHealOmega = node.system.tick({ liveState: healedState, pulseAlive: true });
    const ledgerValid = node.system.ledgerValid();

    const passed =
      triad.success &&
      rollback.success &&
      runtime.runtime.verified &&
      after.healthy &&
      ledgerValid &&
      postHealOmega.status === "SB689_READY";

    return Object.freeze({
      sovereignId: node.id,
      triadSuccess: triad.success,
      rollbackSuccess: rollback.success,
      rollbackElapsedMs: rollback.elapsedMs,
      runtimeVerified: runtime.runtime.verified,
      omegaStatusDuringAttack: runtime.omega.status,
      omegaStatusAfterHeal: postHealOmega.status,
      resurrectionTriggered: runtime.omega.status === "SB689_RESURRECTING",
      anomaliesBeforeHeal: before.anomalies.length,
      anomaliesAfterHeal: after.anomalies.length,
      ledgerValid,
      passed
    });
  }

  private corruptState(
    baselineState: Readonly<Record<string, unknown>>,
    profile: AdversarialProfile,
    nodeIndex: number
  ): Record<string, unknown> {
    const tampered = { ...baselineState } as Record<string, unknown>;
    const keys = profile.tamperKeys ?? ["integrity", "domain", "protocol", "sovereign"];

    for (const key of keys) {
      tampered[key] = `tampered:${profile.name}:node-${nodeIndex + 1}:${key}`;
    }

    if (profile.injectValues) {
      Object.assign(tampered, profile.injectValues);
    }

    return tampered;
  }
}
