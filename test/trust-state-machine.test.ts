/**
 * Phase 2 — TrustStateMachine tests.
 *
 * Covers: legal transitions, illegal transitions, RECOVERING→CERTIFIED block,
 * full recovery path, terminal states, history, reset, canTransition.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TrustStateMachine,
  IllegalTrustTransitionError,
  legalTransitions,
  type TrustState
} from "../src/trust/TrustStateMachine";

const FIXED_AT = "2026-08-12T00:00:00.000Z";
const fixedClock = () => FIXED_AT;

function make(initial: TrustState = "UNTRUSTED"): TrustStateMachine {
  return new TrustStateMachine(initial, fixedClock);
}

// ─── Legal transitions ────────────────────────────────────────────────────────

test("trust: UNTRUSTED → STAGED is legal", () => {
  const m = make();
  const rec = m.transition("STAGED", "incoming transaction");
  assert.equal(m.state, "STAGED");
  assert.equal(rec.from, "UNTRUSTED");
  assert.equal(rec.to, "STAGED");
  assert.equal(rec.at, FIXED_AT);
});

test("trust: STAGED → VERIFYING is legal", () => {
  const m = make("STAGED");
  m.transition("VERIFYING");
  assert.equal(m.state, "VERIFYING");
});

test("trust: VERIFYING → CERTIFIED is legal", () => {
  const m = make("VERIFYING");
  m.transition("CERTIFIED");
  assert.equal(m.state, "CERTIFIED");
});

test("trust: VERIFYING → QUARANTINED is legal", () => {
  const m = make("VERIFYING");
  m.transition("QUARANTINED");
  assert.equal(m.state, "QUARANTINED");
});

test("trust: VERIFYING → REJECTED is legal", () => {
  const m = make("VERIFYING");
  m.transition("REJECTED");
  assert.equal(m.state, "REJECTED");
});

test("trust: QUARANTINED → RECOVERING is legal", () => {
  const m = make("QUARANTINED");
  m.transition("RECOVERING");
  assert.equal(m.state, "RECOVERING");
});

test("trust: RECOVERING → REVERIFYING is legal", () => {
  const m = make("RECOVERING");
  m.transition("REVERIFYING");
  assert.equal(m.state, "REVERIFYING");
});

test("trust: REVERIFYING → CERTIFIED is legal", () => {
  const m = make("REVERIFYING");
  m.transition("CERTIFIED");
  assert.equal(m.state, "CERTIFIED");
});

test("trust: REVERIFYING → REJECTED is legal", () => {
  const m = make("REVERIFYING");
  m.transition("REJECTED");
  assert.equal(m.state, "REJECTED");
});

// ─── Illegal transitions ──────────────────────────────────────────────────────

test("trust: RECOVERING → CERTIFIED is ILLEGAL — must go through REVERIFYING", () => {
  const m = make("RECOVERING");
  assert.throws(
    () => m.transition("CERTIFIED"),
    (err: unknown) => {
      assert.ok(err instanceof IllegalTrustTransitionError);
      assert.equal(err.from, "RECOVERING");
      assert.equal(err.to, "CERTIFIED");
      return true;
    }
  );
  assert.equal(m.state, "RECOVERING", "state must not change after illegal transition");
});

test("trust: UNTRUSTED → CERTIFIED is illegal", () => {
  const m = make();
  assert.throws(() => m.transition("CERTIFIED"), IllegalTrustTransitionError);
  assert.equal(m.state, "UNTRUSTED");
});

test("trust: UNTRUSTED → VERIFYING is illegal", () => {
  const m = make();
  assert.throws(() => m.transition("VERIFYING"), IllegalTrustTransitionError);
});

test("trust: STAGED → CERTIFIED is illegal", () => {
  const m = make("STAGED");
  assert.throws(() => m.transition("CERTIFIED"), IllegalTrustTransitionError);
  assert.equal(m.state, "STAGED");
});

test("trust: CERTIFIED → STAGED is illegal (terminal state)", () => {
  const m = make("CERTIFIED");
  assert.throws(() => m.transition("STAGED"), IllegalTrustTransitionError);
  assert.equal(m.state, "CERTIFIED");
});

test("trust: CERTIFIED → RECOVERING is illegal (cannot leave terminal)", () => {
  const m = make("CERTIFIED");
  assert.throws(() => m.transition("RECOVERING"), IllegalTrustTransitionError);
});

test("trust: REJECTED → CERTIFIED is illegal (terminal state)", () => {
  const m = make("REJECTED");
  assert.throws(() => m.transition("CERTIFIED"), IllegalTrustTransitionError);
  assert.equal(m.state, "REJECTED");
});

test("trust: RECOVERING → QUARANTINED is illegal", () => {
  const m = make("RECOVERING");
  assert.throws(() => m.transition("QUARANTINED"), IllegalTrustTransitionError);
});

test("trust: QUARANTINED → CERTIFIED is illegal — must recover and reverify", () => {
  const m = make("QUARANTINED");
  assert.throws(() => m.transition("CERTIFIED"), IllegalTrustTransitionError);
});

test("trust: REVERIFYING → QUARANTINED is illegal", () => {
  const m = make("REVERIFYING");
  assert.throws(() => m.transition("QUARANTINED"), IllegalTrustTransitionError);
});

// ─── Full recovery path ───────────────────────────────────────────────────────

test("trust: full happy path UNTRUSTED→STAGED→VERIFYING→CERTIFIED", () => {
  const m = make();
  m.transition("STAGED");
  m.transition("VERIFYING");
  m.transition("CERTIFIED");
  assert.equal(m.state, "CERTIFIED");
  assert.equal(m.history().length, 3);
});

test("trust: full recovery path QUARANTINED→RECOVERING→REVERIFYING→CERTIFIED", () => {
  const m = make("QUARANTINED");
  m.transition("RECOVERING");
  m.transition("REVERIFYING");
  m.transition("CERTIFIED");
  assert.equal(m.state, "CERTIFIED");
});

test("trust: recoverAndReverify succeeds when verifyFn returns true", () => {
  const m = make("QUARANTINED");
  const result = m.recoverAndReverify(() => true);
  assert.equal(result, "CERTIFIED");
  assert.equal(m.state, "CERTIFIED");
});

test("trust: recoverAndReverify ends in REJECTED when verifyFn returns false", () => {
  const m = make("QUARANTINED");
  const result = m.recoverAndReverify(() => false);
  assert.equal(result, "REJECTED");
  assert.equal(m.state, "REJECTED");
});

test("trust: recoverAndReverify throws if not in QUARANTINED state", () => {
  const m = make("RECOVERING");
  assert.throws(() => m.recoverAndReverify(() => true), IllegalTrustTransitionError);
});

// ─── History and introspection ────────────────────────────────────────────────

test("trust: history records all transitions in order", () => {
  const m = make();
  m.transition("STAGED", "r1");
  m.transition("VERIFYING", "r2");
  m.transition("CERTIFIED", "r3");
  const h = m.history();
  assert.equal(h.length, 3);
  assert.equal(h[0].from, "UNTRUSTED");
  assert.equal(h[0].to, "STAGED");
  assert.equal(h[1].from, "STAGED");
  assert.equal(h[1].to, "VERIFYING");
  assert.equal(h[2].from, "VERIFYING");
  assert.equal(h[2].to, "CERTIFIED");
});

test("trust: history is immutable snapshot", () => {
  const m = make();
  m.transition("STAGED");
  const h1 = m.history();
  m.transition("VERIFYING");
  const h2 = m.history();
  assert.equal(h1.length, 1);
  assert.equal(h2.length, 2);
});

test("trust: canTransition returns true for legal moves", () => {
  const m = make("VERIFYING");
  assert.equal(m.canTransition("CERTIFIED"), true);
  assert.equal(m.canTransition("QUARANTINED"), true);
  assert.equal(m.canTransition("REJECTED"), true);
});

test("trust: canTransition returns false for illegal moves", () => {
  const m = make("RECOVERING");
  assert.equal(m.canTransition("CERTIFIED"), false);
  assert.equal(m.canTransition("STAGED"), false);
});

test("trust: allowedTransitions lists exactly the legal targets", () => {
  const m = make("VERIFYING");
  const allowed = [...m.allowedTransitions()].sort();
  assert.deepEqual(allowed, ["CERTIFIED", "QUARANTINED", "REJECTED"]);
});

test("trust: CERTIFIED is terminal — allowedTransitions is empty", () => {
  const m = make("CERTIFIED");
  assert.deepEqual(m.allowedTransitions(), []);
});

test("trust: REJECTED is terminal — allowedTransitions is empty", () => {
  const m = make("REJECTED");
  assert.deepEqual(m.allowedTransitions(), []);
});

test("trust: reset returns state to UNTRUSTED", () => {
  const m = make("VERIFYING");
  m.reset();
  assert.equal(m.state, "UNTRUSTED");
});

test("trust: legalTransitions does not include RECOVERING→CERTIFIED", () => {
  const map = legalTransitions();
  assert.equal(map.get("RECOVERING")?.has("CERTIFIED"), false);
});
