import { test } from "node:test";
import assert from "node:assert/strict";
import { UniversalSovereignIntegrityFabric } from "../src/system/UniversalSovereignIntegrityFabric";

test("universal fabric: runs three sovereign systems through hostile multi-industry drills", async () => {
  const fabric = new UniversalSovereignIntegrityFabric();
  assert.equal(fabric.sovereignCount(), 3);

  const scenarios = [
    {
      industry: "banking",
      profile: {
        name: "hostile-hacker",
        tamperKeys: ["integrity", "domain", "profile", "industry", "accounting-ledger"],
        uploadAttacks: ["../inject.sh", "../../etc/passwd"],
        filesystemAttacks: ["/etc/shadow"]
      }
    },
    {
      industry: "healthcare",
      profile: {
        name: "corruption-rot",
        tamperKeys: ["integrity", "profile", "patient-record-index"],
        injectValues: { "memory-pocket": "bit-rot" }
      }
    },
    {
      industry: "manufacturing",
      profile: {
        name: "controller-drift",
        tamperKeys: ["domain", "industry", "controller-state"],
        injectValues: { "latency-window": "unsafe" }
      }
    },
    {
      industry: "government",
      profile: {
        name: "document-forgery",
        tamperKeys: ["integrity", "policy-class", "provenance"]
      }
    },
    {
      industry: "cloud",
      profile: {
        name: "runtime-bypass",
        tamperKeys: ["integrity", "domain", "profile", "runtime-strand"],
        uploadAttacks: ["..\\malicious.dll"]
      }
    },
    {
      industry: "space",
      profile: {
        name: "radiation-flip",
        pulseAlive: false,
        tamperKeys: ["integrity", "domain", "industry", "guidance-memory"]
      }
    },
    {
      industry: "deep-sea",
      profile: {
        name: "pressure-fault",
        pulseAlive: false,
        tamperKeys: ["integrity", "industry", "hull-telemetry", "memory-pocket"],
        filesystemAttacks: ["/proc/1/mem"]
      }
    }
  ] as const;

  for (const scenario of scenarios) {
    const report = await fabric.runIndustryDrill({
      industry: scenario.industry,
      intentText: `Defend ${scenario.industry} under ${scenario.profile.name}`,
      profile: scenario.profile
    });

    assert.equal(report.overallPassed, true, `drill failed for ${scenario.industry}`);
    assert.equal(report.sovereigns.length, 3, `expected tri-sovereign coverage for ${scenario.industry}`);

    for (const sovereign of report.sovereigns) {
      assert.equal(sovereign.triadSuccess, true);
      assert.equal(sovereign.rollbackSuccess, true);
      assert.equal(sovereign.runtimeVerified, true);
      assert.equal(sovereign.anomaliesBeforeHeal > 0, true);
      assert.equal(sovereign.anomaliesAfterHeal, 0);
      assert.equal(sovereign.ledgerValid, true);
      assert.equal(sovereign.rollbackElapsedMs >= 0, true);
    }

    if ("pulseAlive" in scenario.profile && scenario.profile.pulseAlive === false) {
      assert.equal(
        report.sovereigns.every((s) => s.resurrectionTriggered),
        true,
        `expected resurrection in pulse-loss scenario for ${scenario.industry}`
      );
    }
  }
});

test("universal fabric: hardest adversarial soak keeps all three sovereign systems recoverable", async () => {
  const fabric = new UniversalSovereignIntegrityFabric();

  const hostileProfiles = [
    {
      name: "red-team-overload",
      tamperKeys: ["integrity", "domain", "profile", "industry", "proof-ledger", "memory-braid"],
      uploadAttacks: ["../../tmp/dropper.exe", "../ransom.js"],
      filesystemAttacks: ["/etc/hosts", "/proc/kcore"]
    },
    {
      name: "silent-rot",
      tamperKeys: ["integrity", "archive-strand", "recovery-strand"],
      injectValues: { "ghost-reference": "corrupted" }
    },
    {
      name: "signal-chaos",
      pulseAlive: false,
      tamperKeys: ["integrity", "domain", "heartbeat", "triad-channel"],
      uploadAttacks: ["..\\..\\windows\\system32\\cmd.exe"]
    }
  ] as const;

  for (let i = 0; i < 18; i++) {
    const profile = hostileProfiles[i % hostileProfiles.length];
    const report = await fabric.runIndustryDrill({
      industry: `extreme-sector-${i + 1}`,
      intentText: `Hostile stress round ${i + 1}`,
      profile
    });

    assert.equal(report.overallPassed, true, `soak failure at round ${i + 1}`);
    assert.equal(report.sovereigns.every((s) => s.ledgerValid), true);
    assert.equal(report.sovereigns.every((s) => s.rollbackElapsedMs >= 0), true);
  }
});
