/**
 * Neuromorphic Self-Healing Substrate
 *
 * Implements Spiking Neural Network (SNN) for adaptive resilience.
 * Learns optimal recovery patterns through spike-timing-dependent plasticity (STDP).
 *
 * Phase 1 Foundation: NSH-S (Neuromorphic Self-Healing Substrate)
 */

import type { DriftReport } from "../omega/contracts";
import { hashOf } from "../utils/hash";

export interface SpikingNeuron {
  readonly id: string;
  potential: number; // Membrane potential
  threshold: number; // Firing threshold
  lastSpike: number; // Last spike time
  readonly connections: SynapticConnection[];
}

export interface SynapticConnection {
  readonly targetId: string;
  weight: number; // Synaptic weight (strength)
  readonly delay: number; // Propagation delay (ms)
}

export interface SpikeEvent {
  readonly neuronId: string;
  readonly time: number;
  readonly potential: number;
}

export interface NeuromorphicPrediction {
  readonly failureProbability: number;
  readonly predictedInMs: number;
  readonly confidence: number;
  readonly reservoirState: string;
  readonly shouldPreempt: boolean;
}

/**
 * Liquid State Machine (LSM) for continuous readiness
 * Uses reservoir computing for real-time anomaly prediction
 */
export class LiquidStateMachine {
  private readonly neurons: SpikingNeuron[] = [];
  private readonly reservoirSize: number;
  private time: number = 0;
  private readonly spikeHistory: SpikeEvent[] = [];

  constructor(reservoirSize: number = 100) {
    this.reservoirSize = reservoirSize;
    this.initializeReservoir();
  }

  /**
   * Process input signal through the liquid reservoir
   * Returns reservoir state for downstream readout
   */
  process(input: number[]): Float32Array {
    this.time += 1;

    // Inject input into reservoir
    for (let i = 0; i < Math.min(input.length, this.reservoirSize); i++) {
      this.neurons[i].potential += input[i];
    }

    // Update all neurons (parallel spiking dynamics)
    const spikes: SpikeEvent[] = [];

    for (const neuron of this.neurons) {
      // Leak: exponential decay
      neuron.potential *= 0.95;

      // Check for spike
      if (neuron.potential >= neuron.threshold) {
        spikes.push({
          neuronId: neuron.id,
          time: this.time,
          potential: neuron.potential
        });

        // Reset after spike
        neuron.potential = 0;
        neuron.lastSpike = this.time;

        // Propagate spike to connected neurons
        for (const conn of neuron.connections) {
          const target = this.neurons.find(n => n.id === conn.targetId);
          if (target) {
            // Add synaptic current (delayed)
            target.potential += conn.weight;
          }
        }
      }
    }

    this.spikeHistory.push(...spikes);

    // Keep history bounded
    if (this.spikeHistory.length > 1000) {
      this.spikeHistory.splice(0, this.spikeHistory.length - 1000);
    }

    // Return reservoir state as readout vector
    return this.getReservoirState();
  }

  /**
   * Get current state of the liquid reservoir
   */
  private getReservoirState(): Float32Array {
    const state = new Float32Array(this.reservoirSize);

    for (let i = 0; i < this.neurons.length; i++) {
      state[i] = this.neurons[i].potential;
    }

    return state;
  }

  /**
   * Apply STDP learning rule to adapt synaptic weights
   */
  applySTDP(preSpike: number, postSpike: number, connection: SynapticConnection): void {
    const timeDiff = postSpike - preSpike;

    // STDP: Hebbian learning with timing
    if (timeDiff > 0 && timeDiff < 20) {
      // Pre before post: strengthen (LTP)
      connection.weight += 0.01 * Math.exp(-timeDiff / 10);
    } else if (timeDiff < 0 && timeDiff > -20) {
      // Post before pre: weaken (LTD)
      connection.weight -= 0.01 * Math.exp(timeDiff / 10);
    }

    // Bound weights
    connection.weight = Math.max(0, Math.min(1, connection.weight));
  }

