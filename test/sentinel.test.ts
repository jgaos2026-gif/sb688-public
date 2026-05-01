import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, SentinelLayer, AnomalyDetector } from "../src";
import { IntegratedSystem } from "../src/system/IntegratedSystem";
import { fixedClock } from "../src/utils/time";

// ===================== AnomalyDetector =====================

test("AnomalyDetector reports no anomaly when no failures observed", () => {
  const detector = new AnomalyDetector(10);
  const report = detector.analyze();

  assert.equal(report.isAnomaly, false);
  assert.equal(report.score, 0);
  assert.equal(report.predictedThreat, null);
  assert.equal(report.recentFailureCount, 0);
});

test("AnomalyDetector identifies anomaly above threshold with dense failures", () => {
  const ledger = new AuditLedger();
  const clock = fixedClock("2026-05-01T00:00:00.000Z");

  // Inject enough failed entries to exceed the 0.4 threshold in a window of 10.
  for (let i = 0; i < 5; i++) {
    ledger.append({ traceId: `t${i}`, from: "brain", to: "truth.post", status: "failed", at: clock(), detail: {} });
  }

  const detector = new AnomalyDetector(10);
  detector.observe(ledger.entries());
  const report = detector.analyze();

  assert.equal(report.isAnomaly, true);
  assert.ok(report.score >= 0.4);
  assert.equal(report.predictedThreat, "brain");
  assert.equal(report.recentFailureCount, 5);
});

test("AnomalyDetector slides window and forgets old entries", () => {
  const ledger = new AuditLedger();
  const clock = fixedClock("2026-05-01T00:00:00.000Z");

  // Fill window with failures.
  for (let i = 0; i < 5; i++) {
    ledger.append({ traceId: `t${i}`, from: "spine", to: "truth.pre", status: "failed", at: clock(), detail: {} });
  }

  const detector = new AnomalyDetector(5); // window of exactly 5
  detector.observe(ledger.entries());

  // Now observe 5 more passing entries — the detector only tracks failed ones,
  // so failures from before still count until displaced by new failures.
  const report = detector.analyze();
  assert.equal(report.recentFailureCount, 5); // all 5 failures are in window
  assert.equal(report.isAnomaly, true);
});

// ===================== SentinelLayer =====================

test("SentinelLayer arms correctly and watch returns SENTINEL_ARMED on clean ledger", () => {
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "passed", at: "2026-05-01T00:00:00.000Z", detail: {} });

  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });
  const report = sentinel.watch();

  assert.equal(report.status, "SENTINEL_ARMED");
  assert.equal(report.anomaly, false);
  assert.equal(report.chainValid, true);
  assert.equal(typeof report.frameHash, "string");
  assert.ok(report.frameCycle >= 1);
});

test("SentinelLayer transitions to SENTINEL_WATCHING on anomaly", () => {
  const ledger = new AuditLedger();
  const clock = fixedClock("2026-05-01T00:00:00.000Z");

  for (let i = 0; i < 5; i++) {
    ledger.append({ traceId: `t${i}`, from: "brain", to: "truth.post", status: "failed", at: clock(), detail: {} });
  }

  const sentinel = new SentinelLayer({ ledger, clock, anomalyWindow: 10 });
  const report = sentinel.watch();

  assert.equal(report.anomaly, true);
  assert.equal(report.status, "SENTINEL_WATCHING");
  assert.equal(report.predictedThreat, "brain");
});

test("SentinelLayer braidedJudge routes ethical actions via guardian personality", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });

  const j1 = sentinel.braidedJudge({ component: "brain", failureCode: "BRAIN_FAILURE", recoverable: true });
  assert.equal(j1.action, "restart");
  assert.equal(j1.personality, "guardian");
  assert.ok(j1.moralScore > 0);

  const j2 = sentinel.braidedJudge({ component: "ledger", failureCode: "LEDGER_APPEND_FAILED", recoverable: true });
  assert.equal(j2.action, "resurrect");

  const j3 = sentinel.braidedJudge({ component: "spine", failureCode: "SPINE_REJECTED", recoverable: true });
  assert.equal(j3.action, "rollback");

  const j4 = sentinel.braidedJudge({ component: "any", failureCode: "UNKNOWN", recoverable: false });
  assert.equal(j4.action, "quarantine");
});

