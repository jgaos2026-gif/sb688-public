/**
 * Red-team round-3 regression tests — findings B, C, D, E, F, G, H,
 * registry validation, layerSchema `in` vs Object.hasOwn, key
 * provisioning failing visibly, durable permit replay, and the
 * anchored-verification argument check.
 *
 * Each finding was reproduced against the round-2 build before fixing
 * (see the round-3 report); these tests pin the fixed behaviour.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { AuditLedger } from "../src";
import { BctVerifier, BctHeadRegistry, computeBraidBindingHash, computeTransitionHash } from "../src/truth/BctVerifier";
import { verifyHeadAgainstLedger, InMemoryEvidenceLedger } from "../src/truth/EvidenceLedgerCrossCheck";
import { FailureManager, type RollbackParticipant } from "../src/failure/FailureManager";
import { LiquidTruthNodeMesh } from "../src/truth/LiquidTruthNodeMesh";
import { GhostNode } from "../src/ghost/GhostNode";
import { SpineGovernor } from "../src/spine/SpineGovernor";
import { generateSpineKeyPair } from "../src/truth/SpinePermitCrypto";
import { canonicalNumber, stableStringify, hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";

const AT = "2026-08-06T00:00:00.000Z";
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";
const INTENT = { id: "r3-001", text: "answer this" };
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "sb688-r3-"));
const cleanup = (dir: string) => fs.rmSync(dir, { recursive: true, force: true });
const transition = (detail: Record<string, unknown> = {}) => ({
  traceId: "t", from: "intent" as const, to: "spine" as const, status: "started" as const, at: AT, detail
});

function mustGovern(governor: SpineGovernor, intent: { id: string; text: string }) {
  const result = governor.govern(intent);
  if (!result.ok) throw new Error(`govern failed: ${result.error.message}`);
  return result.value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function runWorker(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const worker = path.join(__dirname, "..", "..", "test", "ledger-race-worker.mjs");
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [worker, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += String(d); });
    child.stderr?.on("data", (d) => { stderr += String(d); });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

// ─── Finding B: disk before memory ────────────────────────────────────────

test("B: a failed disk write leaves memory untouched (no entry the disk does not have)", () => {
  const dir = tmpDir();
  try {
    const filePath = path.join(dir, "ledger.jsonl");
    const ledger = new AuditLedger({ filePath });
    ledger.append(transition({ n: 1 }));
    // Break the disk write for the NEXT append: replace the file with a directory.
    fs.rmSync(filePath);
    fs.mkdirSync(filePath);
    assert.throws(() => ledger.append(transition({ n: 2 })), /EISDIR|ENOTDIR|EPERM/);
    assert.equal(ledger.entries().length, 1, "the failed entry must not be published to memory");
    assert.equal(ledger.verifyChain(), true);
    // And the ledger is still usable once the disk is back: the next
    // append chains off the durably recorded entry, not a phantom.
    fs.rmdirSync(filePath);
    ledger.append(transition({ n: 2 }));
    assert.equal(ledger.entries().length, 2);
    assert.equal(ledger.verifyChain(), true);
    const reloaded = new AuditLedger({ filePath });
    assert.equal(reloaded.entries().length, 2);
    assert.equal(reloaded.latestHash(), ledger.latestHash());
  } finally {
    cleanup(dir);
  }
});

test("B: a torn final line on load is recovered by truncation (interrupted write, never acknowledged)", () => {
  const dir = tmpDir();
  try {
    const filePath = path.join(dir, "ledger.jsonl");
    const ledger = new AuditLedger({ filePath });
    ledger.append(transition({ n: 1 }));
    // Simulate a crash mid-write: a truncated second line, no newline.
    fs.appendFileSync(filePath, '{"traceId":"t","from":"intent","to":"spine","status":"started","at":"2026-08-06T00:00:00.000Z","detail":{"n":2},"sequence":2,"previousHash":"sha256:');
    const reloaded = new AuditLedger({ filePath });
    assert.equal(reloaded.entries().length, 1);
    assert.equal(reloaded.verifyChain(), true);
    assert.equal(fs.readFileSync(filePath, "utf-8").trim().split("\n").length, 1, "the torn line is truncated away");
    reloaded.append(transition({ n: 2 }));
    assert.equal(reloaded.entries().length, 2);
    assert.equal(reloaded.verifyChain(), true);
  } finally {
    cleanup(dir);
  }
});

test("B: a corrupt line in the MIDDLE of the file still fails closed (tampering, not a torn write)", () => {
  const dir = tmpDir();
  try {
    const filePath = path.join(dir, "ledger.jsonl");
    const ledger = new AuditLedger({ filePath });
    ledger.append(transition({ n: 1 }));
    ledger.append(transition({ n: 2 }));
    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
    lines[0] = '{"tampered": true}';
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
    assert.throws(() => new AuditLedger({ filePath }), /LEDGER_LOAD_FAILED/);
  } finally {
    cleanup(dir);
  }
});

// ─── Finding C: multi-process coordination ────────────────────────────────

test("C: a second process that cannot get the single-writer lock fails closed (LEDGER_LOCK_TIMEOUT)", async () => {
  const dir = tmpDir();
  try {
    const filePath = path.join(dir, "ledger.jsonl");
    const ledger = new AuditLedger({ filePath, lockTimeoutMs: 500 });
    const worker = path.join(__dirname, "..", "..", "test", "ledger-race-worker.mjs");
    const holder = spawn(process.execPath, [worker, "hold-lock", filePath, "3000"], { stdio: ["ignore", "pipe", "pipe"] });
    let holderStderr = "";
    holder.stderr?.on("data", (d) => { holderStderr += String(d); });
    try {
      await waitFor(() => fs.existsSync(`${filePath}.lock`), 5000, "the holder to take the lock");
      assert.throws(() => ledger.append(transition()), /LEDGER_LOCK_TIMEOUT/);
      assert.equal(ledger.entries().length, 0, "the loser appends nothing, in memory or on disk");
      assert.equal(fs.existsSync(filePath), false, "the loser writes nothing");
    } finally {
      await new Promise<void>((resolve) => holder.on("exit", () => resolve()));
    }
    assert.equal(holderStderr, "");
    // Once the holder releases, the same ledger appends fine.
    ledger.append(transition());
    assert.equal(ledger.entries().length, 1);
    assert.equal(ledger.verifyChain(), true);
  } finally {
    cleanup(dir);
  }
});

test("C: two processes appending concurrently produce one clean chain (no duplicate sequences)", async () => {
  const dir = tmpDir();
  try {
    const filePath = path.join(dir, "ledger.jsonl");
    const [a, b] = await Promise.all([runWorker(["append", filePath, "10", "A"]), runWorker(["append", filePath, "10", "B"])]);
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    assert.match(a.stdout, /APPEND-DONE A/);
    assert.match(b.stdout, /APPEND-DONE B/);
    const ledger = new AuditLedger({ filePath });
    assert.equal(ledger.entries().length, 20);
    assert.equal(ledger.verifyChain(), true);
    assert.deepEqual(
      ledger.entries().map((e) => e.sequence),
      Array.from({ length: 20 }, (_, i) => i + 1),
      "sequences must be exactly 1..20 with no duplicates (the round-2 race produced 1..10 twice)"
    );
  } finally {
    cleanup(dir);
  }
});

// ─── Finding D: trust conditional on the durable audit commit ────────────

test("D: a failed audit commit means trusted:false and the head does NOT advance", () => {
  const stubLedger = {
    append() { throw new Error("boom: disk full"); },
    entries: () => [],
    latestHash: () => "GENESIS",
    verifyChain: () => true
  };
  const v = new BctVerifier(stubLedger as never, fixedClock(AT));
  const state = { protocol: "SB689", version: 1 };
  const declared = hashOf(state);
  const result = v.verify({
    identity: "d-001",
    state,
    declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    allowGenesis: true
  });
  assert.equal(result.trusted, false, "a transition that was never durably recorded must not be trusted");
  assert.equal(result.ledgerAppendFailed, true);
  assert.ok(result.failedLayers.includes("audit"));
  assert.equal(v.registeredHead("d-001"), undefined, "the head must not advance past a failed commit");
});

test("D: a successful audit commit still advances the head (the normal path is unchanged)", () => {
  const v = new BctVerifier(new AuditLedger(), fixedClock(AT));
  const state = { protocol: "SB689", version: 1 };
  const declared = hashOf(state);
  const result = v.verify({
    identity: "d-002",
    state,
    declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    allowGenesis: true
  });
  assert.equal(result.trusted, true);
  assert.equal(v.registeredHead("d-002"), declared);
});

// ─── Finding E: explicit rollback modes ───────────────────────────────────

test("E: zero participants reports NO_MUTABLE_PARTICIPANTS, never a verified restore", () => {
  const ledger = new AuditLedger();
  ledger.append(transition());
  const fm = new FailureManager(ledger, new LiquidTruthNodeMesh(), new GhostNode(fixedClock(AT)), fixedClock(AT), {});
  const response = fm.recover({
    traceId: "t",
    intent: INTENT,
    error: { code: "BRAIN_FAILURE", stage: "brain", message: "boom", recoverable: true },
    currentStage: "brain",
    lastStableSnapshot: { traceId: "t", intent: INTENT, stage: "stem", auditHash: ledger.latestHash(), stable: true }
  });
  assert.equal(response.rollbackMode, "NO_MUTABLE_PARTICIPANTS");
  assert.match(response.output, /NO_MUTABLE_PARTICIPANTS/);
  assert.match(response.output, /no mutable participants were registered/);
  assert.doesNotMatch(response.output, /rollback verified: restored state hashes match/);
  const verifyEntry = ledger.entries().find((e) => e.to === "failure.verify");
  assert.equal((verifyEntry?.detail as { rollbackMode: string }).rollbackMode, "NO_MUTABLE_PARTICIPANTS");
  const rollbackEntry = ledger.entries().find((e) => e.to === "failure.rollback");
  assert.equal((rollbackEntry?.detail as { rollbackMode: string }).rollbackMode, "NO_MUTABLE_PARTICIPANTS");
});

test("E: a real restore reports RESTORE_VERIFIED; a failed restore reports RESTORE_FAILED", () => {
  const store = {
    name: "counter",
    state: { count: 1 },
    captureState() { return { ...this.state }; },
    restoreState(captured: unknown) { this.state = { ...(captured as { count: number }) }; return true; },
    stateHash() { return hashOf(this.state); }
  };
  const ledger = new AuditLedger();
  ledger.append(transition());
  const fm = new FailureManager(ledger, new LiquidTruthNodeMesh(), new GhostNode(fixedClock(AT)), fixedClock(AT), { rollbackParticipants: [store] });
  const snapshot = {
    traceId: "t", intent: INTENT, stage: "stem" as const, auditHash: ledger.latestHash(), stable: true,
    participantStates: { counter: { captured: { count: 1 }, hash: hashOf({ count: 1 }) } }
  };
  store.state = { count: 99 };
  const okResponse = fm.recover({
    traceId: "t", intent: INTENT,
    error: { code: "BRAIN_FAILURE", stage: "brain", message: "boom", recoverable: true },
    currentStage: "brain", lastStableSnapshot: snapshot
  });
  assert.equal(okResponse.rollbackMode, "RESTORE_VERIFIED");
  assert.equal(okResponse.verified, true);
  assert.equal(store.state.count, 1);

  const broken: RollbackParticipant = {
    name: "broken",
    captureState: () => ({ x: 1 }),
    restoreState: () => false,
    stateHash: () => hashOf({ x: 1 })
  };
  const ledger2 = new AuditLedger();
  ledger2.append(transition());
  const fm2 = new FailureManager(ledger2, new LiquidTruthNodeMesh(), new GhostNode(fixedClock(AT)), fixedClock(AT), { rollbackParticipants: [broken] });
  const badResponse = fm2.recover({
    traceId: "t", intent: INTENT,
    error: { code: "BRAIN_FAILURE", stage: "brain", message: "boom", recoverable: true },
    currentStage: "brain",
    lastStableSnapshot: {
      traceId: "t", intent: INTENT, stage: "stem", auditHash: ledger2.latestHash(), stable: true,
      participantStates: { broken: { captured: { x: 1 }, hash: hashOf({ x: 1 }) } }
    }
  });
  assert.equal(badResponse.rollbackMode, "RESTORE_FAILED");
  assert.equal(badResponse.verified, false);
});

// ─── Finding F: the braid binding is an unkeyed hash, not a signature ───

test("F: computeBraidBindingHash is exactly the unkeyed hash anyone can compute — no key, no authentication", () => {
  const stateHash = "sha256:" + "ab".repeat(32);
  const binding = computeBraidBindingHash(stateHash, SPINE_SIG);
  assert.equal(binding, hashOf({ stateHash, spineSignature: SPINE_SIG }));
  // The verifier accepts it as a BINDING (values match), and the layer
  // detail names it braidBindingHash — never a signature.
  const v = new BctVerifier(new AuditLedger(), fixedClock(AT));
  const state = { protocol: "SB689", version: 1 };
  const declared = hashOf(state);
  const result = v.verify({
    identity: "f-001", state, declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG, priorAuditHash: "GENESIS", allowGenesis: true
  });
  assert.equal(result.trusted, true);
  const braid = result.layers.find((l) => l.layer === "braid");
  assert.ok(braid?.passed);
  assert.ok("braidBindingHash" in (braid?.detail ?? {}), "detail must name the binding, not a signature");
  assert.ok(!("braidSignature" in (braid?.detail ?? {})));
  assert.match(braid?.message ?? "", /unkeyed binding/);
});

// ─── Finding G: shared canonical numbers ──────────────────────────────────

test("G: canonical numbers match the shared cross-language vectors exactly", () => {
  const vectors: Array<[number, string]> = [
    [0.000001, "1e-6"],
    [0.0000001, "1e-7"],
    [1.5, "1.5e+0"],
    [123456.789, "1.23456789e+5"],
    [0.1, "1e-1"],
    [-0.0, "0"],
    [1.0, "1"],
    [1e21, "1000000000000000000000"],
    [1.7976931348623157e308, "1.7976931348623157e+308"],
    [0, "0"],
    [100, "100"],
    [-5, "-5"],
    [0.25, "2.5e-1"],
    [5e-324, "5e-324"]
  ];
  for (const [input, expected] of vectors) {
    assert.equal(canonicalNumber(input), expected, `canonicalNumber(${input})`);
  }
});

test("G: canonical strings leave Unicode unescaped and escape only JSON-required characters", () => {
  assert.equal(stableStringify({ s: "café" }), '{"s":"café"}');
  assert.equal(stableStringify({ s: "braid→knot" }), '{"s":"braid→knot"}');
  assert.equal(stableStringify("a\nb\tc\"d\\e"), '"a\\nb\\tc\\"d\\\\e"');
  assert.equal(stableStringify({ x: 1.5, s: "café" }), '{"s":"café","x":1.5e+0}');
});

test("G: non-finite numbers are rejected with a structured error, never silently hashed as null", () => {
  assert.throws(() => canonicalNumber(Number.NaN), /CANONICAL_NUMBER_REJECTED/);
  assert.throws(() => canonicalNumber(Infinity), /CANONICAL_NUMBER_REJECTED/);
  assert.throws(() => canonicalNumber(-Infinity), /CANONICAL_NUMBER_REJECTED/);
  assert.throws(() => stableStringify({ x: Number.NaN }), /CANONICAL_NUMBER_REJECTED/);
  assert.throws(() => hashOf([1, Number.NaN]), /CANONICAL_NUMBER_REJECTED/);
});

// ─── Registry validation ──────────────────────────────────────────────────

test("registry: register() rejects unvalidated hashes with a structured rejection", () => {
  const registry = new BctHeadRegistry();
  const valid = hashOf({ state: "ok" });
  assert.throws(() => registry.register("id", "garbage-not-a-hash"), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("id", "sha256:xyz"), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("id", `sha256:${"ab".repeat(31)}`), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("id", `sha256:${"AB".repeat(32)}`), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("id", ""), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("", valid), /REGISTRY_REJECTED/);
  assert.throws(() => registry.register("   ", valid), /REGISTRY_REJECTED/);
  registry.register("id", valid);
  assert.equal(registry.head("id"), valid);
  assert.throws(() => registry.advance("id", valid, "not-a-hash"), /REGISTRY_REJECTED/);
  assert.equal(registry.advance("id", valid, hashOf({ state: "next" })), true);
});

// ─── layerSchema(): Object.hasOwn, not `in` ──────────────────────────────

test("schema: an inherited required key does NOT satisfy the schema", () => {
  const v = new BctVerifier(new AuditLedger(), fixedClock(AT));
  const inherited = Object.create({ requiredKey: "inherited, not own" });
  const declared = hashOf(inherited);
  const result = v.verify({
    identity: "s-001",
    state: inherited,
    declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    requiredKeys: ["requiredKey"],
    allowGenesis: true
  });
  assert.equal(result.trusted, false);
  assert.ok(result.failedLayers.includes("schema"));
  const schema = result.layers.find((l) => l.layer === "schema");
  assert.match(schema?.message ?? "", /Missing required keys: requiredKey/);
});

// ─── Key provisioning fails visibly ───────────────────────────────────────

test("keys: a deployment that requires a durable key fails closed at startup when none is configured", () => {
  assert.throws(
    () => new SpineGovernor(undefined, { requireDurableKey: true, clock: fixedClock(AT) }),
    /SPINE_KEY_MISSING/
  );
  const pair = generateSpineKeyPair();
  const durable = new SpineGovernor(undefined, { signingKey: pair.privateKey, requireDurableKey: true, clock: fixedClock(AT) });
  assert.equal(durable.keyProvenance, "durable");
  assert.equal(mustGovern(durable, INTENT).approved, true);
  // The default stays ephemeral for local/dev — but it now SAYS so.
  const ephemeral = new SpineGovernor(undefined, { clock: fixedClock(AT) });
  assert.equal(ephemeral.keyProvenance, "ephemeral");
  assert.equal(mustGovern(ephemeral, INTENT).approved, true);
});

// ─── Durable permit replay ────────────────────────────────────────────────

test("replay: a used permit is rejected after a restart (durable replay store)", () => {
  const dir = tmpDir();
  try {
    const storePath = path.join(dir, "used-permits.jsonl");
    const governor = new SpineGovernor(undefined, { clock: fixedClock(AT) });
    const permit = mustGovern(governor, INTENT);
    const mesh1 = new LiquidTruthNodeMesh(undefined, {
      publicKey: governor.spinePublicKey, clock: fixedClock(AT), replayStorePath: storePath
    });
    assert.equal(mesh1.validatePreBrain(INTENT, permit).ok, true);
    assert.equal(fs.readFileSync(storePath, "utf-8").trim().split("\n").length, 1, "the used signature is on disk");

    // Simulate a restart: brand-new mesh, same trusted key, same store.
    const mesh2 = new LiquidTruthNodeMesh(undefined, {
      publicKey: governor.spinePublicKey, clock: fixedClock(AT), replayStorePath: storePath
    });
    const replay = mesh2.validatePreBrain(INTENT, permit);
    assert.equal(replay.ok, false, "a previously accepted permit must not verify again after restart");
    // The rejection surfaces as the replay finding in the truth report.
    const report = replay.error.cause as { findings: Array<{ nodeId: string; passed: boolean; message: string }> };
    const replayFinding = report.findings.find((f) => f.nodeId === "truth.spine.replay");
    assert.equal(replayFinding?.passed, false);
    assert.match(replayFinding?.message ?? "", /already been used — replay rejected/);
  } finally {
    cleanup(dir);
  }
});

test("replay: a failed validation does not burn the permit's one use", () => {
  const dir = tmpDir();
  try {
    const storePath = path.join(dir, "used-permits.jsonl");
    const governor = new SpineGovernor(undefined, { clock: fixedClock(AT) });
    const permit = mustGovern(governor, INTENT);
    const mesh = new LiquidTruthNodeMesh(undefined, {
      publicKey: governor.spinePublicKey, clock: fixedClock(AT), replayStorePath: storePath
    });
    // Wrong intent: the permit fails, so it must not be marked used.
    const wrong = mesh.validatePreBrain({ id: "someone-else", text: "answer this" }, permit);
    assert.equal(wrong.ok, false);
    assert.equal(fs.existsSync(storePath), false, "a failed attempt records nothing");
    assert.equal(mesh.validatePreBrain(INTENT, permit).ok, true);
  } finally {
    cleanup(dir);
  }
});

// ─── Anchored verification cannot be silently skipped (TS check) ─────────

test("anchored: an unregistered prior, or a missing identity, is rejected — never silently skipped", () => {
  const v = new BctVerifier(new AuditLedger(), fixedClock(AT));
  const state = { a: 1 };
  const declared = hashOf(state);
  const forgedPrior = hashOf({ prev: 1 });
  // Registry present (empty) + prior supplied, no head seeded: rejected.
  const unanchored = v.verify({
    identity: "a-001", state, declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG, priorAuditHash: "GENESIS",
    priorStateHash: forgedPrior, transitionHash: computeTransitionHash(declared, forgedPrior)
  });
  assert.equal(unanchored.trusted, false);
  assert.ok(unanchored.failedLayers.includes("transaction"));
  // Identity missing: rejected at layer 1.
  const noIdentity = v.verify({
    identity: "", state, declaredHash: declared,
    braidBindingHash: computeBraidBindingHash(declared, SPINE_SIG),
    spineSignature: SPINE_SIG, priorAuditHash: "GENESIS", allowGenesis: true
  });
  assert.equal(noIdentity.trusted, false);
  assert.ok(noIdentity.failedLayers.includes("identity"));
});

// ─── Finding H: evidence-ledger cross-check ───────────────────────────────

test("H: verifyHeadAgainstLedger distinguishes match, no-record, mismatch, and stale heads", () => {
  const evidence = new InMemoryEvidenceLedger();
  const headA = hashOf({ state: "a" });
  const headB = hashOf({ state: "b" });
  evidence.record("h-001", headA, AT);
  const match = verifyHeadAgainstLedger("h-001", headA, evidence);
  assert.equal(match.outcome, "MATCH");
  assert.equal(match.verified, true);
  const noRecord = verifyHeadAgainstLedger("h-002", headA, evidence);
  assert.equal(noRecord.outcome, "NO_LEDGER_RECORD");
  assert.equal(noRecord.verified, false);
  const mismatch = verifyHeadAgainstLedger("h-001", headB, evidence);
  assert.equal(mismatch.outcome, "MISMATCH");
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.localHeadInLedgerHistory, false);
  evidence.record("h-001", headB, AT);
  const stale = verifyHeadAgainstLedger("h-001", headA, evidence);
  assert.equal(stale.outcome, "STALE_LOCAL_HEAD");
  assert.equal(stale.verified, false);
  assert.equal(stale.localHeadInLedgerHistory, true);
  assert.equal(stale.ledgerHead, headB);
});

test("H: the verifier cross-checks the local head against the evidence ledger when a reader is set", () => {
  const evidence = new InMemoryEvidenceLedger();
  const headA = hashOf({ prev: "state" });
  const stateB = { protocol: "SB689", version: 2 };
  const hashB = hashOf(stateB);
  const inputFor = (overrides: Record<string, unknown> = {}) => ({
    identity: "h-001",
    state: stateB,
    declaredHash: hashB,
    braidBindingHash: computeBraidBindingHash(hashB, SPINE_SIG),
    spineSignature: SPINE_SIG,
    priorAuditHash: "GENESIS",
    priorStateHash: headA,
    transitionHash: computeTransitionHash(hashB, headA),
    ...overrides
  });

  // Ledger agrees with the local head: trusted.
  evidence.record("h-001", headA, AT);
  const v = new BctVerifier(new AuditLedger(), fixedClock(AT), new BctHeadRegistry(), evidence);
  v.registerHead("h-001", headA);
  assert.equal(v.verify(inputFor()).trusted, true);
  // The documented write path: record the new head after a trusted verification.
  evidence.record("h-001", hashB, AT);

  // Same local head, but the durable ledger has moved on: stale — rejected at the audit layer.
  const v2 = new BctVerifier(new AuditLedger(), fixedClock(AT), new BctHeadRegistry(), evidence);
  v2.registerHead("h-001", headA);
  const stale = v2.verify(inputFor());
  assert.equal(stale.trusted, false);
  assert.ok(stale.failedLayers.includes("audit"));
  assert.match(stale.layers.find((l) => l.layer === "audit")?.message ?? "", /evidence-ledger/i);

  // Genesis while the ledger already has a head for this identity: rejected.
  const v3 = new BctVerifier(new AuditLedger(), fixedClock(AT), new BctHeadRegistry(), evidence);
  const fork = v3.verify({
    identity: "h-001", state: stateB, declaredHash: hashB,
    braidBindingHash: computeBraidBindingHash(hashB, SPINE_SIG),
    spineSignature: SPINE_SIG, priorAuditHash: "GENESIS", allowGenesis: true
  });
  assert.equal(fork.trusted, false);
  assert.ok(fork.failedLayers.includes("audit"));

  // Genesis with NO ledger record for the identity: consistent, trusted.
  const v4 = new BctVerifier(new AuditLedger(), fixedClock(AT), new BctHeadRegistry(), evidence);
  const fresh = v4.verify({
    identity: "fresh-001", state: stateB, declaredHash: hashB,
    braidBindingHash: computeBraidBindingHash(hashB, SPINE_SIG),
    spineSignature: SPINE_SIG, priorAuditHash: "GENESIS", allowGenesis: true
  });
  assert.equal(fresh.trusted, true);
});
