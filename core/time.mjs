// src/time.mjs — time-first measurement: distance is counted in whole ticks.
// The captain: flash-to-thunder ranging; 5 sec/mile is rough, but the RATIOS
// are exact — half the seconds, half the distance; a boat's 5-minute predictor
// line is "where I was 5 minutes ago, that length behind me"; cruising speed
// is RPM (discrete rotations in time), not speed-over-ground; people care how
// far in TIME you are. "Time breaks the analog problem": a distance question
// fractures into the coastline paradox, but set your caliper-divider to the
// length you go in one tick and COUNT IN WHOLE NUMBERS.
import { surround } from "./gate.mjs";

// ranging: light arrives ~instantly, sound takes `delayTicks`. Calibration
// `ticksPerUnit` is a RECEIPTED CONSTANT — re-calibrate freely: every ratio
// below is exact under ANY calibration; only the label on the unit drifts.
export const range = (delayTicks, ticksPerUnit) => {
  if (delayTicks < 0 || ticksPerUnit <= 0) return null;
  const exact = delayTicks % ticksPerUnit === 0;
  return { units: Math.floor(delayTicks / ticksPerUnit), remainderTicks: delayTicks % ticksPerUnit, exact };
};

// ratio exactness, cross-multiplied (no floats): the half/twice claims hold
// under any calibration whatsoever.
export const ratioExact = (aTicks, bTicks) => ({
  half: 2 * aTicks === bTicks || aTicks === 2 * bTicks,
  double: aTicks * 2 === bTicks || bTicks * 2 === aTicks,
});

// the boat's predictor line: where-was-I-`lookback`-ticks-ago. This is the
// causal surround at window 1 — the degenerate gate. Your instrument and the
// perceptual membrane are the same object.
export const trail = (series, t, lookback) => (t < lookback ? null : series[t - lookback]);
export const predictorIsDegenerateGate = (series, t) =>
  trail(series, t, 1) === surround(series, t, 1);

// ETA is the native distance unit: whole ticks, rounded UP (the 5th tick is
// not optional — you arrive at the next tick boundary or you have not arrived).
export const eta = (spaceUnits, unitsPerTick) =>
  unitsPerTick <= 0 ? null : Math.ceil(spaceUnits / unitsPerTick);

// no replays: sealing the SAME content twice produces different receipt_ids,
// because the parent moved. a repeated message is structurally a SUCCESSOR
// message about its predecessor — in the interval between them, something
// could have changed. (subleq-fabric's run(N) as an absolute cap is the same
// law for machines: a resumed run may not coast on the old budget.)
import { createHash } from "node:crypto";
const stable = (o) => JSON.stringify(o, Object.keys(o).sort());
export class TimeLedger {
  constructor() { this.receipts = []; }
  seal(content) {
    const parent = this.receipts.length ? this.receipts[this.receipts.length - 1].receipt_id : "GENESIS";
    const rid = createHash("sha256").update(stable({ op: "MSG", content, parent }), "utf8").digest("hex").slice(0, 16);
    const rec = { receipt_id: rid, parent, op: "MSG", content };
    this.receipts.push(rec); return rec;
  }
}
