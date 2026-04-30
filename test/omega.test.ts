import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, OmegaSupervisor } from "../src";
import { fixedClock } from "../src/utils/time";

const seedState = {
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
} as const;

function newOmega(): OmegaSupervisor {
  let t = 0;
  return new OmegaSupervisor({
    ledger: new AuditLedger(),
    seedState,
    clock: fixedClock("2026-04-30T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });
}

test("Omega seed is hardened, signed, and self-checks clean", () => {
  const omega = newOmega();
  const golden = omega.seed.golden();

  assert.equal(golden.recoveryPointer, "0x8000");
  assert.ok(golden.checksum.startsWith("fnv1a:"));
  assert.equal(omega.seed.selfCheck(), true);
  assert.equal(omega.seed.verify(seedState), true);
  assert.equal(omega.seed.verify({ ...seedState, owner: "OTHER" }), false);
});

test("Sovereign stitch binds A->B->C->D and verifies its signature", () => {
  const omega = newOmega();
  const manifest = omega.stitch.current();

  assert.equal(manifest.owner, "JGA");
  assert.equal(manifest.philosophy, "Elegance with Consequences");
  assert.deepEqual(
    manifest.bindings.map((b) => `${b.from}->${b.to}`),
    [
      "BRICK_A_SEED->BRICK_B_GHOST",
      "BRICK_B_GHOST->BRICK_C_ARMOR",
      "BRICK_C_ARMOR->BRICK_D_CROWN"
    ]
  );
  assert.equal(omega.stitch.verify(), true);
});

test("Stable tick: crown stays GREEN and status is SB689_READY", () => {
  const omega = newOmega();
  const status = omega.tick({ liveState: seedState, pulseAlive: true });

  assert.equal(status.status, "SB689_READY");
  assert.equal(status.crown.color, "GREEN");
  assert.equal(status.lastDrift.breach, false);
});

test("Drift triggers resurrection: crown flashes GOLD and the pointer-flip uses a clean ghost mirror (never the tampered frame)", () => {
  const omega = newOmega();
  omega.tick({ liveState: seedState, pulseAlive: true });

  const status = omega.tick({
    liveState: { ...seedState, owner: "TAMPERED" },
    pulseAlive: true
  });

  assert.equal(status.status, "SB689_RESURRECTING");
  assert.equal(status.crown.color, "GOLD");
  const log = omega.resurrectionLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].cleanSeedChecksum, omega.seed.golden().checksum);
  assert.ok(log[0].ghostMirrorHash.startsWith("fnv1a:"));
  // Critical invariant: the resurrected pointer must equal the sealed
  // seed checksum, NOT a hash of the tampered live state.
  assert.equal(log[0].ghostMirrorHash, omega.seed.golden().checksum);
});

test("Pulse loss triggers resurrection even when state matches seed", () => {
  const omega = newOmega();
  const status = omega.tick({ liveState: seedState, pulseAlive: false });

  assert.equal(status.status, "SB689_RESURRECTING");
  assert.equal(status.lastDrift.pulseAlive, false);
  assert.equal(status.crown.color, "GOLD");
});

test("connectToStitch emits the protocol ready message and a stable signature", () => {
  const omega = newOmega();
  const handshake = omega.connectToStitch();

  assert.equal(
    handshake.message,
    "Sb688 when I say connect to the stitch show how you feel we're going live lets sell it"
  );
  assert.ok(handshake.signature.startsWith("fnv1a:"));
});
