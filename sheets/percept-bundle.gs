// AUTO-GENERATED percept-bundle.gs — do not edit by hand.
// Core vendored from SuperInstance/delta-shape@e2ad00d5ed39a66c344835504fe22563e1bd8fc1
// Build: node tools/build-bundle.mjs

// ==== core/shape.mjs ====
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

const H = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

// integer deltas (no floats anywhere in the shape layer)
const diffs = (xs) => xs.slice(1).map((v, i) => v - xs[i]);
const slopeClass = (d) => (d > 0 ? "+" : d < 0 ? "-" : "0");
const shapeOf = (xs) => diffs(xs).map(slopeClass).join("");

// indices i (into the delta string) where the class changes — the
// change-points of the series. A drift detector is a change-point alarm.
function changePoints(xs) {
  const s = shapeOf(xs);
  const out = [];
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) out.push(i);
  return out;
}

// first index where the series crosses an INTEGER threshold (cross-multiplied
// style — no float comparisons); null if never.
function firstCrossing(xs, k) {
  for (let i = 0; i < xs.length; i++) if (xs[i] >= k) return i;
  return null;
}

// terminal flat run: how many steps the series has been frozen at its final
// value. "flat for the 4th consecutive round" = flatTail(xs) >= 4.
function flatTail(xs) {
  if (xs.length < 2) return xs.length;
  const last = xs[xs.length - 1];
  let n = 0;
  for (let i = xs.length - 1; i >= 0 && xs[i] === last; i--) n++;
  return n;
}

// extinction: terminal zero run of length >= k. "one lane from extinction"
// becomes zeroTail(wounds, 1) == 1 and the prediction is zeroTail >= 3.
function zeroTail(xs) {
  let n = 0;
  for (let i = xs.length - 1; i >= 0 && xs[i] === 0; i--) n++;
  return n;
}
const extinct = (xs, k = 3) => zeroTail(xs) >= k;

// THE claim: the shape hash. Translation-invariant by construction (deltas
// kill constants); sign-preserving under any strictly-monotone transform.
const shapeHash = (xs) => H(`${shapeOf(xs)}|${JSON.stringify(changePoints(xs))}`);

// ==== core/gate.mjs ====
// src/gate.mjs — dynamic-gate perception: the surround sets the gate.
// The captain: "...the gates are dynamic... discrete perception changes that
// aren't absolute values... lighting and what other colors are around make
// more or less contrast... often relative. like a band without a tuning fork
// tuning to where the voice is comfortable and being fine until an instrument
// that can't change tuning joins."
//
// Stereopsis and interaural delay both compute depth from NOTHING but deltas
// between channels; the retina's surround antagonism is literally
// difference-from-recent-context; Weber-Fechner says the JND is a RATIO, not
// an absolute step. This module is those mechanisms with the floats removed:
// integer-exact log2 binning of delta-over-surround.

// integer-exact floor log2 for positive uint32 — clz32, no floats.
const floorLog2 = (n) => (n <= 0 ? null : 31 - Math.clz32(n));

// causal surround: the membrane's recent state, NOT including the tap.
// a tap with no membrane at rest has no percept (null) — the first sample
// establishes rest.
function surround(series, i, w = 4) {
  if (i === 0) return null;
  const win = series.slice(Math.max(0, i - w), i).sort((a, b) => a - b);
  return win[win.length >> 1];
}

// Weber-gate percept: |delta|/surround, scaled, then log2-binned.
// multiplicative by construction: double the surround, lose one JND bin.
function percept(series, i, w = 4, scale = 1024) {
  const s = surround(series, i, w);
  if (s === null) return { level: null, signed: 0 };
  const d = series[i] - s;
  if (d === 0) return { level: null, signed: 0 };
  const mag = ((Math.abs(d) * scale) / s) | 0; // integer ratio
  if (mag === 0) return { level: 0, signed: Math.sign(d) }; // felt, below one bin
  return { level: floorLog2(mag), signed: Math.sign(d) };
}

// the discrete perception stream: events, not values.
const perceive = (series, w = 4, scale = 1024) =>
  series.map((_, i) => ({ i, ...percept(series, i, w, scale) }));

// the tuning fork: quantize against an ABSOLUTE canon instead of the
// moving surround. The band hears nothing (level 0); the canon hears every
// drift. fleet lesson: prev_hash=0 everywhere = a band with no fork.
function perceptAgainst(series, canon, scale = 1024) {
  return series.map((x, i) => {
    if (canon <= 0) return { i, level: null, signed: 0 };
    const d = x - canon;
    if (d === 0) return { i, level: null, signed: 0 };
    const mag = ((Math.abs(d) * scale) / canon) | 0;
    if (mag === 0) return { i, level: 0, signed: Math.sign(d) };
    return { i, level: floorLog2(mag), signed: Math.sign(d) };
  });
}

