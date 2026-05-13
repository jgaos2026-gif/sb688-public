/**
 * Hyperdimensional Computing (HDC) Module
 *
 * Implements Vector Symbolic Architecture (VSA) for the Truth Fabric.
 * Represents system states as 10,000+ dimensional hypervectors for robust,
 * brain-like computation with massive redundancy.
 *
 * Phase 1 Foundation: HCM (Hyperdimensional Computing Mesh)
 */

import { hashOf } from "../utils/hash";

export interface Hypervector {
  readonly dimensions: number;
  readonly values: Float32Array;
  readonly label: string;
  readonly magnitude: number;
}

export interface HypervectorSimilarity {
  readonly similarity: number; // Cosine similarity [-1, 1]
  readonly distance: number; // Euclidean distance
  readonly confidence: number; // [0, 1]
}

export interface HDCTruthReport {
  readonly verified: boolean;
  readonly similarity: number;
  readonly semanticMatch: boolean;
  readonly hypervectorSignature: string;
  readonly confidenceScore: number;
}

/**
 * Hyperdimensional Computing Engine
 * Enables brain-like, robust computation using high-dimensional vector spaces
 */
export class HyperdimensionalComputing {
  private readonly dimensions: number;
  private readonly codebook: Map<string, Hypervector>;

  constructor(dimensions: number = 10000) {
    this.dimensions = dimensions;
    this.codebook = new Map();
    this.initializeAtomicVectors();
  }

  /**
   * Create a hypervector representation of data
   */
  encode(data: Record<string, unknown>, label: string): Hypervector {
    const values = new Float32Array(this.dimensions);

    // Generate hypervector from data features
    const features = this.extractFeatures(data);

    for (let i = 0; i < this.dimensions; i++) {
      let component = 0;

      // Holographic Reduced Representation (HRR) binding
      for (const [key, value] of Object.entries(features)) {
        const keyVector = this.getAtomicVector(key);
        const valueVector = this.getAtomicVector(String(value));

        // Circular convolution for binding (simplified)
        component += keyVector.values[i] * valueVector.values[i];
      }

      values[i] = Math.tanh(component); // Normalize to [-1, 1]
    }

    const magnitude = this.calculateMagnitude(values);

    // Normalize to unit hypervector
    for (let i = 0; i < this.dimensions; i++) {
      values[i] /= magnitude;
    }

    const hypervector: Hypervector = {
      dimensions: this.dimensions,
      values,
      label,
      magnitude: 1.0 // Unit vector after normalization
    };

    this.codebook.set(label, hypervector);
    return hypervector;
  }

  /**
   * Measure similarity between two hypervectors
   * Uses cosine similarity in high-dimensional space
   */
  similarity(hv1: Hypervector, hv2: Hypervector): HypervectorSimilarity {
    if (hv1.dimensions !== hv2.dimensions) {
      throw new Error("Hypervectors must have same dimensionality");
    }

    // Cosine similarity: dot product of unit vectors
    let dotProduct = 0;
    let distanceSquared = 0;

    for (let i = 0; i < hv1.dimensions; i++) {
      dotProduct += hv1.values[i] * hv2.values[i];
      const diff = hv1.values[i] - hv2.values[i];
      distanceSquared += diff * diff;
    }

    const similarity = dotProduct; // Already normalized (unit vectors)
    const distance = Math.sqrt(distanceSquared);

    // Confidence based on similarity in high-dimensional space
    // High similarity in 10k dimensions is highly significant
    const confidence = (similarity + 1) / 2; // Map [-1,1] to [0,1]

    return {
      similarity,
      distance,
      confidence
    };
  }

