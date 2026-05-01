import type { AuditEntry } from "../contracts/audit";
import type { RuntimeResponse, UserIntent } from "../contracts/runtime";
import { AuditLedger } from "../ledger/AuditLedger";
import { OmegaSupervisor } from "../omega/OmegaSupervisor";
import type { OmegaStatus } from "../omega/contracts";
import { BraidedRuntime } from "../runtime/BraidedRuntime";
import { SentinelMonitor } from "../sentinel/SentinelMonitor";
import type { SentinelReport } from "../sentinel/contracts";

export interface IntegratedSystemDeps {
  readonly ledger?: AuditLedger;
  readonly runtime?: BraidedRuntime;
  readonly omega?: OmegaSupervisor;
  readonly sentinel?: SentinelMonitor;
  readonly seedState?: Readonly<Record<string, unknown>>;
}

export interface SystemMonitorInput {
  readonly liveState?: Readonly<Record<string, unknown>>;
  readonly pulseAlive?: boolean;
}

export interface SystemProcessResult {
  readonly runtime: RuntimeResponse;
  readonly omega: OmegaStatus;
  readonly sentinel: SentinelReport;
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
  private readonly sentinel: SentinelMonitor;
  private readonly seedState: Readonly<Record<string, unknown>>;

  constructor(deps: IntegratedSystemDeps = {}) {
    this.ledger = deps.ledger ?? new AuditLedger();
    this.seedState = deps.seedState ?? DEFAULT_SEED;
    this.runtime = deps.runtime ?? new BraidedRuntime({ ledger: this.ledger });
    this.omega = deps.omega ?? new OmegaSupervisor({
      ledger: this.ledger,
      seedState: this.seedState
    });
    this.sentinel = deps.sentinel ?? new SentinelMonitor({ ledger: this.ledger });
  }

  async process(intent: UserIntent, monitor: SystemMonitorInput = {}): Promise<SystemProcessResult> {
    const runtime = await this.runtime.run(intent);
    const omega = this.omega.tick({
      liveState: monitor.liveState ?? this.seedState,
      pulseAlive: monitor.pulseAlive ?? true
    });
    const sentinel = this.sentinel.monitor(omega);

    return Object.freeze({ runtime, omega, sentinel });
  }

  tick(monitor: SystemMonitorInput = {}): OmegaStatus {
    return this.omega.tick({
      liveState: monitor.liveState ?? this.seedState,
      pulseAlive: monitor.pulseAlive ?? true
    });
  }

  /** Tick both omega and the sentinel layer together, returning both reports. */
  tickWithSentinel(monitor: SystemMonitorInput = {}): { omega: OmegaStatus; sentinel: SentinelReport } {
    const omega = this.tick(monitor);
    const sentinel = this.sentinel.monitor(omega);
    return Object.freeze({ omega, sentinel });
  }

  connectToStitch(): { readonly message: string; readonly signature: string; readonly at: string } {
    return this.omega.connectToStitch();
  }

  status(): OmegaStatus {
    return this.omega.status();
  }

  sentinelStatus(): SentinelReport | undefined {
    const history = this.sentinel.reportHistory();
    return history[history.length - 1];
  }

  ledgerEntries(): readonly AuditEntry[] {
    return this.ledger.entries();
  }

  ledgerValid(): boolean {
    return this.ledger.verifyChain();
  }
}