// content-address a perception stream — two membranes that feel the same
// world the same way share a percept hash even if their raw scales differ.
const perceptHash = (stream) =>
  createHash("sha256")
    .update(stream.map((p) => `${p.level ?? "x"}${p.signed < 0 ? "-" : p.signed > 0 ? "+" : ""}`).join(","), "utf8")
    .digest("hex").slice(0, 16);

// ==== core/time.mjs ====
// src/time.mjs — time-first measurement: distance is counted in whole ticks.
// The captain: flash-to-thunder ranging; 5 sec/mile is rough, but the RATIOS
// are exact — half the seconds, half the distance; a boat's 5-minute predictor
// line is "where I was 5 minutes ago, that length behind me"; cruising speed
// is RPM (discrete rotations in time), not speed-over-ground; people care how
// far in TIME you are. "Time breaks the analog problem": a distance question
// fractures into the coastline paradox, but set your caliper-divider to the
// length you go in one tick and COUNT IN WHOLE NUMBERS.

// ranging: light arrives ~instantly, sound takes `delayTicks`. Calibration
// `ticksPerUnit` is a RECEIPTED CONSTANT — re-calibrate freely: every ratio
// below is exact under ANY calibration; only the label on the unit drifts.
const range = (delayTicks, ticksPerUnit) => {
  if (delayTicks < 0 || ticksPerUnit <= 0) return null;
  const exact = delayTicks % ticksPerUnit === 0;
  return { units: Math.floor(delayTicks / ticksPerUnit), remainderTicks: delayTicks % ticksPerUnit, exact };
};

// ratio exactness, cross-multiplied (no floats): the half/twice claims hold
// under any calibration whatsoever.
const ratioExact = (aTicks, bTicks) => ({
  half: 2 * aTicks === bTicks || aTicks === 2 * bTicks,
  double: aTicks * 2 === bTicks || bTicks * 2 === aTicks,
});

// the boat's predictor line: where-was-I-`lookback`-ticks-ago. This is the
// causal surround at window 1 — the degenerate gate. Your instrument and the
// perceptual membrane are the same object.
const trail = (series, t, lookback) => (t < lookback ? null : series[t - lookback]);
const predictorIsDegenerateGate = (series, t) =>
  trail(series, t, 1) === surround(series, t, 1);

// ETA is the native distance unit: whole ticks, rounded UP (the 5th tick is
// not optional — you arrive at the next tick boundary or you have not arrived).
const eta = (spaceUnits, unitsPerTick) =>
  unitsPerTick <= 0 ? null : Math.ceil(spaceUnits / unitsPerTick);

// no replays: sealing the SAME content twice produces different receipt_ids,
// because the parent moved. a repeated message is structurally a SUCCESSOR
// message about its predecessor — in the interval between them, something
// could have changed. (subleq-fabric's run(N) as an absolute cap is the same
// law for machines: a resumed run may not coast on the old budget.)
const stable = (o) => JSON.stringify(o, Object.keys(o).sort());
class TimeLedger {
  constructor() { this.receipts = []; }
  seal(content) {
    const parent = this.receipts.length ? this.receipts[this.receipts.length - 1].receipt_id : "GENESIS";
    const rid = createHash("sha256").update(stable({ op: "MSG", content, parent }), "utf8").digest("hex").slice(0, 16);
    const rec = { receipt_id: rid, parent, op: "MSG", content };
    this.receipts.push(rec); return rec;
  }
}

// ==== core/learn.mjs ====
// src/learn.mjs — training ON the perceptual layer: the captain: "see if you
// can train your own intelligence for tasks on them."
//
// Two classical learners, both integer-exact and deterministic:
//   Perceptron — multiclass, mistake-driven, integer weights/features; the
//     Novikoff margin world (separable => finite mistakes, no floats needed).
//   NGram — next-event prediction by counting with Laplace smoothing.
// Both consume ONLY percept streams (gate.mjs events): the intelligence sits
// one derivative down from raw values, exactly where the captain put depth.


// seeded LCG generators — integer series with distinct delta-shapes.
function genSeries(kind, seed, n) {
  let s = seed >>> 0;
  const rnd = (k) => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0, s % k);
  const out = [];
  let x = 100;
  for (let i = 0; i < n; i++) {
    out.push(x);
    switch (kind) {
      case "drift": x += 1 + rnd(2); break;              // slow quiet rise
      case "osc": x += (i % 2 === 0 ? 1 : -1) * (2 + rnd(3)); break; // alternation
      case "step": if (i === n >> 1) x += 40; break;     // one loud jump
      case "chirp": x += (i >> 3) + 1; break;            // accelerating steps
      case "noise": x += rnd(9) - 4; break;              // directionless jitter
    }
  }
  return out;
}

// integer feature vector over a percept stream:
// [nulls, level0..level6, plus, minus] — length 10, all counts.
function features(series, w = 3, bins = 7) {
  const f = new Array(bins + 3).fill(0);
  let plus = 0, minus = 0;
  for (const p of perceive(series, w)) {
    if (p.level === null) { f[0]++; continue; }
    f[1 + Math.min(p.level, bins - 1)]++;
    if (p.signed > 0) plus++; else if (p.signed < 0) minus++;
  }
  f[bins + 1] = plus; f[bins + 2] = minus;
  return f;
}

