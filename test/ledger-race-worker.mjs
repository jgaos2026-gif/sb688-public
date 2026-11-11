/* Two-process race worker for the round-3 finding-C tests.
 *
 * Run with node directly (NOT compiled — it lives in test/ as plain JS
 * and imports the built code from ../dist). Modes:
 *
 *   append <filePath> <count> <tag>   — append <count> entries to the
 *     shared file-backed ledger, print APPEND-DONE.
 *   hold-lock <filePath> <holdMs>     — acquire the ledger's
 *     single-writer lockfile directly, hold it <holdMs>, release it.
 */
import { AuditLedger } from "../dist/src/ledger/AuditLedger.js";
import { acquireFileLock, releaseFileLock } from "../dist/src/utils/fileLock.js";

const [, , mode, ...args] = process.argv;

if (mode === "append") {
  const [filePath, count, tag] = args;
  const ledger = new AuditLedger({ filePath });
  for (let i = 0; i < Number(count); i++) {
    ledger.append({
      traceId: tag,
      from: "intent",
      to: "spine",
      status: "started",
      at: "2026-08-06T00:00:00.000Z",
      detail: { tag, i }
    });
  }
  console.log(`APPEND-DONE ${tag} ${ledger.entries().length}`);
} else if (mode === "hold-lock") {
  const [filePath, holdMs] = args;
  const handle = acquireFileLock(`${filePath}.lock`, { timeoutMs: 10_000 });
  console.log("LOCK-HELD");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(holdMs));
  releaseFileLock(handle);
  console.log("LOCK-RELEASED");
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}