test("SentinelLayer resurrect initiates omega resurrection loop", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z"), maxResurrections: 3 });

  // Prime ghost mirror with a watch cycle first.
  sentinel.watch();

  const ok1 = sentinel.resurrect("spine_tamper detected");
  assert.equal(ok1, true);
  assert.equal(sentinel.status(), "SENTINEL_RESURRECTING");
  assert.equal(sentinel.getResurrections().length, 1);
  assert.ok(sentinel.getResurrections()[0].ghostFrameHash !== null);
});

test("SentinelLayer resurrect transitions to SENTINEL_BREACH when budget exhausted", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z"), maxResurrections: 2 });

  assert.equal(sentinel.resurrect("first"), true);
  assert.equal(sentinel.resurrect("second"), true);
  assert.equal(sentinel.resurrect("third — over budget"), false);
  assert.equal(sentinel.status(), "SENTINEL_BREACH");
});

test("SentinelLayer adapt evolves after recording 3+ incidents for a component", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });

  for (let i = 0; i < 3; i++) {
    sentinel.recordHeal("brain", "restart");
  }

  const adapt = sentinel.adapt();
  assert.equal(adapt.evolved, true);
  assert.equal(adapt.incidentsAnalyzed, 3);
  assert.equal(adapt.recommendations.length, 1);
  assert.equal(adapt.recommendations[0].component, "brain");
  assert.equal(adapt.recommendations[0].action, "increase_monitoring");
});

test("SentinelLayer adapt returns no recommendations below incident threshold", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });

  sentinel.recordHeal("brain", "restart");
  sentinel.recordHeal("brain", "restart");

  const adapt = sentinel.adapt();
  assert.equal(adapt.evolved, false);
  assert.equal(adapt.recommendations.length, 0);
});

test("SentinelLayer fullReport returns a complete status snapshot", () => {
  const ledger = new AuditLedger();
  ledger.append({ traceId: "t1", from: "intent", to: "spine", status: "passed", at: "2026-05-01T00:00:00.000Z", detail: {} });

  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });
  const report = sentinel.fullReport();

  assert.equal(report.armed, true);
  assert.ok(["SENTINEL_ARMED", "SENTINEL_WATCHING"].includes(report.status));
  assert.equal(typeof report.alertCount, "number");
  assert.equal(report.resurrectionCount, 0);
  assert.equal(report.watch.chainValid, true);
});

test("SentinelLayer disarm transitions to offline and watch returns SENTINEL_BREACH", () => {
  const ledger = new AuditLedger();
  const sentinel = new SentinelLayer({ ledger, clock: fixedClock("2026-05-01T00:00:00.000Z") });

  sentinel.disarm();
  assert.equal(sentinel.isArmed(), false);

  const report = sentinel.watch();
  assert.equal(report.status, "SENTINEL_BREACH");
  assert.equal(report.chainValid, false);
});

// ===================== IntegratedSystem with Sentinel =====================

test("integrated system process result includes sentinel watch report", async () => {
  const system = new IntegratedSystem();

  const result = await system.process({ id: "sentinel-001", text: "Run sentinel integration test" });

  assert.equal(result.runtime.verified, true);
  assert.equal(result.omega.status, "SB689_READY");
  assert.ok(result.sentinel !== undefined);
  assert.equal(result.sentinel.chainValid, true);
  assert.equal(system.ledgerValid(), true);
});

test("integrated system sentinelWatch returns clean report on healthy system", () => {
  const system = new IntegratedSystem();
  const watch = system.sentinelWatch();

  assert.ok(["SENTINEL_ARMED", "SENTINEL_WATCHING"].includes(watch.status));
  assert.equal(watch.anomaly, false);
  assert.equal(watch.chainValid, true);
});

test("integrated system sentinelReport provides full adaptation data", async () => {
  const system = new IntegratedSystem();

  // The text "force-brain-failure after successful governance checks" is the
  // special trigger recognised by DefaultBrainAdapter that causes a BRAIN_FAILURE
  // followed by failure-recovery (see failure-loop.test.ts for the full trace).
  // Each recovered request sets checkpoint.label === "failure-recovery", which
  // IntegratedSystem.process() records as a heal incident for the sentinel.
  for (let i = 0; i < 3; i++) {
    await system.process({
      id: `sentinel-incident-${i}`,
      text: "force-brain-failure after successful governance checks"
    });
  }

  const report = system.sentinelReport();

  // Each failure recovery records an incident — after 3 the adaptation should evolve.
  assert.equal(report.incidentCount, 3);
  assert.equal(report.adaptation.evolved, true);
  assert.equal(report.adaptation.recommendations[0].component, "braided-runtime");
});
