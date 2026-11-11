export interface ServerRuntimeConfig {
  readonly environment: "development" | "staging" | "production";
  readonly host: string;
  readonly port: number;
  readonly uploadMaxBodyBytes: number;
  readonly gracefulShutdownTimeoutMs: number;
  readonly requireOperatorAuth: boolean;
  readonly operatorToken?: string;
}
const DEFAULTS = Object.freeze({ host: "127.0.0.1", port: 6890, uploadMaxBodyBytes: 11 * 1024 * 1024, gracefulShutdownTimeoutMs: 10_000 });
export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv,
  override: Partial<Omit<ServerRuntimeConfig, "environment" | "requireOperatorAuth" | "operatorToken">> = {}
): ServerRuntimeConfig {
  const environment = normalizeEnvironment(env["SB689_ENV"]);
  const operatorToken = env["SB689_OPERATOR_TOKEN"]?.trim() || undefined;
  const requireOperatorAuth = environment === "production" || env["SB689_REQUIRE_OPERATOR_AUTH"] === "true";
  if (requireOperatorAuth && (!operatorToken || Buffer.byteLength(operatorToken, "utf8") < 32)) {
    throw new Error("OPERATOR_AUTH_NOT_CONFIGURED: set SB689_OPERATOR_TOKEN to a randomly generated secret of at least 32 UTF-8 bytes before starting this protected runtime.");
  }
  return Object.freeze({
    environment,
    host: override.host ?? env["SB689_HOST"] ?? DEFAULTS.host,
    port: normalizeInteger(override.port ?? env["SB689_PORT"], DEFAULTS.port, 1, 65535),
    uploadMaxBodyBytes: normalizeInteger(override.uploadMaxBodyBytes ?? env["SB689_UPLOAD_MAX_BODY_BYTES"], DEFAULTS.uploadMaxBodyBytes, 1_024, 100 * 1024 * 1024),
    gracefulShutdownTimeoutMs: normalizeInteger(override.gracefulShutdownTimeoutMs ?? env["SB689_GRACEFUL_SHUTDOWN_TIMEOUT_MS"], DEFAULTS.gracefulShutdownTimeoutMs, 1_000, 120_000),
    requireOperatorAuth, operatorToken
  });
}
function normalizeEnvironment(value: string | undefined): ServerRuntimeConfig["environment"] {
  if (value === "production" || value === "staging" || value === "development") return value;
  return "development";
}
function normalizeInteger(value: string | number | undefined, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}
