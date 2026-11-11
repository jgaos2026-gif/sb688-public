import { test } from "node:test";
import assert from "node:assert/strict";
import { readServerRuntimeConfig } from "../src/server/config";
test("production refuses to start without a strong operator token", () => {
  assert.throws(() => readServerRuntimeConfig({ SB689_ENV: "production" }), /OPERATOR_AUTH_NOT_CONFIGURED/);
});
test("production requires operator auth with a strong token", () => {
  const token = "test-only-operator-secret-with-more-than-32-bytes";
  const config = readServerRuntimeConfig({ SB689_ENV: "production", SB689_OPERATOR_TOKEN: token });
  assert.equal(config.requireOperatorAuth, true);
  assert.equal(config.operatorToken, token);
});
test("development remains local and may run without an operator token", () => {
  const config = readServerRuntimeConfig({});
  assert.equal(config.requireOperatorAuth, false);
  assert.equal(config.host, "127.0.0.1");
});
