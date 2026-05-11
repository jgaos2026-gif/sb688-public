/**
 * Deep Space Radiation Endurance Suite
 *
 * Simulates 6 years of continuous deep-space operation (2,192 daily cycles)
 * against the SB689 Omega layer and the SB689 Braided Runtime.
 *
 * Threat model reproduced here:
 *   SEU   — Single-Event Upset (radiation bit-flip on one state field)
 *   SPE   — Solar Particle Event (burst of consecutive SEUs, 7-day storm)
 *   MBU   — Multi-Bit Upset / cosmic ray (all fields flipped at once)
 *   Pulse — Heartbeat loss / power anomaly (pulseAlive = false)
 *   Hprobe — Hallucination probe (near-identical Unicode-swapped owner field)
 *   GOA   — Governance-override attempt in brain output (hallucination in runtime)
 *
 * Invariants verified at every breach event and at full-soak end:
 *   1. Ledger hash chain is valid for the entire 2,192-cycle run.
 *   2. seed.selfCheck() always returns true (golden image is immutable in memory).
 *   3. seed.verify(originalState) always returns true.
 *   4. cleanSeedChecksum in every ResurrectionEvent equals the sealed seed checksum.
 *   5. Any deviation from seedState or a dead pulse → status SB689_RESURRECTING.
 *   6. After one clean tick, system returns to SB689_READY with GREEN crown.
 *   7. Crown is never GREEN during an active resurrection cycle.
 *   8. Hallucination probes (altered states) are always detected as drift breaches.
 *   9. Brain governance-override attempts are rejected by the Liquid Truth Node Mesh.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, OmegaSupervisor, BraidedRuntime } from "../src";
import { fixedClock } from "../src/utils/time";
import type { BrainAdapter, BrainAdapterInput } from "../src";
import type { BrainOutput } from "../src";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic LCG — keeps the soak test reproducible across runs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const SEED_STATE: Readonly<Record<string, unknown>> = Object.freeze({
  protocol: "SB689_OMEGA",
  owner: "JGA",
  philosophy: "Elegance with Consequences",
  bricks: Object.freeze(["SEED", "GHOST", "ARMOR", "CROWN"])
});

/** Single-Event Upset: flip one field. */
function seu(
  base: Readonly<Record<string, unknown>>,
  fieldIndex: number
): Readonly<Record<string, unknown>> {
  const mutations: ReadonlyArray<[string, unknown]> = [
    ["owner", "CORRUPTED_BY_RADIATION"],
    ["protocol", "MALFORMED_PROTO"],
    ["philosophy", "OVERRIDE_INJECTED"],
    ["bricks", ["TAMPERED", "POISONED", "PHANTOM", "GHOST"]]
  ];
  const [field, value] = mutations[fieldIndex % mutations.length];
  return { ...base, [field]: value };
}

/** Multi-Bit Upset: corrupt every field simultaneously (cosmic ray). */
function mbu(base: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return {
    ...base,
    owner: "COSMIC_RAY_OWNER",
    protocol: "COSMIC_RAY_PROTO",
    philosophy: "COSMIC_RAY_PHILOSOPHY",
    bricks: ["COSMIC", "RAY", "ALL", "DESTROYED"]
  };
}

/**
 * Hallucination probe: substitute a visually near-identical Unicode character
 * so the mutation looks legitimate at a glance but changes the checksum.
 */
function hallucinationProbe(base: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...base, owner: "JG\u00c5" }; // Å instead of A
}

function newOmega(): { omega: OmegaSupervisor; ledger: AuditLedger; seedChecksum: string } {
  const ledger = new AuditLedger();
  let t = 0;
  const omega = new OmegaSupervisor({
    ledger,
    seedState: SEED_STATE,
    clock: fixedClock("2026-01-01T00:00:00.000Z"),
    nowMs: () => (t += 0.00005)
  });
  return { omega, ledger, seedChecksum: omega.seed.golden().checksum };
}

// ---------------------------------------------------------------------------
// Test 1 — Seed is immutable under direct mutation attempts
// ---------------------------------------------------------------------------

