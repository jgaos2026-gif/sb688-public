/**
 * Red-team regression tests — findings 06 (deep-freeze ledger entries),
 * 07 (append fails closed on a corrupt chain) and 08 (JSONL persistence).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AuditLedger } from "../src";
import { BctVerifier } from "../src/truth/BctVerifier";

const AT = "2026-08-06T00:00:00.000Z";

function transition(detail: Record<string, unknown> = {}) {
  return { traceId: "t", from: "intent" as const, to: "spine" as const, status: "started" as const, at: AT, detail };
}

// ─── Finding 06 ─────────────────────────────────────────────────────────────

test("06: mutating a returned entry's nested detail cannot corrupt the ledger", () => {
  const ledger = new AuditLedger();
  ledger.append(transition({ nested: { count: 1 }, list: [1, 2] }));
  const returned = ledger.entries()[0];
  // Returned entries are deep-frozen: the mutation attempt itself throws
  // instead of silently reaching the stored record.
  assert.throws(() => {
    (returned.detail as unknown as { nested: { count: number } }).nested.count = 99;
  }, TypeError);
  assert.throws(() => {
    (returned.detail as unknown as { list: number[] }).list.push(3);
  }, TypeError);
  assert.equal(ledger.verifyChain(), true);
  const stored = ledger.entries()[0].detail as unknown as { nested: { count: number }; list: number[] };
  assert.equal(stored.nested.count, 1);
  assert.deepEqual(stored.list, [1, 2]);
});

test("06: mutating the object passed to append after the fact cannot corrupt the ledger", () => {
  const ledger = new AuditLedger();
  const detail: { nested: { count: number } } = { nested: { count: 1 } };
  ledger.append(transition(detail));
  detail.nested.count = 99;
  assert.equal(ledger.verifyChain(), true);
  const stored = ledger.entries()[0].detail as unknown as { nested: { count: number } };
  assert.equal(stored.nested.count, 1);
});

test("06: returned entries are deep-frozen (mutation throws instead of silently corrupting)", () => {
  const ledger = new AuditLedger();
  ledger.append(transition({ nested: { count: 1 } }));
  const returned = ledger.entries()[0];
  assert.throws(() => {
    (returned.detail as unknown as { nested: { count: number } }).nested.count = 5;
  }, TypeError);
});

// ─── Finding 07 ─────────────────────────────────────────────────────────────

test("07: appending to a corrupted chain fails closed", () => {
  const ledger = new AuditLedger();
  ledger.append(transition());
  const store = (ledger as unknown as { store: Array<Record<string, unknown>> }).store;
  store[0] = { ...store[0], detail: { tampered: true } };
  assert.equal(ledger.verifyChain(), false);
  assert.throws(() => ledger.append(transition()), /LEDGER_CHAIN_CORRUPT/);
  // The corrupt entry is still there to be investigated — nothing was hidden.
  assert.equal(ledger.entries().length, 1);
});

test("07: a verifier on a corrupt ledger reports the failure instead of throwing", () => {
  const ledger = new AuditLedger();
  ledger.append(transition());
  const store = (ledger as unknown as { store: Array<Record<string, unknown>> }).store;
  store[0] = { ...store[0], detail: { tampered: true } };
  const v = new BctVerifier(ledger);
  let result: unknown;
  assert.doesNotThrow(() => {
    result = v.verify({
      identity: "x",
      state: {},
      declaredHash: "sha256:" + "00".repeat(32),
      braidSignature: "sha256:x",
      spineSignature: "sha256:y",
      priorAuditHash: "GENESIS"
    });
  });
  const r = result as { trusted: boolean; ledgerAppendFailed?: boolean };
  assert.equal(r.trusted, false);
  assert.equal(r.ledgerAppendFailed, true);
});

// ─── Finding 08 ─────────────────────────────────────────────────────────────

test("08: ledger history survives a restart via JSONL persistence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb688-ledger-"));
  const filePath = path.join(dir, "audit-ledger.jsonl");
  const first = new AuditLedger({ filePath });
  first.append(transition({ n: 1 }));
  first.append({ traceId: "t", from: "spine", to: "truth.pre", status: "passed", at: AT, detail: { n: 2 } });
  assert.equal(fs.readFileSync(filePath, "utf-8").trim().split("\n").length, 2);

  const second = new AuditLedger({ filePath });
  assert.equal(second.entries().length, 2);
  assert.equal(second.verifyChain(), true);
  assert.equal(second.latestHash(), first.latestHash());

  second.append({ traceId: "t", from: "truth.pre", to: "conscious-brick", status: "passed", at: AT, detail: { n: 3 } });
  assert.equal(fs.readFileSync(filePath, "utf-8").trim().split("\n").length, 3);
  const third = new AuditLedger({ filePath });
  assert.equal(third.entries().length, 3);
  assert.equal(third.verifyChain(), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("08: a missing persistence file starts empty and is created on first append", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb688-ledger-"));
  const filePath = path.join(dir, "sub", "audit-ledger.jsonl");
  const ledger = new AuditLedger({ filePath });
  assert.equal(ledger.entries().length, 0);
  ledger.append(transition());
  assert.ok(fs.existsSync(filePath));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("08: a tampered persistence file fails construction instead of loading a broken chain", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb688-ledger-"));
  const filePath = path.join(dir, "audit-ledger.jsonl");
  const ledger = new AuditLedger({ filePath });
  ledger.append(transition({ n: 1 }));
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  const tampered = JSON.parse(lines[0]) as Record<string, unknown>;
  tampered.detail = { n: 999 };
  fs.writeFileSync(filePath, `${JSON.stringify(tampered)}\n`, "utf-8");
  assert.throws(() => new AuditLedger({ filePath }), /LEDGER_LOAD_FAILED/);
  fs.rmSync(dir, { recursive: true, force: true });
});
