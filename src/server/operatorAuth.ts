import { timingSafeEqual } from "node:crypto";
export function isOperatorAuthorized(authorizationHeader: string | undefined, expectedToken: string | undefined): boolean {
  if (!expectedToken || Buffer.byteLength(expectedToken, "utf8") < 32) return false;
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const suppliedBytes = Buffer.from(authorizationHeader.slice(7), "utf8");
  const expectedBytes = Buffer.from(expectedToken, "utf8");
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
