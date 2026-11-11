/**
 * Red-team regression tests — findings 04 (real rollback) and 05
 * (recovery verified on ALL FOUR checks, or explicitly unverified).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, BraidedRuntime } from "../src";
import { FailureManager, type RollbackParticipant } from "../src/failure/FailureManager";
import { LiquidTruthNodeMesh } from "../src/truth/LiquidTruthNodeMesh";
import { GhostNode, responseState } from "../src/ghost/GhostNode";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const INTENT = { id: "failure-001", text: "do the thing" };
const ERROR = { code: "BRAIN_FAILURE", stage: "brain", message: "boom", recoverable: true } as const;

/** A real in-memory mutable component that can snapshot/restore itself. */
class CounterStore implements RollbackParticipant {
  readonly name = "counter-store";
  private state: { count: number; label: string };

  constructor(initial = { count: 0, label: "start" }) {
    this.state = { ...initial };
  }

  get count(): number {
    return this.state.count;
  }

  mutate(count: number, label: string): void {
    this.state = { count, label };
  }

  captureState(): unknown {
    return { ...this.state };
  }

  restoreState(captured: unknown): boolean {
    const c = captured as { count: number; label: string };
    if (typeof c.count !== "number" || typeof c.label !== "string") return false;
    this.state = { ...c };
    return true;
  }

  stateHash(): string {
    return hashOf(this.state);
  }
}

function makeManager(opts: { participants?: readonly RollbackParticipant[]; ledger?: AuditLedger; ghost?: GhostNode } = {}) {
  const ledger = opts.ledger ?? new AuditLedger();
  const truth = new LiquidTruthNodeMesh();
  const ghost = opts.ghost ?? new GhostNode(fixedClock(AT));
  const fm = new FailureManager(ledger, truth, ghost, fixedClock(AT), {
    rollbackParticipants: opts.participants ?? []
  });
  return { ledger, fm };
}

import type { RollbackParticipantState } from "../src/contracts/runtime";

function stableSnapshot(ledger: AuditLedger, participant?: CounterStore) {
  const participantStates: Record<string, RollbackParticipantState> = {};
  if (participant) {
    participantStates[participant.name] = { captured: participant.captureState(), hash: participant.stateHash() };
  }
  return {
    traceId: "trace-fm",
    intent: INTENT,
    stage: "stem" as const,
    auditHash: ledger.latestHash(),
    stable: true,
    participantStates
  };
}

// ─── Finding 04 ─────────────────────────────────────────────────────────────

