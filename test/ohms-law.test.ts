import { test } from "node:test";
import assert from "node:assert/strict";
import { solveVoltage, solveCurrent, solveResistance } from "../src/physics/OhmsLaw";

test("solveVoltage: V = I × R", () => {
  const result = solveVoltage(2, 10);
  assert.equal(result.voltage, 20);
  assert.equal(result.current, 2);
  assert.equal(result.resistance, 10);
  assert.equal(result.power, 40);
});

test("solveCurrent: I = V / R", () => {
  const result = solveCurrent(12, 4);
  assert.equal(result.current, 3);
  assert.equal(result.voltage, 12);
  assert.equal(result.resistance, 4);
  assert.equal(result.power, 36);
});

test("solveResistance: R = V / I", () => {
  const result = solveResistance(9, 3);
  assert.equal(result.resistance, 3);
  assert.equal(result.voltage, 9);
  assert.equal(result.current, 3);
  assert.equal(result.power, 27);
});

test("solveVoltage: zero current yields zero voltage and zero power", () => {
  const result = solveVoltage(0, 100);
  assert.equal(result.voltage, 0);
  assert.equal(result.power, 0);
});

test("solveCurrent throws on zero resistance", () => {
  assert.throws(() => solveCurrent(5, 0), RangeError);
});

test("solveResistance throws on zero current", () => {
  assert.throws(() => solveResistance(5, 0), RangeError);
});

test("solveVoltage throws on negative values", () => {
  assert.throws(() => solveVoltage(-1, 10), RangeError);
  assert.throws(() => solveVoltage(2, -5), RangeError);
});
