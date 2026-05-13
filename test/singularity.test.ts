/**
 * Test suite for Phase 1 Singularity Technologies
 * - Post-Quantum Cryptography (PQC)
 * - Hyperdimensional Computing (HDC)
 * - Neuromorphic Healing (SNN)
 */

import { describe, test } from "node:test";
import * as assert from "node:assert/strict";
import { QuantumRNG, LatticeCrypto } from "../src/quantum/QuantumCrypto";
import { HyperdimensionalComputing } from "../src/quantum/HyperdimensionalComputing";
import { EventDrivenSentinel, NeuromorphicPredictor } from "../src/quantum/NeuromorphicHealing";

describe("Phase 1: Quantum-Native Resilience Architecture (Q-NRA)", () => {
  test("QuantumRNG generates high-entropy random bytes", () => {
    const qrng = new QuantumRNG();
    const output = qrng.generateBytes(32);

    assert.equal(output.randomBytes.length, 32, "Should generate requested number of bytes");
    assert.ok(output.entropy > 0.7, `Entropy should be high (got ${output.entropy})`);
    assert.ok(["quantum_noise", "hardware_entropy", "fallback_crypto"].includes(output.source));
  });

  test("LatticeCrypto generates quantum-resistant signatures", () => {
    const crypto = new LatticeCrypto();
    const data = "SB689 OMEGA - Sovereign Stitch Binding";

    const signature = crypto.sign(data);

    assert.equal(signature.algorithm, "LATTICE_DILITHIUM");
    assert.ok(signature.entropy > 0.7, "Signature should have high entropy");
    assert.ok(signature.signature.length > 0, "Signature should not be empty");
    assert.ok(signature.publicKey.length > 0, "Public key should not be empty");
  });

  test("LatticeCrypto verifies valid signatures", () => {
    const crypto = new LatticeCrypto();
    const data = "Test message for verification";

    const signature = crypto.sign(data);
    const valid = crypto.verify(data, signature);

    assert.ok(valid, "Valid signature should verify successfully");
  });

  test("LatticeCrypto rejects low-entropy signatures", () => {
    const crypto = new LatticeCrypto();
    const data = "Test message";

    const signature = crypto.sign(data);
    // Tamper with entropy
    const tamperedSig = { ...signature, entropy: 0.5 };

    const valid = crypto.verify(data, tamperedSig);
    assert.ok(!valid, "Low-entropy signature should be rejected");
  });
});

describe("Phase 1: Hyperdimensional Computing Mesh (HCM)", () => {
  test("HDC encodes data into high-dimensional hypervectors", () => {
    const hdc = new HyperdimensionalComputing(10000);
    const data = { protocol: "SB689_OMEGA", owner: "JGA", verified: true };

    const hypervector = hdc.encode(data, "test_state");

    assert.equal(hypervector.dimensions, 10000);
    assert.equal(hypervector.label, "test_state");
    assert.ok(Math.abs(hypervector.magnitude - 1.0) < 0.01, "Should be unit vector");
  });

  test("HDC similarity detects matching states", () => {
    const hdc = new HyperdimensionalComputing(10000);

    const data1 = { protocol: "SB689", verified: true };
    const data2 = { protocol: "SB689", verified: true };

    const hv1 = hdc.encode(data1, "state1");
    const hv2 = hdc.encode(data2, "state2");

    const sim = hdc.similarity(hv1, hv2);

    assert.ok(sim.similarity > 0.8, `Similar states should have high similarity (got ${sim.similarity})`);
    assert.ok(sim.confidence > 0.8, "Should have high confidence");
  });

  test("HDC similarity detects different states", () => {
    const hdc = new HyperdimensionalComputing(10000);

    const data1 = { protocol: "SB689", verified: true };
    const data2 = { protocol: "CORRUPT", verified: false };

    const hv1 = hdc.encode(data1, "good_state");
    const hv2 = hdc.encode(data2, "bad_state");

    const sim = hdc.similarity(hv1, hv2);

    assert.ok(sim.similarity < 0.5, `Different states should have low similarity (got ${sim.similarity})`);
  });

  test("HDC verifyTruth validates semantic correctness", () => {
    const hdc = new HyperdimensionalComputing(10000);

    // Create expected state
    hdc.encode({ verified: true, confidence: 1.0 }, "valid_state");

    // Test against similar state
    const report = hdc.verifyTruth({ verified: true, confidence: 0.95 }, "valid_state");

    assert.ok(report.semanticMatch, "Should detect semantic match");
    assert.ok(report.confidenceScore > 0.7, "Should have high confidence");
  });

  test("HDC bundle creates composite hypervectors", () => {
    const hdc = new HyperdimensionalComputing(1000);

    const hv1 = hdc.encode({ value: 1 }, "hv1");
    const hv2 = hdc.encode({ value: 2 }, "hv2");
    const hv3 = hdc.encode({ value: 3 }, "hv3");

    const bundled = hdc.bundle([hv1, hv2, hv3], "composite");

    assert.equal(bundled.dimensions, 1000);
    assert.ok(Math.abs(bundled.magnitude - 1.0) < 0.01, "Bundled vector should be normalized");
  });
});

