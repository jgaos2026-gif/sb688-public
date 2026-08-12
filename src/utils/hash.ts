import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

  return `{${entries.join(",")}}`;
}

export function hashOf(value: unknown): string {
  const input = stableStringify(value);
  const digest = createHash("sha256").update(input).digest("hex");
  return `sha256:${digest}`;
}

export function makeId(prefix: string, seed: unknown): string {
  return `${prefix}_${hashOf(seed).replace("sha256:", "")}`;
}
