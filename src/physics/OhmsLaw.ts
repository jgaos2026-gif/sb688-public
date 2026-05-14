/**
 * Ohm's Law utilities.
 *
 * Core relationship: V = I × R
 *   V – voltage  (volts, V)
 *   I – current  (amperes, A)
 *   R – resistance (ohms, Ω)
 *
 * Derived power relationship: P = V × I
 *   P – power (watts, W)
 */

export interface OhmsLawResult {
  voltage: number;
  current: number;
  resistance: number;
  power: number;
}

/**
 * Solve for voltage given current and resistance: V = I × R
 */
export function solveVoltage(current: number, resistance: number): OhmsLawResult {
  if (current < 0 || resistance < 0) {
    throw new RangeError("current and resistance must be non-negative");
  }
  const voltage = current * resistance;
  return { voltage, current, resistance, power: voltage * current };
}

/**
 * Solve for current given voltage and resistance: I = V / R
 */
export function solveCurrent(voltage: number, resistance: number): OhmsLawResult {
  if (voltage < 0 || resistance <= 0) {
    throw new RangeError("voltage must be non-negative and resistance must be positive");
  }
  const current = voltage / resistance;
  return { voltage, current, resistance, power: voltage * current };
}

/**
 * Solve for resistance given voltage and current: R = V / I
 */
export function solveResistance(voltage: number, current: number): OhmsLawResult {
  if (voltage < 0 || current <= 0) {
    throw new RangeError("voltage must be non-negative and current must be positive");
  }
  const resistance = voltage / current;
  return { voltage, current, resistance, power: voltage * current };
}