class Perceptron {
  constructor(classes, dim) {
    this.classes = classes;
    this.W = Object.fromEntries(classes.map((c) => [c, new Array(dim).fill(0)]));
  }
  dot(w, f) { let d = 0; for (let i = 0; i < f.length; i++) d += w[i] * f[i]; return d; }
  predict(f) { // argmax dot; ties -> earliest class: fully deterministic
    let best = this.classes[0], bs = -Infinity;
    for (const c of this.classes) { const d = this.dot(this.W[c], f); if (d > bs) { bs = d; best = c; } }
    return best;
  }
  update(f, truth) {
    const g = this.predict(f);
    if (g !== truth) {
      const wt = this.W[truth], wg = this.W[g];
      for (let i = 0; i < f.length; i++) { wt[i] += f[i]; wg[i] -= f[i]; }
    }
    return g;
  }
}

function trainPerceptron(episodes, epochs, classes) {
  const dim = episodes[0].f.length;
  const P = new Perceptron(classes, dim);
  const curve = [];
  for (let e = 0; e < epochs; e++) {
    let mistakes = 0;
    for (const ep of episodes) if (P.update(ep.f, ep.kind) !== ep.kind) mistakes++;
    curve.push(mistakes);
  }
  return { P, curve };
}

// next-event predictor: order-n Markov over percept events, Laplace-smoothed.
class NGram {
  constructor(order, alphabet) { this.order = order; this.alphabet = alphabet; this.counts = new Map(); }
  key(ctx) { return ctx.join("|"); }
  observe(ctx, e) {
    const k = this.key(ctx);
    if (!this.counts.has(k)) this.counts.set(k, new Map());
    const m = this.counts.get(k);
    m.set(e, (m.get(e) ?? 0) + 1);
  }
  predict(ctx) { // Laplace: +1 for every alphabet symbol; ties -> first symbol
    const m = this.counts.get(this.key(ctx)) ?? new Map();
    let best = this.alphabet[0], bs = -Infinity;
    for (const a of this.alphabet) { const sc = (m.get(a) ?? 0) + 1; if (sc > bs) { bs = sc; best = a; } }
    return best;
  }
}

// percept events as a string alphabet: "x" null, "0+".."6+" level+sign, "0-"...
const eventChar = (p) =>
  p.level === null ? "x" : `${Math.min(p.level, 7)}${p.signed < 0 ? "-" : p.signed > 0 ? "+" : "0"}`;

function streamEvents(series, w = 3) {
  return perceive(series, w).map(eventChar);
}

// ==== sheets/appscript.js ====
// sheets/appscript.js — Google Sheets adapter, appended AFTER the bundled core
// by tools/build-bundle.mjs (Apps Script V8 has no ES-module imports).
// HEWN: the bundle is executed under node --test with golden vectors.
// SHAPED: in-Google behavior (menu render, cell spill) needs a Sheet.

function col_(range) {
  return (Array.isArray(range) ? range : [[range]]).flat().map(Number);
}

/** =SHAPEOF(A1:A60) — shape hash, value-independent. */
function SHAPEOF(series) {
  const xs = col_(series);
  const cps = changePoints(xs);
  let h = 0xcbf29ce484222325n;
  for (const c of cps) { h ^= BigInt(c + 1); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return `${shapeOf(xs)} ${h.toString(16).padStart(16, "0")}`;
}

/** =PERCEPTS(A1:A60, 4) — event levels, nulls as -1. */
function PERCEPTS(series, w) {
  return perceive(col_(series), w === undefined ? 4 : Number(w))
    .map((p) => [p.level === null ? -1 : p.level]);
}

/** =ETA(A1:A60, 40, 1) — whole ticks to cover target - last, rounded up. */
function ETA(series, targetValue, unitsPerTick) {
  const xs = col_(series);
  const remaining = Math.max(0, Number(targetValue) - xs[xs.length - 1]);
  return eta(remaining, Number(unitsPerTick));
}

/** =DRIFTALARM(A1:A60, 3, 4) — first i with |delta| > prev*3/4 (cross-multiplied, integer-exact), or -1. */
function DRIFTALARM(series, thresholdNumerator, thresholdDenominator) {
  const xs = col_(series);
  const num = BigInt(thresholdNumerator), den = BigInt(thresholdDenominator);
  for (let i = 1; i < xs.length; i++) {
    if (BigInt(Math.abs(xs[i] - xs[i - 1])) * den > BigInt(Math.abs(xs[i - 1])) * num) return i;
  }
  return -1;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Percept")
    .addItem("Open panel", "showPerceptSidebar_")
    .addToUi();
}

function showPerceptSidebar_() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile("sidebar")
      .setTitle("Percept instruments")
      .setWidth(320)
  );
}
