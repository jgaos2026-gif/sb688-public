export class Simulator {
  constructor({ ledger, visualization, onStatus }) {
    this.ledger = ledger;
    this.visualization = visualization;
    this.onStatus = onStatus;
    this.phase = "INIT";
    this.health = 100;
    this.braidStatus = "GREEN";
    this.bricks = Array.from({ length: 64 }, () => "operational");
    this.corrupted = false;
    this.runToken = 0;
    this.sequenceStartedAt = 0;
  }

  status() {
    this.onStatus?.({
      health: this.health,
      braid: this.braidStatus,
      phase: this.phase,
    });
  }

  syncViz(runtimeMs = 0) {
    this.visualization.setState({
      health: this.health,
      braidStatus: this.braidStatus,
      phase: this.phase,
      runtimeMs,
      bricks: this.bricks.slice(),
    });
    this.status();
  }

  async wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async init() {
    this.syncViz(0);
    await this.ledger.append({
      phase: "INIT",
      event_type: "SYSTEM_INIT",
      health: this.health,
      braid_status: this.braidStatus,
      message: "System initialized. 64/64 bricks operational.",
      data: { bricks_operational: 64, readiness: "LIVE_DEMO_READY" },
    });
  }

  async corruptSystem() {
    const token = ++this.runToken;
    this.sequenceStartedAt = performance.now();
    this.phase = "CORRUPT";
    await this.ledger.append({
      phase: "CORRUPT",
      event_type: "CORRUPTION_START",
      health: this.health,
      braid_status: this.braidStatus,
      message: "Injecting controlled corruption: target 99.8% impact.",
      data: { target_failure_percent: 99.8, duration_ms: 500 },
    });

    const order = Array.from({ length: 64 }, (_, i) => i).sort(() => Math.random() - 0.5);
    const toCorrupt = 63;
    for (let i = 0; i < toCorrupt; i += 1) {
      if (token !== this.runToken) return;
      const idx = order[i];
      this.bricks[idx] = "corrupted";
      this.health = Number((100 - (i + 1) * ((99.8 / toCorrupt))).toFixed(1));
      this.braidStatus = "RED";
      this.syncViz(performance.now() - this.sequenceStartedAt);
      await this.ledger.append({
        phase: "CORRUPT",
        event_type: "CORRUPTION_EVENT",
        health: this.health,
        braid_status: this.braidStatus,
        message: `Brick ${idx + 1} corrupted.`,
        data: { brick_index: idx + 1, corrupted_count: i + 1, total_bricks: 64 },
      });
      await this.wait(500 / toCorrupt);
    }

    this.health = 0.2;
    this.syncViz(performance.now() - this.sequenceStartedAt);

    this.phase = "DETECT";
    await this.ledger.append({
      phase: "DETECT",
      event_type: "VERA_DETECT",
      health: this.health,
      braid_status: this.braidStatus,
      message: "CORRUPTION_DETECTED: 99.8% of system compromised.",
      data: { detection_latency_ms: 100, threshold_breach: true },
    });
    await this.wait(100);

    if (token !== this.runToken) return;
    this.phase = "ISOLATE";
    this.syncViz(performance.now() - this.sequenceStartedAt);
    await this.ledger.append({
      phase: "ISOLATE",
      event_type: "ISOLATION_PROTOCOL",
      health: this.health,
      braid_status: this.braidStatus,
      message: "Infected segments quarantined. Cascade contained.",
      data: { quarantine_boundaries: "ROW_1..ROW_8", duration_ms: 100 },
    });
    await this.wait(100);
    this.corrupted = true;
    this.phase = "ISOLATE";
    this.syncViz(performance.now() - this.sequenceStartedAt);
  }

  async watchRecovery() {
    if (!this.corrupted) {
      await this.corruptSystem();
    }
    const token = this.runToken;

    this.phase = "ROLLBACK";
    this.syncViz(performance.now() - this.sequenceStartedAt);
    this.visualization.activateGhostNodes(5, 300);
    await this.ledger.append({
      phase: "ROLLBACK",
      event_type: "CHECKPOINT_RESTORE",
      health: this.health,
      braid_status: "HEALING",
      message: `CHECKPOINT_RESTORE: Reverting to ${this.ledger.entries[0]?.timestamp ?? "GENESIS"}`,
      data: { rollback_duration_ms: 300, ghost_nodes: 5 },
    });
    await this.wait(300);
    if (token !== this.runToken) return;

    this.phase = "HEAL";
    this.braidStatus = "HEALING";
    this.visualization.activateScanWave(500);
    const healOrder = Array.from({ length: 64 }, (_, i) => i);
    for (let i = 0; i < healOrder.length; i += 1) {
      if (token !== this.runToken) return;
      const idx = healOrder[i];
      this.bricks[idx] = "healing";
      this.health = Number((0.2 + ((i + 1) / healOrder.length) * 99.8).toFixed(1));
      this.syncViz(performance.now() - this.sequenceStartedAt);
      await this.wait(500 / healOrder.length / 2);
      this.bricks[idx] = "operational";
      this.syncViz(performance.now() - this.sequenceStartedAt);
      await this.ledger.append({
        phase: "HEAL",
        event_type: "HEAL_STEP",
        health: this.health,
        braid_status: this.braidStatus,
        message: `Brick ${idx + 1} restitched.`,
        data: { brick_index: idx + 1, healed_count: i + 1, total_bricks: 64 },
      });
      await this.wait(500 / healOrder.length / 2);
    }

    this.phase = "VERIFY";
    this.health = 100;
    this.braidStatus = "GREEN";
    this.syncViz(performance.now() - this.sequenceStartedAt);
    await this.wait(200);
    const chain = await this.ledger.verifyChain();
    await this.ledger.append({
      phase: "VERIFY",
      event_type: "VERIFICATION_PASSED",
      health: this.health,
      braid_status: this.braidStatus,
      message: "VERIFICATION_PASSED: System integrity confirmed.",
      data: { chain_valid: chain.valid, final_hash: chain.final_hash, verification_duration_ms: 200 },
    });

    this.phase = "COMPLETE";
    this.corrupted = false;
    this.syncViz(performance.now() - this.sequenceStartedAt);
    await this.ledger.append({
      phase: "COMPLETE",
      event_type: "LEDGER_SEAL",
      health: this.health,
      braid_status: this.braidStatus,
      message: "Recovery complete. Ledger sealed with final checksum.",
      data: { total_elapsed_ms: Math.round(performance.now() - this.sequenceStartedAt), final_hash: chain.final_hash },
    });
  }

  async killAndReset() {
    this.runToken += 1;
    this.phase = "ROLLBACK";
    this.braidStatus = "HEALING";
    this.health = 0;
    this.bricks = Array.from({ length: 64 }, () => "corrupted");
    this.syncViz(0);
    this.visualization.activateGhostNodes(4, 400);
    this.visualization.activateScanWave(450);
    await this.ledger.append({
      phase: "ROLLBACK",
      event_type: "KILL_RESET",
      health: this.health,
      braid_status: this.braidStatus,
      message: "Hard stop triggered. Ghost node reconstruction in progress.",
      data: { mode: "HARD_STOP", reconstruction: true },
    });
    await this.wait(450);

    this.health = 100;
    this.braidStatus = "GREEN";
    this.phase = "INIT";
    this.bricks = Array.from({ length: 64 }, () => "operational");
    this.corrupted = false;
    this.syncViz(0);
    await this.ledger.append({
      phase: "COMPLETE",
      event_type: "RESET_COMPLETE",
      health: this.health,
      braid_status: this.braidStatus,
      message: "System rebuilt by ghost nodes. All bricks operational.",
      data: { bricks_operational: 64, elapsed_ms: 450 },
    });
  }
}
