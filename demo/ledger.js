const encoder = new TextEncoder();

export class SB688Ledger {
  constructor(onAppend) {
    this.onAppend = onAppend;
    this.entries = [];
    this.previousHash = "GENESIS";
  }

  timestamp() {
    const unixTimestampMicros = Math.floor((performance.timeOrigin + performance.now()) * 1000);
    const base = new Date(Math.floor(unixTimestampMicros / 1000)).toISOString();
    const micros = unixTimestampMicros % 1_000_000;
    return base.replace(/\.\d{3}Z$/, `.${String(micros).padStart(6, "0")}Z`);
  }

  async sha256(input) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async append(entryInput) {
    const entry = Object.freeze({
      timestamp: this.timestamp(),
      phase: entryInput.phase,
      event_type: entryInput.event_type,
      health: Number(entryInput.health.toFixed(1)),
      braid_status: entryInput.braid_status,
      message: entryInput.message,
      data: entryInput.data ?? {},
      checksum: this.previousHash,
    });

    const entryHash = await this.sha256(JSON.stringify(entry));
    const persisted = Object.freeze({ ...entry, entry_hash: entryHash });
    this.entries.push(persisted);
    this.previousHash = entryHash;
    if (this.onAppend) this.onAppend(persisted, this.entries.length);
    return persisted;
  }

  async verifyChain() {
    let previous = "GENESIS";
    for (const entry of this.entries) {
      const comparable = {
        timestamp: entry.timestamp,
        phase: entry.phase,
        event_type: entry.event_type,
        health: entry.health,
        braid_status: entry.braid_status,
        message: entry.message,
        data: entry.data,
        checksum: entry.checksum,
      };
      if (entry.checksum !== previous) return { valid: false, reason: "Broken checksum link" };
      const computed = await this.sha256(JSON.stringify(comparable));
      if (computed !== entry.entry_hash) return { valid: false, reason: "Entry hash mismatch" };
      previous = computed;
    }
    return { valid: true, final_hash: previous, entries: this.entries.length };
  }

  toJSON() {
    return JSON.stringify(this.entries, null, 2);
  }

  toCSV() {
    const headers = ["line", "timestamp", "phase", "event_type", "health", "braid_status", "message", "checksum", "entry_hash"];
    const lines = [headers.join(",")];
    this.entries.forEach((entry, i) => {
      const row = [
        String(i + 1),
        entry.timestamp,
        entry.phase,
        entry.event_type,
        entry.health.toFixed(1),
        entry.braid_status,
        `"${String(entry.message).replaceAll('"', '""')}"`,
        entry.checksum,
        entry.entry_hash,
      ];
      lines.push(row.join(","));
    });
    return lines.join("\n");
  }

  download(format = "json") {
    const isCsv = format === "csv";
    const blob = new Blob([isCsv ? this.toCSV() : this.toJSON()], { type: isCsv ? "text/csv" : "application/json" });
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `sb688-ledger-${new Date().toISOString().replace(/[:.]/g, "-")}.${isCsv ? "csv" : "json"}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      a.remove();
    }, 0);
  }
}

export function phaseClass(phase) {
  if (phase === "INIT") return "phase-init";
  if (phase === "CORRUPT" || phase === "DETECT" || phase === "ISOLATE") return "phase-corrupt";
  if (phase === "HEAL" || phase === "ROLLBACK" || phase === "COMPLETE") return "phase-heal";
  return "phase-verify";
}
