import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, BraidedRuntime } from "../src";
import { fixedClock } from "../src/utils/time";

test("core loop enforces ordered SB689 execution and checkpoints verified output", async () => {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger, clock: fixedClock("2026-04-29T00:00:00.000Z") });

  const response = await runtime.run({
    id: "core-loop",
    text: "Build the SB689 runtime through the governed path."
  });

  assert.equal(response.verified, true);
  assert.equal(response.checkpoint?.label, "verified-output");
  assert.equal(ledger.verifyChain(), true);

  const transitions = ledger.entries().map((entry) => `${entry.from}->${entry.to}`);
  // Finding 03: brain->truth.post is recorded TWICE — "started" before
  // post-brain verification runs, "passed" only after it succeeds.
  assert.deepEqual(transitions, [
    "intent->spine",
    "spine->truth.pre",
    "truth.pre->conscious-brick",
    "conscious-brick->stem",
    "stem->brain",
    "brain->truth.post",
    "brain->truth.post",
    "truth.post->ghost-node",
    "ghost-node->ledger",
    "ledger->response"
  ]);
  const postBrain = ledger.entries().filter((e) => e.from === "brain" && e.to === "truth.post");
  assert.deepEqual(postBrain.map((e) => e.status), ["started", "passed"]);
});
