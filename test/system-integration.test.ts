import { test } from "node:test";
import assert from "node:assert/strict";
import { IntegratedSystem } from "../src/system/IntegratedSystem";

test("integrated system executes runtime and omega together", async () => {
  const system = new IntegratedSystem();

  const result = await system.process({
    id: "system-001",
    text: "Run complete system request"
  });

  assert.equal(result.runtime.verified, true);
  assert.equal(result.omega.status, "SB689_READY");
  assert.equal(system.ledgerValid(), true);
  assert.equal(system.ledgerEntries().length > 0, true);
});
