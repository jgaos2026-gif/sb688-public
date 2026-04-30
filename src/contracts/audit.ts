import type { RuntimeStage } from "./result";

export interface AuditTransition {
  readonly traceId: string;
  readonly from: RuntimeStage;
  readonly to: RuntimeStage;
  readonly status: "started" | "passed" | "failed" | "recovered";
  readonly at: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface AuditEntry extends AuditTransition {
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
}
