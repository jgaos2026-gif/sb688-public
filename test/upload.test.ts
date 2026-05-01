import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger } from "../src/ledger/AuditLedger";
import { FileUploadManager } from "../src/upload/FileUploadManager";
import { UploadSentinel } from "../src/upload/UploadSentinel";
import { IntegratedSystem } from "../src/system/IntegratedSystem";
import { fixedClock } from "../src/utils/time";

const AT = "2026-05-01T00:00:00.000Z";

test("UploadSentinel accepts a valid file", () => {
  const sentinel = new UploadSentinel();
  const result = sentinel.scan("invoice.json", '{"amount":100}', "application/json");
  assert.equal(result.clean, true);
  assert.equal(result.anomalies.length, 0);
  assert.ok(result.contentHash.startsWith("fnv1a:"));
});

test("UploadSentinel rejects empty content", () => {
  const sentinel = new UploadSentinel();
  const result = sentinel.scan("empty.txt", "", "text/plain");
  assert.equal(result.clean, false);
  assert.ok(result.anomalies.includes("empty_content"));
});

test("UploadSentinel rejects suspicious filenames", () => {
  const sentinel = new UploadSentinel();
  const result = sentinel.scan("../../etc/passwd", "data", "text/plain");
  assert.equal(result.clean, false);
  assert.ok(result.anomalies.includes("suspicious_filename"));
});

test("UploadSentinel rejects unsupported content type", () => {
  const sentinel = new UploadSentinel();
  const result = sentinel.scan("file.exe", "binary", "application/x-msdownload");
  assert.equal(result.clean, false);
  assert.ok(result.anomalies.some((a) => a.startsWith("unsupported_content_type")));
});

test("UploadSentinel detects duplicate content", () => {
  const sentinel = new UploadSentinel();
  sentinel.scan("a.txt", "same-content", "text/plain");
  const second = sentinel.scan("b.txt", "same-content", "text/plain");
  assert.equal(second.clean, false);
  assert.ok(second.anomalies.includes("duplicate_content_hash"));
});

test("FileUploadManager accepts a valid upload and records it in the audit ledger", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  const result = mgr.receive({
    filename: "report.txt",
    content: "Q1 financial report",
    contentType: "text/plain"
  });

  assert.equal(result.accepted, true);
  assert.equal(result.filename, "report.txt");
  assert.equal(result.anomalies.length, 0);
  assert.ok(result.contentHash.startsWith("fnv1a:"));
  assert.equal(ledger.verifyChain(), true);
  assert.ok(ledger.entries().length > 0);
});

test("FileUploadManager rejects a file flagged by the sentinel", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  const result = mgr.receive({
    filename: "../traversal.txt",
    content: "bad",
    contentType: "text/plain"
  });

  assert.equal(result.accepted, false);
  assert.ok(result.anomalies.includes("suspicious_filename"));
  assert.equal(ledger.verifyChain(), true);
});

test("FileUploadManager dispatches a stored file and logs it", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  mgr.receive({ filename: "invoice.json", content: '{"total":200}', contentType: "application/json" });
  const result = mgr.dispatch({ filename: "invoice.json", destination: "invoices" });

  assert.equal(result.dispatched, true);
  assert.equal(result.filename, "invoice.json");
  assert.equal(result.destination, "invoices");
  assert.equal(ledger.verifyChain(), true);
});

test("FileUploadManager refuses dispatch of unknown file", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  const result = mgr.dispatch({ filename: "missing.txt", destination: "archive" });

  assert.equal(result.dispatched, false);
  assert.equal(result.contentHash, "none");
});

test("FileUploadManager refuses dispatch to invalid destination", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  mgr.receive({ filename: "state.json", content: '{"v":1}', contentType: "application/json" });
  const result = mgr.dispatch({ filename: "state.json", destination: "../etc/secrets" });

  assert.equal(result.dispatched, false);
});

test("FileUploadManager upload log is tamper-evident", () => {
  const ledger = new AuditLedger();
  const mgr = new FileUploadManager(ledger, undefined, fixedClock(AT));

  mgr.receive({ filename: "a.txt", content: "hello", contentType: "text/plain" });
  mgr.dispatch({ filename: "a.txt", destination: "archive" });

  assert.equal(mgr.verifyUploadLog(), true);
  assert.equal(mgr.uploadLog().length, 2);
});

test("IntegratedSystem exposes uploadManager that shares the audit ledger", () => {
  const system = new IntegratedSystem();
  const result = system.uploadManager.receive({
    filename: "manifest.json",
    content: '{"bricks":["SEED"]}',
    contentType: "application/json"
  });

  assert.equal(result.accepted, true);
  assert.equal(system.ledgerValid(), true);
  assert.ok(system.ledgerEntries().length > 0);
  assert.equal(system.uploadManager.verifyUploadLog(), true);
});
