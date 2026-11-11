/**
 * evidence-run.ts — Phase 20 evidence bundle generator.
 *
 * Runs the test suite and wraps results in a machine-readable evidence bundle
 * saved to evidence/runs/<runId>.json and evidence/runs/<runId>.md
 *
 * Usage: npm run evidence
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EvidenceBundle } from "../src/evidence/EvidenceBundle";

const ROOT = join(__dirname, "..");
const RUNS_DIR = join(ROOT, "evidence", "runs");

if (!existsSync(RUNS_DIR)) {
  mkdirSync(RUNS_DIR, { recursive: true });
}

const bundle = new EvidenceBundle({ packageVersion: "1.1.1" });
console.log(`Evidence run started: ${bundle.id}`);

// Run the test suite
const result = spawnSync(
  process.execPath,
  ["--test", ...["dist/test/*.test.js"].flatMap((g) => {
    const { globSync } = require("node:fs");
    return globSync ? globSync(g, { cwd: ROOT }) : [g];
  })],
  {
    cwd: ROOT,
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf-8",
    shell: true,
  }
);

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
const combined = stdout + stderr;

// Parse TAP-ish summary from node:test output
const passMatch = combined.match(/^# pass\s+(\d+)/m);
const failMatch = combined.match(/^# fail\s+(\d+)/m);
const skipMatch = combined.match(/^# skipped\s+(\d+)/m);
const totalMatch = combined.match(/^1\.\.(\d+)/m);

const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;
const total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed + skipped;

// Count any explicit "silent trust escape" assertion failures in output
const silentEscapeMatches = combined.match(/SILENT TRUST ESCAPES?.*?(\d+)/gi) ?? [];
const silentTrustEscapes = silentEscapeMatches.reduce((acc, m) => {
  const num = m.match(/(\d+)\s*$/);
  return acc + (num ? parseInt(num[1], 10) : 0);
}, 0);

const { record, markdown } = bundle.finalize({
  total,
  passed,
  failed,
  skipped,
  silentTrustEscapes,
});

// Write evidence files
const jsonPath = join(RUNS_DIR, `${bundle.id}.json`);
const mdPath = join(RUNS_DIR, `${bundle.id}.md`);

writeFileSync(jsonPath, JSON.stringify(record, null, 2) + "\n", "utf-8");
writeFileSync(mdPath, markdown + "\n", "utf-8");

console.log(`Evidence bundle written:`);
console.log(`  JSON: ${jsonPath}`);
console.log(`  MD:   ${mdPath}`);
console.log(`  Run:  ${bundle.id}`);
console.log(`  Tests: ${passed}/${total} passed, ${failed} failed, ${silentTrustEscapes} silent-trust-escapes`);

if (failed > 0 || silentTrustEscapes > 0) {
  console.error("\n❌ Evidence run FAILED.");
  process.exit(1);
} else {
  console.log("\n✅ Evidence run PASSED.");
}
