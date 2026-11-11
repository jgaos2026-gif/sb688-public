import test from "node:test";
import assert from "node:assert/strict";
import { OperatorAccessGate, type OperatorRequestContext } from "../src/security/OperatorAccessGate";

const gate = new OperatorAccessGate();
const base: OperatorRequestContext = { method: "POST", path: "/api/runtime/run", bodyBytes: 100, contentType: "application/json", tokenValid: true, sourceId: "operator-1", provenanceId: "session-1", declaredPolicyVersion: "v1", currentPolicyVersion: "v1" };

test("health is public", () => assert.equal(gate.authorize({ method: "GET", path: "/api/health", bodyBytes: 0, tokenValid: false, currentPolicyVersion: "v1" }).allowed, true));
test("ledger requires auth", () => assert.equal(gate.authorize({ method: "GET", path: "/api/ledger", bodyBytes: 0, tokenValid: false, currentPolicyVersion: "v1" }).statusCode, 401));
test("unknown route is closed", () => assert.equal(gate.authorize({ ...base, path: "/api/agent/configure" }).statusCode, 404));
test("mutation requires JSON", () => assert.equal(gate.authorize({ ...base, contentType: "text/plain" }).statusCode, 415));
test("mutation requires source and provenance", () => assert.equal(gate.authorize({ ...base, sourceId: "", provenanceId: "" }).allowed, false));
test("policy drift blocks", () => assert.equal(gate.authorize({ ...base, declaredPolicyVersion: "v0" }).allowed, false));
test("oversize blocks", () => assert.equal(gate.authorize({ ...base, bodyBytes: 3 * 1024 * 1024 }).statusCode, 413));
test("critical Stitch connect requires human approval checkpoint and evidence", () => { const d = gate.authorize({ ...base, path: "/api/omega/connect", humanApprovedCriticalChange: false }); assert.equal(d.allowed, false); assert.ok(d.reasons.length >= 3); });
test("critical Stitch connect passes complete gate", () => { const d = gate.authorize({ ...base, path: "/api/omega/connect", humanApprovedCriticalChange: true, checkpointId: "cp-1", evidenceRef: "ledger:1" }); assert.equal(d.allowed, true); });
