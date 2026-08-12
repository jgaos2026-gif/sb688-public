type LogLevel = "info" | "warn" | "error";

export function logServerEvent(
  level: LogLevel,
  event: string,
  detail: Readonly<Record<string, unknown>>
): void {
  const record = {
    ts: new Date().toISOString(),
    service: "sb689-system-server",
    level,
    event,
    ...detail
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
}