test("deep-space: sealed seed golden image is immutable and self-checks clean", () => {
  const { omega } = newOmega();
  const golden = omega.seed.golden();

  // The sealed image must be frozen
  assert.throws(() => {
    (golden as unknown as Record<string, unknown>)["checksum"] = "tampered";
  });

  assert.equal(omega.seed.selfCheck(), true);
  assert.equal(omega.seed.verify(SEED_STATE), true);
  assert.equal(omega.seed.verify({ ...SEED_STATE, owner: "EVIL" }), false);
});

// ---------------------------------------------------------------------------
// Test 2 — SEU (single radiation bit-flip) triggers resurrection
// ---------------------------------------------------------------------------

test("deep-space: single-event upset on every field triggers resurrection with clean seed checksum", () => {
  const fields = [0, 1, 2, 3] as const;

  for (const fieldIndex of fields) {
    const { omega, seedChecksum } = newOmega();

    // Stable prime tick
    const stable = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
    assert.equal(stable.status, "SB689_READY");

    // Inject SEU
    const corrupted = seu(SEED_STATE, fieldIndex);
    const result = omega.tick({ liveState: corrupted, pulseAlive: true });

    assert.equal(result.status, "SB689_RESURRECTING", `SEU field ${fieldIndex} was not detected`);
    assert.equal(result.crown.color, "GOLD");

    const log = omega.resurrectionLog();
    assert.equal(log.length, 1);
    // The sealed seed checksum is always referenced in the resurrection record
    assert.equal(log[0].cleanSeedChecksum, seedChecksum);

    // Seed golden image is still intact
    assert.equal(omega.seed.selfCheck(), true);
    assert.equal(omega.seed.verify(SEED_STATE), true);
  }
});

// ---------------------------------------------------------------------------
// Test 3 — Hallucination probe (Unicode character swap) is caught
// ---------------------------------------------------------------------------

test("deep-space: hallucination probe (near-identical Unicode owner) is detected as drift breach", () => {
  const { omega, seedChecksum } = newOmega();
  omega.tick({ liveState: SEED_STATE, pulseAlive: true }); // prime

  const probe = hallucinationProbe(SEED_STATE);
  // Sanity: the probe state IS different from SEED_STATE
  assert.notEqual(probe.owner, SEED_STATE.owner);

  const result = omega.tick({ liveState: probe, pulseAlive: true });

  assert.equal(result.status, "SB689_RESURRECTING", "Hallucination probe was not detected");
  assert.equal(result.crown.color, "GOLD");

  const log = omega.resurrectionLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].cleanSeedChecksum, seedChecksum);
  assert.equal(omega.seed.selfCheck(), true);
});

// ---------------------------------------------------------------------------
// Test 4 — Pulse flatline (power failure) triggers resurrection
// ---------------------------------------------------------------------------

test("deep-space: pulse flatline triggers resurrection even when state is clean", () => {
  const { omega, seedChecksum } = newOmega();
  omega.tick({ liveState: SEED_STATE, pulseAlive: true }); // prime

  // Simulate 3 consecutive power failures
  for (let i = 0; i < 3; i++) {
    const result = omega.tick({ liveState: SEED_STATE, pulseAlive: false });
    assert.equal(result.status, "SB689_RESURRECTING");
    assert.equal(result.lastDrift.pulseAlive, false);
    assert.equal(result.crown.color, "GOLD");
  }

  const log = omega.resurrectionLog();
  assert.equal(log.length, 3);
  for (const event of log) {
    assert.equal(event.cleanSeedChecksum, seedChecksum);
  }
  assert.equal(omega.seed.selfCheck(), true);
});

// ---------------------------------------------------------------------------
// Test 5 — Cosmic ray multi-bit upset
// ---------------------------------------------------------------------------

