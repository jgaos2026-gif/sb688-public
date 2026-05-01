import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, OmegaSupervisor, SentinelMonitor } from "../src";
import { IntegratedSystem } from "../src/system/IntegratedSystem";
import { fixedClock } from "../src/utils/time";

const seedState = {
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
} as const;

function newOmega(): OmegaSupervisor {
  let t = 0;
  return new OmegaSupervisor({
    ledger: new AuditLedger(),
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel nominal path
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel reports NOMINAL threat level when omega is healthy and stable", () => {
  const omega = newOmega();
  const sentinel = new SentinelMonitor({ clock: fixedClock("2026-04-30T00:00:00.000Z") });

  const omegaStatus = omega.tick({ liveState: seedState, pulseAlive: true });
  const report = sentinel.monitor(omegaStatus);

  assert.equal(report.threatLevel, "NOMINAL");
  assert.equal(report.anomalies.length, 0);
  assert.equal(report.selfHealTriggered, false);
  assert.equal(report.incidentCount, 0);
  assert.ok(report.recommendation.includes("healthy"));
});

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel anomaly detection: resurrection event → WATCHFUL
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel detects resurrection event and escalates to WATCHFUL", () => {
  const omega = newOmega();
  const sentinel = new SentinelMonitor({ clock: fixedClock("2026-04-30T00:00:00.000Z") });

  const resurrectStatus = omega.tick({
    liveState: { ...seedState, owner: "TAMPERED" },
    pulseAlive: true
  });

  assert.equal(resurrectStatus.status, "SB689_RESURRECTING");
  const report = sentinel.monitor(resurrectStatus);

  assert.equal(report.threatLevel, "WATCHFUL");
  assert.ok(report.anomalies.length >= 1);
  assert.ok(report.anomalies.some((a) => a.kind === "resurrection_event"));
  assert.ok(report.incidentCount >= 1);
});

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel pulse-loss detection
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel detects pulse loss and records anomaly", () => {
  const omega = newOmega();
  const sentinel = new SentinelMonitor({ clock: fixedClock("2026-04-30T00:00:00.000Z") });

  const pulseLostStatus = omega.tick({ liveState: seedState, pulseAlive: false });
  const report = sentinel.monitor(pulseLostStatus);

  assert.ok(report.anomalies.some((a) => a.kind === "pulse_lost"));
  assert.ok(["WATCHFUL", "ELEVATED", "CRITICAL"].includes(report.threatLevel));
});

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel resurrection surge → ELEVATED + self-heal triggered
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel detects resurrection surge, escalates to ELEVATED, and triggers self-heal", () => {
  let t = 0;
  const omega = new OmegaSupervisor({
    ledger: new AuditLedger(),
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });

  // Use a low threshold so the surge fires quickly.
  const sentinel = new SentinelMonitor({
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    initialAlertThreshold: 2
  });

  let lastReport = sentinel.monitor(omega.tick({ liveState: { ...seedState, owner: "BAD" }, pulseAlive: true }));
  lastReport = sentinel.monitor(omega.tick({ liveState: { ...seedState, owner: "BAD" }, pulseAlive: true }));
  // Third resurrection — surge fires at >= alertThreshold (2).
  lastReport = sentinel.monitor(omega.tick({ liveState: { ...seedState, owner: "BAD" }, pulseAlive: true }));

  assert.ok(
    lastReport.threatLevel === "ELEVATED" || lastReport.threatLevel === "CRITICAL",
    `Expected ELEVATED or CRITICAL but got ${lastReport.threatLevel}`
  );
  assert.equal(lastReport.selfHealTriggered, true);
  assert.ok(lastReport.anomalies.some((a) => a.kind === "resurrection_surge"));
});

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel adaptive threshold evolution
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel tightens alert threshold adaptively when incident rate doubles threshold", () => {
  let t = 0;
  const omega = new OmegaSupervisor({
    ledger: new AuditLedger(),
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });

  const sentinel = new SentinelMonitor({
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    initialAlertThreshold: 3
  });

  // Generate 6 resurrections to trigger threshold tightening (6 >= 3 * 2).
  for (let i = 0; i < 6; i++) {
    sentinel.monitor(omega.tick({ liveState: { ...seedState, owner: "BAD" }, pulseAlive: true }));
  }

  const latestReport = sentinel.reportHistory().at(-1)!;
  assert.ok(latestReport.alertThreshold < 3, `Expected threshold < 3 but got ${latestReport.alertThreshold}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Sentinel incident history and tamper-evident ledger
// ──────────────────────────────────────────────────────────────────────────────

test("sentinel records incidents in its history and writes tamper-evident audit entries", () => {
  const ledger = new AuditLedger();
  let t = 0;
  const omega = new OmegaSupervisor({
    ledger,
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });

  const sentinel = new SentinelMonitor({ ledger, clock: fixedClock("2026-04-30T00:00:00.000Z") });

  sentinel.monitor(omega.tick({ liveState: seedState, pulseAlive: true }));
  sentinel.monitor(omega.tick({ liveState: { ...seedState, owner: "TAMPERED" }, pulseAlive: true }));

  assert.ok(sentinel.incidentHistory().length >= 1);
  assert.equal(ledger.verifyChain(), true);

  const sentinelEntries = ledger.entries().filter((e) =>
    e.traceId.startsWith("sentinel:")
  );
  assert.ok(sentinelEntries.length >= 1);
});

// ──────────────────────────────────────────────────────────────────────────────
// SentinelMonitor integrates with IntegratedSystem
// ──────────────────────────────────────────────────────────────────────────────

test("IntegratedSystem.process() includes a SentinelReport in the result", async () => {
  const system = new IntegratedSystem();

  const result = await system.process({ id: "sentinel-integration-001", text: "Run sentinel integration check." });

  assert.ok(result.sentinel !== undefined);
  assert.equal(typeof result.sentinel.threatLevel, "string");
  assert.ok(["NOMINAL", "WATCHFUL", "ELEVATED", "CRITICAL"].includes(result.sentinel.threatLevel));
  assert.equal(result.omega.status, "SB689_READY");
  assert.equal(system.ledgerValid(), true);
});

test("IntegratedSystem.tickWithSentinel() returns omega and sentinel reports together", () => {
  const system = new IntegratedSystem();

  const { omega, sentinel } = system.tickWithSentinel();

  assert.ok(omega.status === "SB689_READY");
  assert.equal(sentinel.threatLevel, "NOMINAL");
  assert.equal(sentinel.selfHealTriggered, false);
});

test("IntegratedSystem.sentinelStatus() returns the most recent sentinel report", async () => {
  const system = new IntegratedSystem();

  assert.equal(system.sentinelStatus(), undefined);

  await system.process({ id: "sent-status-001", text: "Check sentinel status." });

  const status = system.sentinelStatus();
  assert.ok(status !== undefined);
  assert.equal(status!.cycle, 1);
});
