import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, BraidedRuntime } from "../src";
import { fixedClock } from "../src/utils/time";

test("failure loop detects, isolates, rolls back, restitches, verifies, logs, and checkpoints", async () => {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock("2026-04-29T00:00:00.000Z") });

  const response = await runtime.run({
    id: "failure-loop",
    text: "force-brain-failure after successful governance checks"
  });

  assert.equal(response.verified, true);
  assert.equal(response.checkpoint?.label, "failure-recovery");
  assert.ok(response.output.includes("Runtime recovered in degraded mode"));
  assert.equal(ledger.verifyChain(), true);

  const transitions = ledger.entries().map((entry) => `${entry.from}->${entry.to}`);
  assert.ok(transitions.includes("brain->failure.detect"));
  assert.ok(transitions.includes("failure.detect->failure.isolate"));
  assert.ok(transitions.includes("failure.isolate->failure.rollback"));
  assert.ok(transitions.includes("failure.rollback->failure.restitch"));
  assert.ok(transitions.includes("failure.restitch->failure.verify"));
  assert.ok(transitions.includes("failure.verify->failure.log"));
  assert.ok(transitions.includes("failure.log->failure.checkpoint"));
});
