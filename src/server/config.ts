export interface ServerRuntimeConfig {
  readonly environment: "development" | "staging" | "production";
  readonly host: string;
  readonly port: number;
  readonly uploadMaxBodyBytes: number;
  readonly gracefulShutdownTimeoutMs: number;
}

const DEFAULTS: ServerRuntimeConfig = Object.freeze({
  environment: "development",
  host: "127.0.0.1",
  port: 6890,
  uploadMaxBodyBytes: 11 * 1024 * 1024,
  gracefulShutdownTimeoutMs: 10_000
});

export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv,
  override: Partial<Omit<ServerRuntimeConfig, "environment">> = {}
): ServerRuntimeConfig {
  const environment = normalizeEnvironment(env["SB689_ENV"]);
  return Object.freeze({
    environment,
    host: override.host ?? env["SB689_HOST"] ?? DEFAULTS.host,
    port: normalizeInteger(override.port ?? env["SB689_PORT"], DEFAULTS.port, 1, 65535),
    uploadMaxBodyBytes: normalizeInteger(
      override.uploadMaxBodyBytes ?? env["SB689_UPLOAD_MAX_BODY_BYTES"],
      DEFAULTS.uploadMaxBodyBytes,
      1_024,
      100 * 1024 * 1024
    ),
    gracefulShutdownTimeoutMs: normalizeInteger(
      override.gracefulShutdownTimeoutMs ?? env["SB689_GRACEFUL_SHUTDOWN_TIMEOUT_MS"],
      DEFAULTS.gracefulShutdownTimeoutMs,
      1_000,
      120_000
    )
  });
}

function normalizeEnvironment(value: string | undefined): ServerRuntimeConfig["environment"] {
  if (value === "production" || value === "staging" || value === "development") {
    return value;
  }
  return "development";
}

function normalizeInteger(value: string | number | undefined, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}
