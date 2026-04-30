import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src";

test("audit ledger is append-only through public API and hash-chain verified", () => {
  const ledger = new AuditLedger();

  const first = ledger.append({
    traceId: "trace-ledger",
    from: "intent",
    to: "spine",
    status: "started",
    at: "2026-04-29T00:00:00.000Z",
    detail: { intentId: "x" }
  });

  const second = ledger.append({
    traceId: "trace-ledger",
    from: "spine",
    to: "truth.pre",
    status: "passed",
    at: "2026-04-29T00:00:00.000Z",
    detail: { ok: true }
  });

  assert.equal(first.previousHash, "GENESIS");
  assert.equal(second.previousHash, first.hash);
  assert.equal(ledger.entries().length, 2);
  assert.equal(ledger.verifyChain(), true);
});
