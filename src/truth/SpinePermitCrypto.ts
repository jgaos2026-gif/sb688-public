/**
 * Spine permit signatures — REAL Ed25519 verification (finding 02).
 *
 * The old check (`spineSignature.startsWith("sha256:")`) was forgeable by
 * anyone who could type "sha256:" — a hash prefix is not a signature.
 * A permit is now trusted only when ALL of these hold:
 *
 *   1. it carries an Ed25519 signature over the CANONICAL permit contents
 *      (intentId, constraints, issuer, issuedAt, expiresAt, nonce);
 *   2. the signature verifies against a TRUSTED public key held by the
 *      verifier (never against a key supplied inside the permit itself);
 *   3. the permit has not expired (and is not from the future);
 *   4. the signature has not been seen before by this verifier (replay).
 *
 * No stored-hash comparison is ever presented as a signature: `verify`
 * here is `crypto.verify` over the canonical payload, nothing else.
 *
 * KEY PROVISIONING (operator step — keys are NEVER committed):
 *   - Single process (default): SpineGovernor generates an ephemeral
 *     Ed25519 pair per process and the runtime hands its public key to
 *     the mesh. Permits verify within the process; they do not survive
 *     a restart and cannot be verified by another process.
 *   - Durable / multi-process: the operator supplies a long-lived pair:
 *       SB688_SPINE_PRIVATE_KEY       PEM private key, or
 *       SB688_SPINE_PRIVATE_KEY_FILE  path to a PEM private key file, and
 *       SB688_SPINE_PUBLIC_KEY        PEM public key, or
 *       SB688_SPINE_PUBLIC_KEY_FILE   path to a PEM public key file.
 *     Pass them via `loadSpineKeysFromEnv()` into `new SpineGovernor({ signingKey })`
 *     and `new LiquidTruthNodeMesh(undefined, { publicKey })`. The private
 *     key file must be readable only by the operator (chmod 600) and must
 *     never be committed, pasted into chat, or shipped in a repo.
 *
 * Node built-in `node:crypto` only — no new dependencies.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from "node:crypto";
import * as fs from "node:fs";
import { stableStringify } from "../utils/hash";

/** Canonical permit contents that the signature covers. */
export interface SpinePermitPayload {
  readonly intentId: string;
  readonly constraints: readonly string[];
  /** Issuer identifier (key id / operator name). Defaults to "spine". */
  readonly issuer: string;
  /** ISO timestamp the permit was issued. */
  readonly issuedAt: string;
  /** ISO timestamp after which the permit is dead. */
  readonly expiresAt: string;
  /** Per-permit random nonce — makes every signature unique even for the same intent. */
  readonly nonce: string;
}

export interface SpineKeyPair {
  readonly publicKey: KeyObject;
  readonly privateKey: KeyObject;
}

/** Generate a fresh Ed25519 pair (tests, and the ephemeral default). */
export function generateSpineKeyPair(): SpineKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey, privateKey };
}

/** Canonical bytes the signature covers — key order fixed by stableStringify. */
export function canonicalPermitBytes(payload: SpinePermitPayload): Buffer {
  return Buffer.from(stableStringify(payload), "utf-8");
}

/** Sign the canonical permit contents. Returns a base64 signature. */
export function signSpinePermit(payload: SpinePermitPayload, privateKey: KeyObject | string): string {
  const key = typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey;
  return cryptoSign(null, canonicalPermitBytes(payload), key).toString("base64");
}

/**
 * Verify an Ed25519 permit signature against a TRUSTED public key.
 * Returns { ok, reason } — never throws for bad input; a malformed
 * signature, a wrong key, or a payload mismatch all return ok:false.
 */
export function verifySpinePermitSignature(
  payload: SpinePermitPayload,
  signatureBase64: string,
  publicKey: KeyObject | string
): { readonly ok: boolean; readonly reason: string } {
  if (typeof signatureBase64 !== "string" || signatureBase64.length === 0) {
    return { ok: false, reason: "Spine permit carries no signature." };
  }
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureBase64, "base64");
  } catch {
    return { ok: false, reason: "Spine permit signature is not valid base64." };
  }
  if (signature.length === 0) {
    return { ok: false, reason: "Spine permit signature is empty." };
  }
  let key: KeyObject;
  try {
    key = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  } catch {
    return { ok: false, reason: "Trusted spine public key is unusable." };
  }
  let valid: boolean;
  try {
    valid = cryptoVerify(null, canonicalPermitBytes(payload), key, signature);
  } catch {
    return { ok: false, reason: "Spine permit signature failed verification." };
  }
  return valid
    ? { ok: true, reason: "Ed25519 signature verifies against the trusted spine public key." }
    : { ok: false, reason: "Spine permit signature does not verify against the trusted spine public key." };
}

/** Export a public key as PEM (spki) for the operator to distribute. */
export function exportSpinePublicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

/** Export a private key as PEM (pkcs8). Handle like a password — never log it. */
export function exportSpinePrivateKeyPem(privateKey: KeyObject): string {
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

/**
 * Load operator keys from the environment (see module docstring).
 * Returns whichever keys are present; missing keys are simply absent —
 * callers decide what "absent" means (ephemeral pair vs fail closed).
 * Throws only when a supplied key value/file is malformed.
 */
export function loadSpineKeysFromEnv(env: NodeJS.ProcessEnv = process.env): {
  readonly privateKey?: KeyObject;
  readonly publicKey?: KeyObject;
} {
  const out: { privateKey?: KeyObject; publicKey?: KeyObject } = {};
  const privatePem = env.SB688_SPINE_PRIVATE_KEY ??
    (env.SB688_SPINE_PRIVATE_KEY_FILE ? fs.readFileSync(env.SB688_SPINE_PRIVATE_KEY_FILE, "utf-8") : undefined);
  if (privatePem) {
    out.privateKey = createPrivateKey(privatePem);
    // A private key implies its public half; use it when no public key given.
    out.publicKey = createPublicKey(out.privateKey);
  }
  const publicPem = env.SB688_SPINE_PUBLIC_KEY ??
    (env.SB688_SPINE_PUBLIC_KEY_FILE ? fs.readFileSync(env.SB688_SPINE_PUBLIC_KEY_FILE, "utf-8") : undefined);
  if (publicPem) {
    out.publicKey = createPublicKey(publicPem);
  }
  return out;
}
