// excel/functions.js — Office Add-in custom functions (shared-runtime JS).
// Pure: imports the vendored core only; no I/O, no network, deterministic.
// HEWN here: the functions run under node --test with golden vectors.
// SHAPED: sideloading into Excel desktop/web needs Excel itself (manifest.xml
// provided; not exercised on the build host).

import { shapeOf, changePoints, firstCrossing } from "../core/shape.mjs";
import { perceive } from "../core/gate.mjs";
import { eta } from "../core/time.mjs";

/** @customfunction SHAPEOF Shape-identity hash of a series' delta signs.
 * @param {number[][]} series Vertical range of numbers.
 * @returns {string} "sign-pattern changePointsHash" — value-independent.
 */
export function SHAPEOF(series) {
  const xs = col(series);
  return `${shapeOf(xs)} ${cpHash(changePoints(xs))}`;
}

/** @customfunction PERCEPTS Weber-gated event levels for a series.
 * @param {number[][]} series
 * @param {number} w Weber denominator (default 4: one JND bin per 25% change).
 * @returns {number[][]} Spilled column: nulls as -1, else floor-log2 bin.
 */
export function PERCEPTS(series, w = 4) {
  return perceive(col(series), w).map((p) => [p.level === null ? -1 : p.level]);
}

/** @customfunction ETA Whole-tick estimate to reach a target from the series' last value.
 * @param {number[][]} series
 * @param {number} targetValue Value to cover.
 * @param {number} unitsPerTick Calibration: known units advanced per tick.
 * @returns {number} ceil((target - last) / perTick); 0 if already there.
 */
export function ETA(series, targetValue, unitsPerTick) {
  const xs = col(series);
  const remaining = Math.max(0, Number(targetValue) - xs[xs.length - 1]);
  return eta(remaining, Number(unitsPerTick));
}

/** @customfunction DRIFTALARM First index where |delta| exceeds prev*num/den.
 * Integer-exact via cross-multiplication (no floats). Absence = -1.
 * (The core's firstCrossing is the absolute-threshold form; the ratio form
 * lives here in the adapter, one layer down.)
 * @param {number[][]} series
 * @param {number} thresholdNumerator e.g. 3
 * @param {number} thresholdDenominator e.g. 4 (=> |delta| > prev*3/4)
 * @returns {number} index or -1.
 */
export function DRIFTALARM(series, thresholdNumerator, thresholdDenominator) {
  const xs = col(series);
  const num = BigInt(thresholdNumerator), den = BigInt(thresholdDenominator);
  for (let i = 1; i < xs.length; i++) {
    if (BigInt(Math.abs(xs[i] - xs[i - 1])) * den > BigInt(Math.abs(xs[i - 1])) * num) return i;
  }
  return -1;
}

function col(matrix) { return matrix.flat().map(Number); }
function cpHash(cps) {
  let h = 0xcbf29ce484222325n;
  for (const c of cps) { h ^= BigInt(c + 1); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, "0");
}
