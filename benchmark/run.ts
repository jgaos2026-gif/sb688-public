/**
 * BCT Benchmark Runner — Phase 1 & 8.
 *
 * Measures and records real performance data for all major subsystems.
 * No fabricated numbers. All results trace to executable code.
 *
 * Run: node dist/benchmark/run.js
 */

import { AuditLedger } from "../src/ledger/AuditLedger";
import { BraidedRuntime } from "../src/runtime/BraidedRuntime";
import { OmegaSupervisor } from "../src/omega/OmegaSupervisor";
import { PhoenixRecovery } from "../src/phoenix/PhoenixRecovery";
import { PhoenixPatrol } from "../src/phoenix/PhoenixPatrol";
import { TriadCoordinator } from "../src/triad/TriadCoordinator";
import { PairedNodeSystem } from "../src/paired/PairedNodeSystem";
import { BctVerifier, computeBraidSignature } from "../src/truth/BctVerifier";
import { UploadSentinel } from "../src/upload/UploadSentinel";
import { FileUploadManager } from "../src/upload/FileUploadManager";
import { hashOf } from "../src/utils/hash";
import { fixedClock } from "../src/utils/time";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SEED = Object.freeze({ protocol: "SB689", version: 1, owner: "JGA", bricks: "SEED,GHOST,ARMOR,CROWN" });
const SPINE_SIG = "sha256:aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111";
const AT = "2026-08-06T00:00:00.000Z";

interface BenchResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
}