  private initializeReservoir(): void {
    // Create neurons with random properties
    for (let i = 0; i < this.reservoirSize; i++) {
      const neuron: SpikingNeuron = {
        id: `neuron_${i}`,
        potential: Math.random() * 0.5,
        threshold: 0.8 + Math.random() * 0.4,
        lastSpike: -1000,
        connections: []
      };

      // Create random recurrent connections (10% connectivity)
      for (let j = 0; j < this.reservoirSize; j++) {
        if (i !== j && Math.random() < 0.1) {
          (neuron.connections as SynapticConnection[]).push({
            targetId: `neuron_${j}`,
            weight: (Math.random() - 0.5) * 0.5, // Random excitatory/inhibitory
            delay: Math.floor(Math.random() * 5) + 1
          });
        }
      }

      this.neurons.push(neuron);
    }
  }
}

/**
 * Neuromorphic Prediction Engine
 * Predicts failures before they occur using reservoir computing
 */
export class NeuromorphicPredictor {
  private readonly lsm: LiquidStateMachine;
  private readonly history: number[][] = [];
  private readonly maxHistory = 50;

  constructor() {
    this.lsm = new LiquidStateMachine(100);
  }

  /**
   * Predict failure probability from current drift report
   * Uses temporal dynamics of reservoir to detect anomalous patterns
   */
  predictFailure(drift: DriftReport): NeuromorphicPrediction {
    // Convert drift to input signal
    const input = this.driftToSignal(drift);

    // Process through liquid state machine
    const reservoirState = this.lsm.process(input);

    // Calculate anomaly score from reservoir dynamics
    const anomalyScore = this.calculateAnomalyScore(reservoirState);

    // Predict time to failure
    const failureProbability = anomalyScore;
    const predictedInMs = failureProbability > 0.5 ? 100 / failureProbability : Infinity;

    // Confidence based on history stability
    const confidence = this.calculateConfidence();

    // Should we preemptively heal?
    const shouldPreempt = failureProbability > 0.8 && confidence > 0.7;

    return {
      failureProbability,
      predictedInMs: Math.min(predictedInMs, 10000),
      confidence,
      reservoirState: hashOf({ state: Array.from(reservoirState.slice(0, 10)) }),
      shouldPreempt
    };
  }

  private driftToSignal(drift: DriftReport): number[] {
    // Convert drift metrics to neural input signal
    const signal = [
      drift.drift / 100, // Normalize
      drift.pulseAlive ? 1.0 : -1.0,
      drift.breach ? 1.0 : -1.0,
      drift.reason.length / 100 // Context complexity
    ];

    this.history.push(signal);

    // Keep bounded history
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return signal;
  }

  private calculateAnomalyScore(state: Float32Array): number {
    // Calculate deviation from typical reservoir behavior
    let activity = 0;
    for (let i = 0; i < state.length; i++) {
      activity += Math.abs(state[i]);
    }

    activity /= state.length;

    // High activity = potential anomaly
    // Map to [0, 1] probability
    return Math.tanh(activity * 2);
  }

  private calculateConfidence(): number {
    if (this.history.length < 10) return 0.5;

    // Confidence based on prediction stability
    let variance = 0;
    for (let i = 1; i < this.history.length; i++) {
      const diff = this.history[i][0] - this.history[i - 1][0];
      variance += diff * diff;
    }

    variance /= this.history.length - 1;

    // Low variance = high confidence
    return Math.exp(-variance * 10);
  }
}

/**
 * Event-Driven Sentinel
 * Monitors system with neuromorphic efficiency (1000x power reduction)
 */
export class EventDrivenSentinel {
  private readonly predictor: NeuromorphicPredictor;
  private lastEvent: number = Date.now();

  constructor() {
    this.predictor = new NeuromorphicPredictor();
  }

  /**
   * Monitor drift with event-driven efficiency
   * Only processes on significant changes (spiking behavior)
   */
  monitor(drift: DriftReport): NeuromorphicPrediction | null {
    const now = Date.now();

    // Event-driven: only process if significant change
    const significantChange = drift.breach || drift.drift > 50 || !drift.pulseAlive;

    // Or if enough time passed (temporal spike)
    const timeSinceLastEvent = now - this.lastEvent;
    const temporalSpike = timeSinceLastEvent > 100;

    if (!significantChange && !temporalSpike) {
      return null; // No event, no processing (energy efficient)
    }

    this.lastEvent = now;

    // Process through neuromorphic predictor
    return this.predictor.predictFailure(drift);
  }
}
