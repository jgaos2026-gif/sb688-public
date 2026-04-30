import { AuditLedger, BraidedRuntime, OmegaSupervisor } from "../src";

async function main(): Promise<void> {
  const ledger = new AuditLedger();
  const runtime = new BraidedRuntime({ ledger });

  // ----- SB689 Braided Runtime -----
  const response = await runtime.run({
    id: "demo-001",
    text: "Build a governed runtime response using the SB689 braided loop."
  });

  console.log("=== SB689 Braided Runtime Demo ===");
  console.log(response.output);
  console.log("\nVerified:", response.verified);
  console.log("Audit hash:", response.auditHash);
  console.log("Ghost checkpoint:", response.checkpoint?.id);

  // ----- SB689 OMEGA · Sovereign Stitch -----
  console.log("\n=== SB689 OMEGA · Sovereign Stitch ===");
  const omega = new OmegaSupervisor({
    ledger,
    seedState: {
      protocol: "SB689_OMEGA",
      owner: "JGA",
      philosophy: "Elegance with Consequences",
      bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
    }
  });

  let status = omega.tick({
    liveState: {
      protocol: "SB689_OMEGA",
      owner: "JGA",
      philosophy: "Elegance with Consequences",
      bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
    },
    pulseAlive: true
  });
  console.log("Cycle 1:", status.status, "| crown:", status.crown.color);

  status = omega.tick({
    liveState: { protocol: "SB689_OMEGA", owner: "TAMPERED" },
    pulseAlive: true
  });
  console.log(
    "Cycle 2:",
    status.status,
    "| crown:",
    status.crown.color,
    "| reason:",
    status.lastDrift.reason
  );

  status = omega.tick({
    liveState: {
      protocol: "SB689_OMEGA",
      owner: "JGA",
      philosophy: "Elegance with Consequences",
      bricks: ["SEED", "GHOST", "ARMOR", "CROWN"]
    },
    pulseAlive: false
  });
  console.log(
    "Cycle 3 (pulse-loss):",
    status.status,
    "| crown:",
    status.crown.color,
    "| reason:",
    status.lastDrift.reason
  );

  const handshake = omega.connectToStitch();
  console.log("\nON_READY ::", handshake.message);
  console.log("Stitch signature:", handshake.signature);

  console.log("\n=== Ledger Trace ===");
  for (const entry of ledger.entries()) {
    console.log(`${entry.sequence}. ${entry.from} -> ${entry.to} [${entry.status}] ${entry.hash}`);
  }
  console.log(
    `\nLedger entries: ${ledger.entries().length} | chain valid: ${ledger.verifyChain()}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