function bench(name: string, iterations: number, fn: () => void): BenchResult {
  for (let i = 0; i < Math.min(5, iterations); i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return {
    name,
    iterations,
    totalMs: +total.toFixed(4),
    avgMs: +avg.toFixed(6),
    minMs: +min.toFixed(6),
    maxMs: +max.toFixed(6),
    opsPerSec: +(1000 / avg).toFixed(2)
  };
}

async function benchAsync(name: string, iterations: number, fn: () => Promise<void>): Promise<BenchResult> {
  for (let i = 0; i < Math.min(3, iterations); i++) await fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return {
    name,
    iterations,
    totalMs: +total.toFixed(4),
    avgMs: +avg.toFixed(6),
    minMs: +min.toFixed(6),
    maxMs: +max.toFixed(6),
    opsPerSec: +(1000 / avg).toFixed(2)
  };
}

async function main() {
  const results: BenchResult[] = [];
  const startAll = performance.now();

  console.log("BCT Benchmark Runner\n");

  results.push(bench("hashOf (small object)", 1000, () => { hashOf(SEED); }));
  results.push(bench("hashOf (large object 1KB)", 1000, () => { hashOf({ ...SEED, data: "x".repeat(1000) }); }));

  results.push(bench("AuditLedger.append x10", 1000, () => {
    const l = new AuditLedger();
    for (let i = 0; i < 10; i++) l.append({ traceId: `t${i}`, from: "intent", to: "spine", status: "started", at: AT, detail: { i } });
  }));

  results.push(bench("AuditLedger.verifyChain (10 entries)", 1000, () => {
    const l = new AuditLedger();
    for (let i = 0; i < 10; i++) l.append({ traceId: `t${i}`, from: "intent", to: "spine", status: "started", at: AT, detail: {} });
    l.verifyChain();
  }));

  results.push(await benchAsync("BraidedRuntime.run (success path)", 20, async () => {
    const rt = new BraidedRuntime({ ledger: new AuditLedger(), clock: fixedClock(AT) });
    await rt.run({ id: "bench-ok", text: "Benchmark run through the governed path." });
  }));

  results.push(await benchAsync("BraidedRuntime.run (failure path)", 20, async () => {
    const rt = new BraidedRuntime({ ledger: new AuditLedger(), clock: fixedClock(AT) });
    await rt.run({ id: "bench-fail", text: "force-brain-failure benchmark" });
  }));

  results.push(bench("OmegaSupervisor.tick (stable)", 500, () => {
    const omega = new OmegaSupervisor({ seedState: SEED, clock: fixedClock(AT) });
    omega.tick({ liveState: SEED, pulseAlive: true });
  }));

  results.push(bench("OmegaSupervisor resurrection", 500, () => {
    const omega = new OmegaSupervisor({ seedState: SEED, clock: fixedClock(AT) });
    omega.tick({ liveState: { ...SEED, owner: "TAMPERED" }, pulseAlive: true });
  }));

  results.push(bench("PhoenixRecovery.checkpoint", 1000, () => {
    const r = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
    r.checkpoint(SEED);
  }));

  results.push(bench("PhoenixRecovery.rollback (10 snaps)", 500, () => {
    const r = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
    const snaps = [];
    for (let i = 0; i < 10; i++) snaps.push(r.checkpoint({ ...SEED, i }));
    r.rollback(snaps[0].id);
  }));

  results.push(bench("PhoenixRecovery.replay (10 checkpoints)", 500, () => {
    const r = new PhoenixRecovery(new AuditLedger(), fixedClock(AT));
    for (let i = 0; i < 10; i++) r.checkpoint({ ...SEED, i });
    r.replay();
  }));

  results.push(bench("PhoenixPatrol.patrol (clean)", 500, () => {
    const ledger = new AuditLedger();
    const rec = new PhoenixRecovery(ledger, fixedClock(AT));
    rec.checkpoint(SEED);
    new PhoenixPatrol(ledger, rec, fixedClock(AT)).patrol({ liveState: SEED, seedState: SEED });
  }));

  results.push(bench("TriadCoordinator.run (clean)", 500, () => {
    new TriadCoordinator(new AuditLedger(), fixedClock(AT)).run(SEED, SEED);
  }));

  results.push(bench("TriadCoordinator.run (corrupted)", 500, () => {
    new TriadCoordinator(new AuditLedger(), fixedClock(AT)).run({ ...SEED, owner: "BAD" }, SEED);
  }));

  results.push(bench("PairedNodeSystem.verify (agree)", 1000, () => {
    new PairedNodeSystem(new AuditLedger(), fixedClock(AT)).verify(SEED, SEED);
  }));

  results.push(bench("PairedNodeSystem.verify (disagree)", 1000, () => {
    new PairedNodeSystem(new AuditLedger(), fixedClock(AT)).verify(SEED, { ...SEED, version: 99 });
  }));

  results.push(bench("BctVerifier.verify (all 6 pass)", 1000, () => {
    const ledger = new AuditLedger();
    const v = new BctVerifier(ledger, fixedClock(AT));
    const dh = hashOf(SEED);
    v.verify({ identity: "bench", state: SEED, declaredHash: dh, braidSignature: computeBraidSignature(dh, SPINE_SIG), spineSignature: SPINE_SIG, priorAuditHash: "GENESIS" });
  }));

  results.push(bench("UploadSentinel.scan (clean)", 1000, () => {
    new UploadSentinel().scan("report.json", '{"v":1}', "application/json");
  }));

  results.push(bench("FileUploadManager.receive+dispatch", 500, () => {
    const mgr = new FileUploadManager(new AuditLedger());
    mgr.receive({ filename: "f.txt", content: "hello bench", contentType: "text/plain" });
    mgr.dispatch({ filename: "f.txt", destination: "archive" });
  }));

  const totalMs = +(performance.now() - startAll).toFixed(2);

  console.log("=".repeat(80));
  console.log(`${"Benchmark".padEnd(50)} ${"Avg ms".padStart(10)} ${"Min ms".padStart(10)} ${"ops/s".padStart(10)}`);
  console.log("-".repeat(82));
  for (const r of results) {
    console.log(`${r.name.padEnd(50)} ${String(r.avgMs).padStart(10)} ${String(r.minMs).padStart(10)} ${String(r.opsPerSec).padStart(10)}`);
  }
  console.log("=".repeat(82));
  console.log(`Total wall time: ${totalMs} ms`);

  const env = { node: process.version, platform: process.platform, arch: process.arch, timestamp: new Date().toISOString() };
  const output = { env, totalBenchmarkMs: totalMs, results };

  mkdirSync(join(process.cwd(), "evidence", "benchmark_graphs"), { recursive: true });
  writeFileSync(join(process.cwd(), "evidence", "benchmark_results.json"), JSON.stringify(output, null, 2));
  console.log("\nWrote: evidence/benchmark_results.json");

  return output;
}

main().catch((e) => { console.error(e); process.exit(1); });
