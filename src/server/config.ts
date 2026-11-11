import { timingSafeEqual } from "node:crypto";
export interface ServerRuntimeConfig {
  readonly environment: "development" | "staging" | "production";
  readonly host: string;
  readonly port: number;
  readonly uploadMaxBodyBytes: number;
  readonly gracefulShutdownTimeoutMs: number;
  readonly requireOperatorAuth: boolean;
  readonly operatorToken: string;
}

const DEFAULTS: ServerRuntimeConfig = Object.freeze({
  environment: "development",
  host: "127.0.0.1",
  port: 6890,
  uploadMaxBodyBytes: 11 * 1024 * 1024,
  gracefulShutdownTimeoutMs: 10_000,
  requireOperatorAuth: false,
  operatorToken: ""
});

export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv,
  override: Partial<Pick<ServerRuntimeConfig, "host" | "port" | "uploadMaxBodyBytes" | "gracefulShutdownTimeoutMs">> = {}
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


function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host.toLowerCase() === "localhost";
}

export function isValidOperatorAuthorization(header: string | undefined, expectedToken: string): boolean {
  if (typeof header !== "string" || !header.startsWith("Bearer ") || expectedToken.length < 32) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