test("04: rollback really restores participant state and hash-verifies it", () => {
  const store = new CounterStore({ count: 1, label: "stable" });
  const { ledger, fm } = makeManager({ participants: [store] });
  ledger.append({ traceId: "t", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const snapshot = stableSnapshot(ledger, store);
  // The failure happens AFTER the component moved on.
  store.mutate(99, "mid-flight");
  const response = fm.recover({ traceId: "trace-fm", intent: INTENT, error: ERROR, currentStage: "brain", lastStableSnapshot: snapshot });
  assert.equal(store.count, 1, "participant state must be restored to the snapshot");
  assert.equal(response.verified, true);
  assert.match(response.output, /VERIFIED/);
  const verifyEntry = ledger.entries().find((e) => e.to === "failure.verify");
  assert.equal(verifyEntry?.status, "passed");
  assert.equal((verifyEntry?.detail as { rollbackVerified: boolean }).rollbackVerified, true);
});

test("04: a participant that cannot restore makes the response unverified", () => {
  const broken: RollbackParticipant = {
    name: "broken-store",
    captureState: () => ({ x: 1 }),
    restoreState: () => false,
    stateHash: () => hashOf({ x: 1 })
  };
  const { ledger, fm } = makeManager({ participants: [broken] });
  ledger.append({ traceId: "t", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const snapshot = {
    traceId: "trace-fm",
    intent: INTENT,
    stage: "stem" as const,
    auditHash: ledger.latestHash(),
    stable: true,
    participantStates: { "broken-store": { captured: { x: 1 }, hash: hashOf({ x: 1 }) } }
  };
  const response = fm.recover({ traceId: "trace-fm", intent: INTENT, error: ERROR, currentStage: "brain", lastStableSnapshot: snapshot });
  assert.equal(response.verified, false);
  assert.match(response.output, /UNVERIFIED/);
  assert.match(response.output, /rollback/);
});

test("04: a rollback to a snapshot that is not in the ledger is unverified", () => {
  const { fm } = makeManager();
  const snapshot = {
    traceId: "trace-fm",
    intent: INTENT,
    stage: "stem" as const,
    auditHash: "sha256:" + "ff".repeat(32),
    stable: true
  };
  const response = fm.recover({ traceId: "trace-fm", intent: INTENT, error: ERROR, currentStage: "brain", lastStableSnapshot: snapshot });
  assert.equal(response.verified, false);
  assert.match(response.output, /UNVERIFIED/);
});

test("04: a participant with no captured state cannot be shown restored", () => {
  const store = new CounterStore();
  const { ledger, fm } = makeManager({ participants: [store] });
  ledger.append({ traceId: "t", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  // Snapshot taken without capturing this participant.
  const snapshot = stableSnapshot(ledger);
  const response = fm.recover({ traceId: "trace-fm", intent: INTENT, error: ERROR, currentStage: "brain", lastStableSnapshot: snapshot });
  assert.equal(response.verified, false);
  assert.match(response.output, /UNVERIFIED/);
});

test("04: rollback works end to end through the runtime with a participant", async () => {
  const store = new CounterStore({ count: 7, label: "stable" });
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({
    ledger,
    clock: fixedClock(AT),
    rollbackParticipants: [store]
  });
  // Mutate after the runtime's snapshots are taken is not possible from
  // outside mid-run; instead assert the plumbing: a brain failure still
  // verifies when the participant restores cleanly from its snapshots.
  const response = await runtime.run({ id: "failure-rt", text: "force-brain-failure now" });
  assert.equal(response.verified, true);
  assert.equal(store.count, 7);
});

// ─── Finding 05 ─────────────────────────────────────────────────────────────

test("05: a broken audit chain makes the recovery unverified, not verified-on-truth-alone", () => {
  // A ledger stub whose chain reports invalid while appends still work.
  const appended: Array<Record<string, unknown>> = [];
  const stubLedger = {
    append(transition: Record<string, unknown>) {
      const entry = { ...transition, sequence: appended.length + 1, previousHash: "GENESIS", hash: "sha256:" + "aa".repeat(32) };
      appended.push(entry);
      return entry;
    },
    entries: () => appended,
    latestHash: () => "GENESIS",
    verifyChain: () => false
  };
  const truth = new LiquidTruthNodeMesh();
  const ghost = new GhostNode(fixedClock(AT));
  const fm = new FailureManager(stubLedger as never, truth, ghost, fixedClock(AT));
  const response = fm.recover({
    traceId: "trace-fm",
    intent: INTENT,
    error: ERROR,
    currentStage: "brain",
    lastStableSnapshot: { traceId: "trace-fm", intent: INTENT, stage: "stem", auditHash: "GENESIS", stable: true }
  });
  assert.equal(response.verified, false, "recovery truth alone must never verify a response");
  assert.match(response.output, /UNVERIFIED/);
  assert.match(response.output, /audit-chain/);
});

test("05: a checkpoint whose hash does not match makes the recovery unverified", () => {
  const lyingGhost = {
    checkpoint: () => ({
      id: "ghost_fake",
      intentId: INTENT.id,
      createdAt: AT,
      stage: "failure.checkpoint",
      stateHash: "sha256:" + "00".repeat(32),
      label: "failure-recovery"
    })
  };
  const { ledger, fm } = makeManager({ ghost: lyingGhost as never });
  ledger.append({ traceId: "t", from: "intent", to: "spine", status: "started", at: AT, detail: {} });
  const response = fm.recover({
    traceId: "trace-fm",
    intent: INTENT,
    error: ERROR,
    currentStage: "brain",
    lastStableSnapshot: stableSnapshot(ledger)
  });
  assert.equal(response.verified, false);
  assert.match(response.output, /UNVERIFIED/);
  assert.match(response.output, /checkpoint-hash/);
});

test("05: a fully verified recovery says VERIFIED and its checkpoint hash recomputes", async () => {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock(AT) });
  const response = await runtime.run({ id: "failure-05", text: "force-brain-failure now" });
  assert.equal(response.verified, true);
  assert.match(response.output, /Verification verdict: VERIFIED/);
  assert.ok(response.checkpoint);
  assert.equal(response.checkpoint.label, "failure-recovery");
  // The checkpoint covers the recovery body (output before the verdict
  // line); recompute it from the failure.checkpoint ledger entry.
  const checkpointEntry = ledger.entries().find((e) => e.to === "failure.checkpoint");
  assert.ok(checkpointEntry);
  const detail = checkpointEntry.detail as { coveredAuditHash: string };
  const body = response.output.split("\nVerification verdict:")[0];
  const recomputed = hashOf(responseState({
    traceId: response.traceId,
    output: body,
    verified: true,
    auditHash: detail.coveredAuditHash
  }));
  assert.equal(recomputed, response.checkpoint.stateHash);
});
