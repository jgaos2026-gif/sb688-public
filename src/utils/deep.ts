/**
 * Deep clone / deep freeze for plain JSON-shaped values.
 *
 * Boundary (documented, not hidden): only plain objects and arrays are
 * cloned/frozen recursively. Primitives pass through unchanged. Exotic
 * values (Date, Error, class instances, functions) are passed through by
 * reference and are NOT frozen — ledger `detail` payloads are JSON-shaped
 * by contract, so this covers everything the ledger is allowed to hold.
 * If a non-plain value ever needs freezing, that is a caller contract
 * violation, not something to silently paper over here.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Recursively clone plain objects/arrays; everything else by reference. */
export function deepCloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneValue(item)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = deepCloneValue(val);
    }
    return out as T;
  }
  return value;
}

/** Recursively Object.freeze plain objects/arrays, in place. Returns the value. */
export function deepFreezeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeValue(item);
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const val of Object.values(value)) deepFreezeValue(val);
    return Object.freeze(value);
  }
  return value;
}
