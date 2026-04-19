import { SB688Ledger, phaseClass } from "./ledger.js";
import { Visualization } from "./visualization.js";
import { Simulator } from "./simulator.js";

const ledgerEl = document.getElementById("ledger-stream");
const statusHealth = document.getElementById("status-health");
const statusBraid = document.getElementById("status-braid");
const statusPhase = document.getElementById("status-phase");
const statusClock = document.getElementById("status-clock");
const statusChain = document.getElementById("status-chain");

function clockTick() {
  const now = new Date();
  statusClock.textContent = now.toISOString().split("T")[1].replace("Z", "");
}
setInterval(clockTick, 25);
clockTick();

function renderLedger(entry, lineNo) {
  const row = document.createElement("div");
  row.className = `ledger-row ${phaseClass(entry.phase)}`;
  row.innerHTML = `<span class="line-no">${lineNo.toString().padStart(4, "0")}</span> <span class="ts">[${entry.timestamp}]</span> <span class="event">${entry.event_type}</span> <span class="msg">${entry.message}</span>`;
  ledgerEl.appendChild(row);
  ledgerEl.scrollTop = ledgerEl.scrollHeight;
}

const ledger = new SB688Ledger(renderLedger);
const visualization = new Visualization(document.getElementById("viz-canvas"), {
  health: document.getElementById("metric-health"),
  braid: document.getElementById("metric-braid"),
  bricks: document.getElementById("metric-bricks"),
  runtime: document.getElementById("metric-runtime"),
});

const simulator = new Simulator({
  ledger,
  visualization,
  onStatus: ({ health, braid, phase }) => {
    statusHealth.textContent = `${health.toFixed(1)}%`;
    statusBraid.textContent = braid;
    statusPhase.textContent = phase;
  },
});

const btnCorrupt = document.getElementById("btn-corrupt");
const btnRecover = document.getElementById("btn-recover");
const btnKill = document.getElementById("btn-kill");
const btnDownload = document.getElementById("btn-download");
const btnJson = document.getElementById("export-json");
const btnCsv = document.getElementById("export-csv");

let running = false;
async function runWithLock(fn) {
  if (running) return;
  running = true;
  try {
    await fn();
    const chain = await ledger.verifyChain();
    statusChain.textContent = chain.valid ? "VALID" : "BROKEN";
  } finally {
    running = false;
  }
}

btnCorrupt.addEventListener("click", () => runWithLock(async () => simulator.corruptSystem()));
btnRecover.addEventListener("click", () => runWithLock(async () => simulator.watchRecovery()));
btnKill.addEventListener("click", () => runWithLock(async () => simulator.killAndReset()));
btnDownload.addEventListener("click", () => ledger.download("json"));
btnJson.addEventListener("click", () => ledger.download("json"));
btnCsv.addEventListener("click", () => ledger.download("csv"));

simulator.init();
