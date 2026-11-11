import { test } from "node:test";
import assert from "node:assert/strict";
import { isOperatorAuthorized } from "../src/server/operatorAuth";
const secret = "test-only-operator-secret-with-more-than-32-bytes";
test("operator auth accepts exact bearer token", () => assert.equal(isOperatorAuthorized("Bearer " + secret, secret), true));
test("operator auth rejects absent and malformed authorization", () => {
  assert.equal(isOperatorAuthorized(undefined, secret), false);
  assert.equal(isOperatorAuthorized("Basic abc", secret), false);
  assert.equal(isOperatorAuthorized("Bearer", secret), false);
});
test("operator auth rejects wrong token and unequal lengths", () => {
  assert.equal(isOperatorAuthorized("Bearer wrong", secret), false);
  assert.equal(isOperatorAuthorized("Bearer " + secret + "x", secret), false);
});
test("operator auth fails closed when token is missing or weak", () => {
  assert.equal(isOperatorAuthorized("Bearer " + secret, undefined), false);
  assert.equal(isOperatorAuthorized("Bearer short", "short"), false);
});