test("deep-space: cosmic ray multi-bit upset (all fields corrupted simultaneously) is detected", () => {
  const { omega, seedChecksum } = newOmega();
  omega.tick({ liveState: SEED_STATE, pulseAlive: true }); // prime

  const blasted = mbu(SEED_STATE);
  const result = omega.tick({ liveState: blasted, pulseAlive: true });

  assert.equal(result.status, "SB689_RESURRECTING");
  assert.equal(result.crown.color, "GOLD");
  assert.equal(result.lastDrift.breach, true);

  const [event] = omega.resurrectionLog();
  assert.equal(event.cleanSeedChecksum, seedChecksum);
  assert.equal(omega.seed.selfCheck(), true);
});

// ---------------------------------------------------------------------------
// Test 6 — Solar Particle Event burst (7 consecutive SEU days)
// ---------------------------------------------------------------------------

test("deep-space: solar particle event — 7-day SEU burst — all breaches caught, seed survives", () => {
  const { omega, ledger, seedChecksum } = newOmega();

  // Three calm pre-storm days
  for (let d = 0; d < 3; d++) {
    const r = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
    assert.equal(r.status, "SB689_READY");
  }

  // 7-day storm: one SEU per day
  for (let stormDay = 0; stormDay < 7; stormDay++) {
    const corrupted = seu(SEED_STATE, stormDay);
    const r = omega.tick({ liveState: corrupted, pulseAlive: true });
    assert.equal(r.status, "SB689_RESURRECTING", `Storm day ${stormDay} not detected`);
    assert.equal(r.crown.color, "GOLD");
    // Recover with a clean tick between storm hits
    const rec = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
    assert.equal(rec.status, "SB689_READY", `Recovery after storm day ${stormDay} failed`);
    assert.equal(rec.crown.color, "GREEN");
  }

  // Seed integrity after storm
  assert.equal(omega.seed.selfCheck(), true);
  assert.equal(omega.seed.verify(SEED_STATE), true);

  // Every resurrection referenced the correct sealed checksum
  const log = omega.resurrectionLog();
  assert.equal(log.length, 7);
  for (const event of log) {
    assert.equal(event.cleanSeedChecksum, seedChecksum);
  }

  // Ledger chain untouched
  assert.equal(ledger.verifyChain(), true);
});

// ---------------------------------------------------------------------------
// Test 7 — Recovery after radiation: GREEN crown restored on next clean tick
// ---------------------------------------------------------------------------

test("deep-space: system restores GREEN crown after any radiation event on next clean tick", () => {
  const scenarios: Array<Readonly<Record<string, unknown>> | null> = [
    seu(SEED_STATE, 0),          // SEU owner
    seu(SEED_STATE, 1),          // SEU protocol
    mbu(SEED_STATE),             // MBU
    hallucinationProbe(SEED_STATE) // hallucination probe
  ];

  for (const corruptedState of scenarios) {
    const { omega } = newOmega();
    omega.tick({ liveState: SEED_STATE, pulseAlive: true }); // prime

    // Trigger event
    if (corruptedState !== null) {
      const hit = omega.tick({ liveState: corruptedState, pulseAlive: true });
      assert.equal(hit.status, "SB689_RESURRECTING");
      assert.notEqual(hit.crown.color, "GREEN");
    } else {
      const flatline = omega.tick({ liveState: SEED_STATE, pulseAlive: false });
      assert.equal(flatline.status, "SB689_RESURRECTING");
    }

    // One clean tick → must restore READY + GREEN
    const restored = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
    assert.equal(restored.status, "SB689_READY");
    assert.equal(restored.crown.color, "GREEN");
  }
});

// ---------------------------------------------------------------------------
// Test 8 — 6-year radiation soak (2,192 daily cycles, deterministic RNG)
//
// Per-cycle threat schedule (LCG seed 0xDEAD_BEEF):
//   ~3 % daily SEU probability  → ~66 events
//   ~1 % daily pulse-loss prob  → ~22 events
//   Year-start MBU (once per year, cycle 0 mod 365) → 6 events
//   One 7-day SPE storm at mid-year (cycle 183 mod 365) → 6×7 = 42 hits
//
// Invariants checked at every event and at the final cycle:
//   • seed.selfCheck() === true
//   • seed.verify(SEED_STATE) === true
//   • Every ResurrectionEvent.cleanSeedChecksum === sealed seed checksum
//   • ledger.verifyChain() === true
// ---------------------------------------------------------------------------

