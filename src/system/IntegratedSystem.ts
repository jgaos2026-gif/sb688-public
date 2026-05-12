import type { AuditEntry } from "../contracts/audit";
import type { RuntimeResponse, UserIntent } from "../contracts/runtime";
import { AuditLedger } from "../ledger/AuditLedger";
import { OmegaSupervisor } from "../omega/OmegaSupervisor";
import type { OmegaStatus } from "../omega/contracts";
import { BraidedRuntime } from "../runtime/BraidedRuntime";
import { SentinelLayer } from "../sentinel/SentinelLayer";
import { SentinelMonitor } from "../sentinel/SentinelMonitor";
import type { SentinelFullReport, SentinelReport, SentinelWatchReport } from "../sentinel/contracts";
import { FileUploadManager } from "../upload/FileUploadManager";

export interface IntegratedSystemDeps {
  readonly ledger?: AuditLedger;
  readonly runtime?: BraidedRuntime;
  readonly omega?: OmegaSupervisor;
  readonly sentinel?: SentinelLayer;
  readonly monitor?: SentinelMonitor;
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
  readonly sentinel: SentinelWatchReport;
}

const DEFAULT_SEED: Readonly<Record<string, unknown>> = Object.freeze({
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
});

const RUNTIME_COMPONENT = "braided-runtime" as const;

export class IntegratedSystem {
  private readonly ledger: AuditLedger;
  private readonly runtime: BraidedRuntime;
  private readonly omega: OmegaSupervisor;
  private readonly sentinel: SentinelLayer;
  private readonly monitor: SentinelMonitor;
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
    this.sentinel = deps.sentinel ?? new SentinelLayer({ ledger: this.ledger });
    this.monitor = deps.monitor ?? new SentinelMonitor({ ledger: this.ledger });
    this.uploadManager = deps.uploadManager ?? new FileUploadManager(this.ledger);
  }

  async process(intent: UserIntent, monitorInput: SystemMonitorInput = {}): Promise<SystemProcessResult> {
    const runtime = await this.runtime.run(intent);
    const omega = this.omega.tick({
      liveState: monitorInput.liveState ?? this.seedState,
      pulseAlive: monitorInput.pulseAlive ?? true
    });
    const sentinel = this.sentinel.watch(monitorInput.liveState ?? this.seedState);
    this.monitor.monitor(omega);

    // Record heals when the runtime recovers from failures.
    if (runtime.checkpoint?.label === "failure-recovery") {
      this.sentinel.recordHeal(RUNTIME_COMPONENT, "failure-recovery");
    }

    return Object.freeze({ runtime, omega, sentinel });
  }

  tick(monitorInput: SystemMonitorInput = {}): OmegaStatus {
    return this.omega.tick({
      liveState: monitorInput.liveState ?? this.seedState,
      pulseAlive: monitorInput.pulseAlive ?? true
    });
  }

  /** Tick both omega and the sentinel monitor layer together, returning both reports. */
  tickWithSentinel(monitorInput: SystemMonitorInput = {}): { omega: OmegaStatus; sentinel: SentinelReport } {
    const omega = this.tick(monitorInput);
    const sentinel = this.monitor.monitor(omega);
    return Object.freeze({ omega, sentinel });
  }

  connectToStitch(): { readonly message: string; readonly signature: string; readonly at: string } {
    return this.omega.connectToStitch();
  }

  status(): OmegaStatus {
    return this.omega.status();
  }

  sentinelWatch(liveState?: Readonly<Record<string, unknown>>): SentinelWatchReport {
    return this.sentinel.watch(liveState);
  }

  sentinelReport(liveState?: Readonly<Record<string, unknown>>): SentinelFullReport {
    return this.sentinel.fullReport(liveState);
  }

  /** Returns the most recent SentinelMonitor report (or undefined if process/tick has not been called). */
  sentinelStatus(): SentinelReport | undefined {
    const history = this.monitor.reportHistory();
    return history[history.length - 1];
  }

  ledgerEntries(): readonly AuditEntry[] {
    return this.ledger.entries();
  }

  ledgerValid(): boolean {
    return this.ledger.verifyChain();
  }
}
