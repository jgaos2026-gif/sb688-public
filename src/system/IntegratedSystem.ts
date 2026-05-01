import type { AuditEntry } from "../contracts/audit";
import type { RuntimeResponse, UserIntent } from "../contracts/runtime";
import { AuditLedger } from "../ledger/AuditLedger";
import { OmegaSupervisor } from "../omega/OmegaSupervisor";
import type { OmegaStatus } from "../omega/contracts";
import { BraidedRuntime } from "../runtime/BraidedRuntime";
import { FileUploadManager } from "../upload/FileUploadManager";

export interface IntegratedSystemDeps {
  readonly ledger?: AuditLedger;
  readonly runtime?: BraidedRuntime;
  readonly omega?: OmegaSupervisor;
  readonly seedState?: Readonly<Record<string, unknown>>;
  readonly uploadManager?: FileUploadManager;
}

export interface SystemMonitorInput {
  readonly liveState?: Readonly<Record<string, unknown>>;
  readonly pulseAlive?: boolean;
}

export interface SystemProcessResult {
  readonly runtime: RuntimeResponse;
  readonly omega: OmegaStatus;
}

const DEFAULT_SEED: Readonly<Record<string, unknown>> = Object.freeze({
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
});

export class IntegratedSystem {
  private readonly ledger: AuditLedger;
  private readonly runtime: BraidedRuntime;
  private readonly omega: OmegaSupervisor;
  private readonly seedState: Readonly<Record<string, unknown>>;
  readonly uploadManager: FileUploadManager;

  constructor(deps: IntegratedSystemDeps = {}) {
    this.ledger = deps.ledger ?? new AuditLedger();
    this.seedState = deps.seedState ?? DEFAULT_SEED;
    this.runtime = deps.runtime ?? new BraidedRuntime({ ledger: this.ledger });
    this.omega = deps.omega ?? new OmegaSupervisor({
      ledger: this.ledger,
      seedState: this.seedState
    });
    this.uploadManager = deps.uploadManager ?? new FileUploadManager(this.ledger);
  }

  async process(intent: UserIntent, monitor: SystemMonitorInput = {}): Promise<SystemProcessResult> {
    const runtime = await this.runtime.run(intent);
    const omega = this.omega.tick({
      liveState: monitor.liveState ?? this.seedState,
      pulseAlive: monitor.pulseAlive ?? true
    });

    return Object.freeze({ runtime, omega });
  }

  tick(monitor: SystemMonitorInput = {}): OmegaStatus {
    return this.omega.tick({
      liveState: monitor.liveState ?? this.seedState,
      pulseAlive: monitor.pulseAlive ?? true
    });
  }

  connectToStitch(): { readonly message: string; readonly signature: string; readonly at: string } {
    return this.omega.connectToStitch();
  }

  status(): OmegaStatus {
    return this.omega.status();
  }

  ledgerEntries(): readonly AuditEntry[] {
    return this.ledger.entries();
  }

  ledgerValid(): boolean {
    return this.ledger.verifyChain();
  }
}