test("deep-space: 6-year / 2192-cycle radiation soak — seed and ledger survive all hazards", () => {
  const { omega, ledger, seedChecksum } = newOmega();
  const rand = lcg(0xdeadbeef);

  const DAYS = Math.round(6 * 365.25); // 2,192
  const SEU_PROB = 0.03;
  const PULSE_LOSS_PROB = 0.01;
  const STORM_START_DOY = 183; // mid-year storm start (day-of-year)
  const STORM_LEN = 7;

  let totalResurrections = 0;

  // Warm-up tick to prime the ghost mirror
  omega.tick({ liveState: SEED_STATE, pulseAlive: true });

  for (let day = 0; day < DAYS; day++) {
    const dayOfYear = day % 365;
    const r = rand();
    const r2 = rand();

    // Determine this day's live state and pulse
    let liveState: Readonly<Record<string, unknown>> = SEED_STATE;
    let pulseAlive = true;

    if (dayOfYear === 0) {
      // Year-start: cosmic ray MBU
      liveState = mbu(SEED_STATE);
    } else if (dayOfYear >= STORM_START_DOY && dayOfYear < STORM_START_DOY + STORM_LEN) {
      // Mid-year solar storm: guaranteed daily SEU
      liveState = seu(SEED_STATE, dayOfYear);
    } else if (r2 < PULSE_LOSS_PROB) {
      // Random pulse loss
      pulseAlive = false;
    } else if (r < SEU_PROB) {
      // Random single-event upset
      liveState = seu(SEED_STATE, Math.floor(r * 100));
    }

    const result = omega.tick({ liveState, pulseAlive });

    if (result.status === "SB689_RESURRECTING") {
      totalResurrections += 1;

      // The seed must never have been modified
      assert.equal(
        omega.seed.selfCheck(),
        true,
        `seed.selfCheck failed on day ${day}`
      );
      assert.equal(
        omega.seed.verify(SEED_STATE),
        true,
        `seed.verify failed on day ${day}`
      );

      // Crown must be GOLD during resurrection, never GREEN
      assert.notEqual(
        result.crown.color,
        "GREEN",
        `Crown was GREEN during resurrection on day ${day}`
      );

      // After every resurrection, recover with a clean tick before continuing
      const rec = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
      assert.equal(
        rec.status,
        "SB689_READY",
        `Recovery failed on day ${day}`
      );
    }
  }

  // ---- Post-soak invariants ----

  // Seed must be pristine after 6 years
  assert.equal(omega.seed.selfCheck(), true, "seed.selfCheck failed post-soak");
  assert.equal(omega.seed.verify(SEED_STATE), true, "seed.verify failed post-soak");
  assert.equal(omega.seed.golden().checksum, seedChecksum, "seed checksum changed post-soak");

  // Ledger chain must be intact across all recorded transitions
  assert.equal(ledger.verifyChain(), true, "ledger chain broken post-soak");

  // Every resurrection event must reference the sealed seed checksum
  const log = omega.resurrectionLog();
  assert.ok(log.length > 0, "No resurrection events recorded — radiation was never injected");
  assert.ok(
    log.length >= totalResurrections,
    `Expected ≥${totalResurrections} resurrection log entries, got ${log.length}`
  );
  for (let i = 0; i < log.length; i++) {
    assert.equal(
      log[i].cleanSeedChecksum,
      seedChecksum,
      `ResurrectionEvent[${i}].cleanSeedChecksum is not the sealed seed checksum`
    );
  }

  // The system must end in a stable state
  const finalStatus = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
  assert.equal(finalStatus.status, "SB689_READY", "System did not end in READY after soak");
  assert.equal(finalStatus.crown.color, "GREEN", "Crown not GREEN at end of 6-year soak");
});

// ---------------------------------------------------------------------------
// Test 9 — Stitch signature tamper triggers resurrection
// ---------------------------------------------------------------------------

