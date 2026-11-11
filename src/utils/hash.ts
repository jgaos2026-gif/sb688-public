import { createHash } from "node:crypto";

/**
 * Well-formed content hash: `sha256:` + 64 lowercase hex chars.
 * Canonical hashes produced by hashOf() always have this shape; the
 * BctHeadRegistry (and the evidence-ledger cross-check) reject
 * anything else instead of trusting an unvalidated string.
 */
export function isWellFormedHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

/**
 * Canonical numeric representation — SHARED SPEC with the Python
 * implementation. Both sides MUST produce byte-identical strings for
 * the same number, or cross-language hashes disagree.
 *
 *   - Integers and integer-valued floats whose shortest decimal has
 *     no fractional digits: the exact integer value as a decimal
 *     string (BigInt for integer-valued doubles beyond the safe range).
 *     No decimal point, no exponent. Negative zero normalizes to "0".
 *   - Every other finite float: scientific notation with the shortest
 *     round-trip digits — one digit, optional "." + remaining digits
 *     (no trailing zeros), then "e", then a signed exponent with an
 *     explicit sign and no leading zeros.
 *   - Non-finite (NaN, Infinity): REJECTED with a structured error —
 *     JSON cannot represent them, so silently hashing them as `null`
 *     (what JSON.stringify does) would certify a value that was never
 *     there.
 *
 * Classification subtlety the vectors pin down: 1.7976931348623157e308
 * (Number.MAX_VALUE) is mathematically an integer, but its shortest
 * round-trip decimal ("1.7976931348623157e+308") carries fractional
 * mantissa digits, so it takes the SCIENTIFIC branch, not the exact
 * integer branch: "1.7976931348623157e+308". The rule is: an
 * integer-valued number takes the exact-integer branch ONLY when its
 * shortest mantissa has no fractional digits; otherwise it takes the
 * scientific branch. The Python side implements the same rule from
 * repr() (shortest round-trip digits there too).
 *
 * Shortest digits come from JS String(x) / Python repr(x), which both
 * give the shortest decimal that round-trips to the same double.
 */
export function canonicalNumber(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(
      `CANONICAL_NUMBER_REJECTED: non-finite numbers (NaN, Infinity, -Infinity) cannot be canonically hashed — JSON cannot represent them. Got: ${String(value)}.`
    );
  }
  if (Object.is(value, -0)) return "0";

  const { negative, digits, exponent, hasFraction } = shortestDecimal(value);

  if (Number.isInteger(value) && !hasFraction) {
    // Exact integer decimal string, no decimal point, no exponent.
    // BigInt handles integer-valued doubles beyond the safe range
    // exactly (e.g. 1e21 -> "1000000000000000000000").
    return Number.isSafeInteger(value) ? String(value) : BigInt(value).toString();
  }

  const mantissa = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
  return `${negative ? "-" : ""}${mantissa}e${exponent >= 0 ? "+" : "-"}${Math.abs(exponent)}`;
}

/**
 * Parse the shortest round-trip decimal of a finite, non-(-0) number
 * into its significant digits and the decimal exponent of the first
 * digit, i.e. value = digits × 10^(exponent - digits.length + 1)
 * with the first digit before the point. Also reports whether the
 * shortest mantissa carried fractional digits.
 */
function shortestDecimal(value: number): {
  readonly negative: boolean;
  readonly digits: string;
  readonly exponent: number;
  readonly hasFraction: boolean;
} {
  let s = String(value);
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  let exp = 0;
  const eIdx = s.indexOf("e");
  if (eIdx !== -1) {
    exp = parseInt(s.slice(eIdx + 1), 10);
    s = s.slice(0, eIdx);
  }
  // s is now a plain decimal like "1.5", "123456.789", "0.000001", "100".
  const dot = s.indexOf(".");
  let hasFraction = false;
  if (dot !== -1) {
    hasFraction = s.slice(dot + 1).replace(/0+$/, "").length > 0;
  }
  let digits = dot === -1 ? s : s.slice(0, dot) + s.slice(dot + 1);
  let pointPos = dot === -1 ? s.length : dot;
  let lead = 0;
  while (lead < digits.length && digits[lead] === "0") lead++;
  digits = digits.slice(lead);
  pointPos -= lead;
  digits = digits.replace(/0+$/, "");
  if (digits.length === 0) {
    // Only reachable for value 0, which canonicalNumber handles
    // earlier; kept as a guard so the scientific branch never emits
    // an empty mantissa.
    digits = "0";
  }
  return { negative, digits, exponent: pointPos - 1 + exp, hasFraction };
}

export function stableStringify(value: unknown): string {
  // Numbers go through the shared canonical representation (finding G):
  // plain JSON.stringify would emit "0.000001" in one language and
  // "1e-6" in another, and would silently turn NaN into null.
  if (typeof value === "number") {
    return canonicalNumber(value);
  }
  if (value === null || typeof value !== "object") {
    // Strings: standard JSON escaping — only `"`, `\`, and control
    // chars U+0000–U+001F are escaped; all other Unicode (café, →)
    // stays unescaped as UTF-8. That is exactly JSON.stringify.
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
