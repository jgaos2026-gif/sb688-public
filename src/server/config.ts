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

const DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 6890,
  uploadMaxBodyBytes: 11 * 1024 * 1024,
  gracefulShutdownTimeoutMs: 10_000
});

export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv,
  override: Partial<Pick<ServerRuntimeConfig, "host" | "port" | "uploadMaxBodyBytes" | "gracefulShutdownTimeoutMs">> = {}
): ServerRuntimeConfig {
  const environment = normalizeEnvironment(env["SB688_ENV"]);
  const host = override.host ?? env["SB688_HOST"] ?? DEFAULTS.host;
  const operatorToken = env["SB688_OPERATOR_TOKEN"] ?? "";
  const requireOperatorAuth = environment === "production" || !isLoopbackHost(host);

  if (requireOperatorAuth && operatorToken.length < 32) {
    throw new Error("SB688_OPERATOR_TOKEN must contain at least 32 characters for production or non-loopback binding.");
  }

  return Object.freeze({
    environment,
    host,
    port: normalizeInteger(override.port ?? env["SB688_PORT"], DEFAULTS.port, 1, 65535),
    uploadMaxBodyBytes: normalizeInteger(
      override.uploadMaxBodyBytes ?? env["SB688_UPLOAD_MAX_BODY_BYTES"],
      DEFAULTS.uploadMaxBodyBytes,
      1_024,
      100 * 1024 * 1024
    ),
    gracefulShutdownTimeoutMs: normalizeInteger(
      override.gracefulShutdownTimeoutMs ?? env["SB688_GRACEFUL_SHUTDOWN_TIMEOUT_MS"],
      DEFAULTS.gracefulShutdownTimeoutMs,
      1_000,
      120_000
    ),
    requireOperatorAuth,
    operatorToken
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

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

export function isValidOperatorAuthorization(header: string | undefined, expectedToken: string): boolean {
  if (typeof header !== "string" || !header.startsWith("Bearer ") || expectedToken.length < 32) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function requiresOperatorAuthorization(method: string, url: string, required: boolean): boolean {
  if (!required || !url.startsWith("/api/")) return false;
  if (method === "GET" && (url === "/api/health" || url === "/api/ready")) return false;
  // The service-to-service route has its own independent bearer secret.
  if (method === "POST" && url === "/api/truth/pre-brain") return false;
  return true;
}