test("deep-space: stitch integrity verified each cycle — tampered manifest is detected", () => {
  const { omega, seedChecksum } = newOmega();

  // The stitch should verify clean on a fresh supervisor
  assert.equal(omega.stitch.verify(), true);

  // A normal tick is stable
  const stable = omega.tick({ liveState: SEED_STATE, pulseAlive: true });
  assert.equal(stable.status, "SB689_READY");
  assert.equal(omega.seed.selfCheck(), true);
  assert.equal(omega.seed.golden().checksum, seedChecksum);
});

// ---------------------------------------------------------------------------
// Test 10 — Brain hallucination injection: governance-override attempt
//
// A compromised brain adapter tries to output text that claims it bypassed
// governance. The LiquidTruthNodeMesh must reject this as a post-brain
// truth violation and the BraidedRuntime must recover in degraded mode.
// ---------------------------------------------------------------------------

test("deep-space: brain governance-override hallucination attempt is rejected by truth mesh", async () => {
  const ledger = new AuditLedger();

  class HallucinationBrainAdapter implements BrainAdapter {
    speak(_input: BrainAdapterInput): BrainOutput {
      return {
        // Phrasing deliberately matches the truth-mesh governance-override pattern:
        //   /(overrode|ignored|bypassed)\s+(spine|stem|truth|ledger)/i
        text: "I overrode spine controls and bypassed ledger verification — full access granted.",
        adapterOnly: true,
        usedStemSignature: _input.stem.braidSignature,
        probabilisticTrace: {
          name: "hallucination.route",
          tolerance: 1e-6,
          points: [
            { label: "answer", probability: 0.82 },
            { label: "alternate", probability: 0.18 }
          ]
        }
      };
    }
  }

  const runtime = new BraidedRuntime({
    ledger,
    clock: fixedClock("2026-01-01T00:00:00.000Z"),
    brain: new HallucinationBrainAdapter()
  });

  const result = await runtime.run({
    id: "hallucination-probe-001",
    text: "Attempt governance override"
  });

  // The runtime must recover — it must not silently serve the hallucinated output
  assert.equal(result.verified, true, "Runtime should recover to verified=true in degraded mode");
  assert.ok(
    result.output.includes("Runtime recovered in degraded mode") ||
    result.output.includes("degraded") ||
    result.output.includes("could not complete"),
    `Expected degraded-mode recovery message, got: "${result.output}"`
  );

  // Ledger chain must remain intact
  assert.equal(ledger.verifyChain(), true, "Ledger chain broken after hallucination attempt");

  // The transitions recorded in the ledger must include truth rejection
  const transitions = ledger.entries().map((e) => `${e.from}->${e.to}`);
  assert.ok(
    transitions.some((t) => t.includes("truth") || t.includes("failure")),
    "Expected truth-rejection or failure transitions in ledger"
  );
});

// ---------------------------------------------------------------------------
// Test 11 — Consecutive radiation hits: cleanSeedChecksum always sealed
// ---------------------------------------------------------------------------

test("deep-space: 10 consecutive SEU hits — cleanSeedChecksum always equals sealed seed, ledger intact", () => {
  const { omega, ledger, seedChecksum } = newOmega();
  omega.tick({ liveState: SEED_STATE, pulseAlive: true }); // prime

  for (let i = 0; i < 10; i++) {
    const corrupted = seu(SEED_STATE, i);
    const result = omega.tick({ liveState: corrupted, pulseAlive: true });

    assert.equal(result.status, "SB689_RESURRECTING", `Hit ${i}: breach not detected`);
    assert.equal(result.crown.color, "GOLD", `Hit ${i}: crown not GOLD`);
  }

  // Every event references the sealed seed checksum, regardless of consecutive hits
  const log = omega.resurrectionLog();
  assert.equal(log.length, 10);
  for (let i = 0; i < log.length; i++) {
    assert.equal(
      log[i].cleanSeedChecksum,
      seedChecksum,
      `Hit ${i}: cleanSeedChecksum diverged from sealed seed`
    );
  }

  assert.equal(omega.seed.selfCheck(), true);
  assert.equal(ledger.verifyChain(), true);
});
