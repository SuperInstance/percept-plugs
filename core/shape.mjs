// src/shape.mjs — deltas-as-shape: the content-addressed identity of CHANGE.
// The captain, on snowball R64's summary: "Deltas-as-shape is the whole point.
// that's worth exploring more in depth."
//
// R64's conclusions were shape claims made by eye: "d(learning)/d(version)
// flat at the artifact layer for the 4th consecutive round", "d(wounds)/
// d(round) one lane from extinction". This instrument makes such claims
// checkable objects: a series' SHAPE (the sign-pattern of its deltas, the
// positions where the pattern changes) is independent of the values
// themselves — so shape gets its own content hash. [5,5,5] and [9,9,9] are
// different series with the SAME shape ("flat"); [1,2,1,2] and [7,8,7,8] are
// the same shape ("oscillate, period 2"). Same doctrine as the fleet's
// receipts (hash the canonical bytes, the hash IS the identity) applied one
// derivative down.
//
// Fleet precedents this unifies:
//   witness-validation: drift detection (CUSUM/change-point) IS shape change
//   qcells exp021: RATE NOT WALL — a slope read as a rate
//   clicklearn eLearn: the e-path's shape class (growth vs kill) IS the verdict
//   snowball R64: flatness streaks and extinction tails as conclusions
import { createHash } from "node:crypto";

const H = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

// integer deltas (no floats anywhere in the shape layer)
export const diffs = (xs) => xs.slice(1).map((v, i) => v - xs[i]);
export const slopeClass = (d) => (d > 0 ? "+" : d < 0 ? "-" : "0");
export const shapeOf = (xs) => diffs(xs).map(slopeClass).join("");

// indices i (into the delta string) where the class changes — the
// change-points of the series. A drift detector is a change-point alarm.
export function changePoints(xs) {
  const s = shapeOf(xs);
  const out = [];
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) out.push(i);
  return out;
}

// first index where the series crosses an INTEGER threshold (cross-multiplied
// style — no float comparisons); null if never.
export function firstCrossing(xs, k) {
  for (let i = 0; i < xs.length; i++) if (xs[i] >= k) return i;
  return null;
}

// terminal flat run: how many steps the series has been frozen at its final
// value. "flat for the 4th consecutive round" = flatTail(xs) >= 4.
export function flatTail(xs) {
  if (xs.length < 2) return xs.length;
  const last = xs[xs.length - 1];
  let n = 0;
  for (let i = xs.length - 1; i >= 0 && xs[i] === last; i--) n++;
  return n;
}

// extinction: terminal zero run of length >= k. "one lane from extinction"
// becomes zeroTail(wounds, 1) == 1 and the prediction is zeroTail >= 3.
export function zeroTail(xs) {
  let n = 0;
  for (let i = xs.length - 1; i >= 0 && xs[i] === 0; i--) n++;
  return n;
}
export const extinct = (xs, k = 3) => zeroTail(xs) >= k;

// THE claim: the shape hash. Translation-invariant by construction (deltas
// kill constants); sign-preserving under any strictly-monotone transform.
export const shapeHash = (xs) => H(`${shapeOf(xs)}|${JSON.stringify(changePoints(xs))}`);