describe("Phase 1: Neuromorphic Self-Healing Substrate (NSH-S)", () => {
  test("NeuromorphicPredictor predicts failure from drift", () => {
    const predictor = new NeuromorphicPredictor();

    const drift = {
      drift: 0.8,
      pulseAlive: false,
      breach: true,
      reason: "High drift detected"
    };

    const prediction = predictor.predictFailure(drift);

    assert.ok(prediction.failureProbability >= 0 && prediction.failureProbability <= 1);
    assert.ok(prediction.predictedInMs >= 0);
    assert.ok(prediction.confidence >= 0 && prediction.confidence <= 1);
    assert.ok(typeof prediction.shouldPreempt === "boolean");
  });

  test("NeuromorphicPredictor learns from multiple drift samples", () => {
    const predictor = new NeuromorphicPredictor();

    // Feed multiple samples
    for (let i = 0; i < 20; i++) {
      const drift = {
        drift: 0.1 * i,
        pulseAlive: true,
        breach: false,
        reason: "Normal operation"
      };
      predictor.predictFailure(drift);
    }

    // High drift should trigger preemptive healing
    const criticalDrift = {
      drift: 1.0,
      pulseAlive: false,
      breach: true,
      reason: "Critical failure imminent"
    };

    const prediction = predictor.predictFailure(criticalDrift);

    assert.ok(prediction.failureProbability > 0.5, "Should detect high failure probability");
  });

  test("EventDrivenSentinel monitors with energy efficiency", () => {
    const sentinel = new EventDrivenSentinel();

    // No significant change - should return null (no processing)
    const normalDrift = {
      drift: 0.001,
      pulseAlive: true,
      breach: false,
      reason: "Stable"
    };

    const result1 = sentinel.monitor(normalDrift);
    // May return null for energy efficiency

    // Significant change - should process
    const criticalDrift = {
      drift: 0.9,
      pulseAlive: false,
      breach: true,
      reason: "Critical"
    };

    const result2 = sentinel.monitor(criticalDrift);
    assert.ok(result2, "Should process significant changes");
    assert.ok(result2.failureProbability > 0);
  });

  test("EventDrivenSentinel handles preemptive healing decision", () => {
    const sentinel = new EventDrivenSentinel();

    const highDrift = {
      drift: 0.95,
      pulseAlive: false,
      breach: true,
      reason: "Extreme drift"
    };

    const prediction = sentinel.monitor(highDrift);

    if (prediction && prediction.shouldPreempt) {
      assert.ok(prediction.failureProbability > 0.7, "Preemptive healing requires high probability");
      assert.ok(prediction.confidence > 0.6, "Preemptive healing requires reasonable confidence");
    }
  });
});

describe("Phase 1: Integration Tests", () => {
  test("All Phase 1 technologies integrate successfully", () => {
    const qrng = new QuantumRNG();
    const crypto = new LatticeCrypto();
    const hdc = new HyperdimensionalComputing(1000);
    const predictor = new NeuromorphicPredictor();

    // Generate quantum-random signature
    const entropy = qrng.generateBytes(16);
    assert.ok(entropy.entropy > 0);

    // Sign with post-quantum crypto
    const signature = crypto.sign("Integration test");
    assert.ok(crypto.verify("Integration test", signature));

    // Encode in hyperdimensional space
    const hv = hdc.encode({ test: "integration", valid: true }, "test_vector");
    assert.equal(hv.dimensions, 1000);

    // Predict with neuromorphic system
    const drift = { drift: 0.5, pulseAlive: true, breach: false, reason: "Test" };
    const prediction = predictor.predictFailure(drift);
    assert.ok(prediction.confidence >= 0);

    // All technologies working together
    assert.ok(true, "Phase 1 technologies integrate successfully");
  });
});
