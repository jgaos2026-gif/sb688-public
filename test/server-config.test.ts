import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidOperatorAuthorization, readServerRuntimeConfig, requiresOperatorAuthorization } from "../src/server/config";

const token = "sovereign-operator-token-with-more-than-32-characters";

test("development loopback remains available without an operator token", () => {
  const config = readServerRuntimeConfig({});
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.requireOperatorAuth, false);
});

test("production refuses to start without a strong operator token", () => {
  assert.throws(
    () => readServerRuntimeConfig({ SB688_ENV: "production" }),
    /SB688_OPERATOR_TOKEN/
  );
});

test("production and non-loopback bindings require operator authentication", () => {
  const production = readServerRuntimeConfig({
    SB688_ENV: "production",
    SB688_OPERATOR_TOKEN: token
  });
  assert.equal(production.requireOperatorAuth, true);

  const exposedDevelopment = readServerRuntimeConfig({
    SB688_HOST: "0.0.0.0",
    SB688_OPERATOR_TOKEN: token
  });
  assert.equal(exposedDevelopment.requireOperatorAuth, true);
});

test("non-loopback binding without operator token is refused", () => {
  assert.throws(
    () => readServerRuntimeConfig({ SB688_HOST: "0.0.0.0" }),
    /SB688_OPERATOR_TOKEN/
  );
});

test("operator bearer authentication is exact and constant-time compared", () => {
  assert.equal(isValidOperatorAuthorization(`Bearer ${token}`, token), true);
  assert.equal(isValidOperatorAuthorization("Bearer wrong", token), false);
  assert.equal(isValidOperatorAuthorization(undefined, token), false);
  assert.equal(isValidOperatorAuthorization(`Bearer ${token}`, "short"), false);
});


test("public probes and the separately authenticated SB688 service route are scoped correctly", () => {
  assert.equal(requiresOperatorAuthorization("GET", "/api/health", true), false);
  assert.equal(requiresOperatorAuthorization("GET", "/api/ready", true), false);
  assert.equal(requiresOperatorAuthorization("POST", "/api/truth/pre-brain", true), false);
  assert.equal(requiresOperatorAuthorization("POST", "/api/runtime/run", true), true);
  assert.equal(requiresOperatorAuthorization("GET", "/api/ledger", true), true);
  assert.equal(requiresOperatorAuthorization("POST", "/api/agent/configure", false), false);
});