  /**
   * Verify truth using hyperdimensional semantic matching
   */
  verifyTruth(stateData: Record<string, unknown>, expectedLabel: string): HDCTruthReport {
    const stateVector = this.encode(stateData, "live_state");
    const expectedVector = this.codebook.get(expectedLabel);

    if (!expectedVector) {
      return {
        verified: false,
        similarity: 0,
        semanticMatch: false,
        hypervectorSignature: hashOf({ stateVector: "unknown" }),
        confidenceScore: 0
      };
    }

    const sim = this.similarity(stateVector, expectedVector);

    // In high-dimensional spaces, similarity > 0.7 indicates strong match
    const semanticMatch = sim.similarity > 0.7;
    const verified = semanticMatch && sim.confidence > 0.85;

    return {
      verified,
      similarity: sim.similarity,
      semanticMatch,
      hypervectorSignature: hashOf({
        state: stateVector.label,
        expected: expectedVector.label,
        similarity: sim.similarity.toFixed(4)
      }),
      confidenceScore: sim.confidence
    };
  }

  /**
   * Bundle multiple hypervectors through superposition
   * Enables content-addressable memory
   */
  bundle(vectors: Hypervector[], label: string): Hypervector {
    const values = new Float32Array(this.dimensions);

    for (const vector of vectors) {
      for (let i = 0; i < this.dimensions; i++) {
        values[i] += vector.values[i];
      }
    }

    // Normalize
    const magnitude = this.calculateMagnitude(values);
    for (let i = 0; i < this.dimensions; i++) {
      values[i] /= magnitude;
    }

    const bundled: Hypervector = {
      dimensions: this.dimensions,
      values,
      label,
      magnitude: 1.0
    };

    this.codebook.set(label, bundled);
    return bundled;
  }

  /**
   * Bind two hypervectors through element-wise multiplication
   * Creates composite representations
   */
  bind(hv1: Hypervector, hv2: Hypervector, label: string): Hypervector {
    const values = new Float32Array(this.dimensions);

    for (let i = 0; i < this.dimensions; i++) {
      values[i] = hv1.values[i] * hv2.values[i];
    }

    // Normalize
    const magnitude = this.calculateMagnitude(values);
    for (let i = 0; i < this.dimensions; i++) {
      values[i] /= magnitude;
    }

    const bound: Hypervector = {
      dimensions: this.dimensions,
      values,
      label,
      magnitude: 1.0
    };

    this.codebook.set(label, bound);
    return bound;
  }

  private initializeAtomicVectors(): void {
    // Create random atomic vectors for common symbols
    const atoms = ["true", "false", "protocol", "owner", "state", "checksum", "valid", "invalid"];

    for (const atom of atoms) {
      this.createAtomicVector(atom);
    }
  }

  private createAtomicVector(symbol: string): Hypervector {
    const values = new Float32Array(this.dimensions);

    // Generate random high-dimensional vector with deterministic seed
    const seed = hashOf({ symbol, type: "atomic_vector" });

    for (let i = 0; i < this.dimensions; i++) {
      const hash = hashOf({ seed, index: i });
      const value = (parseInt(hash.slice(0, 8), 16) / 0xffffffff) * 2 - 1;
      values[i] = value;
    }

    const magnitude = this.calculateMagnitude(values);
    for (let i = 0; i < this.dimensions; i++) {
      values[i] /= magnitude;
    }

    const vector: Hypervector = {
      dimensions: this.dimensions,
      values,
      label: symbol,
      magnitude: 1.0
    };

    this.codebook.set(symbol, vector);
    return vector;
  }

  private getAtomicVector(symbol: string): Hypervector {
    let vector = this.codebook.get(symbol);
    if (!vector) {
      vector = this.createAtomicVector(symbol);
    }
    return vector;
  }

  private extractFeatures(data: Record<string, unknown>): Record<string, unknown> {
    const features: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "object" && value !== null) {
        // Flatten nested objects with more distinction
        features[key] = hashOf({ key, value });
      } else {
        // Use both key and value to create more unique features
        features[key] = `${key}:${value}`;
      }
    }

    return features;
  }

  private calculateMagnitude(values: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < values.length; i++) {
      sumSquares += values[i] * values[i];
    }
    return Math.sqrt(sumSquares);
  }
}
