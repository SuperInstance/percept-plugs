// src/learn.mjs — training ON the perceptual layer: the captain: "see if you
// can train your own intelligence for tasks on them."
//
// Two classical learners, both integer-exact and deterministic:
//   Perceptron — multiclass, mistake-driven, integer weights/features; the
//     Novikoff margin world (separable => finite mistakes, no floats needed).
//   NGram — next-event prediction by counting with Laplace smoothing.
// Both consume ONLY percept streams (gate.mjs events): the intelligence sits
// one derivative down from raw values, exactly where the captain put depth.

import { perceive } from "./gate.mjs";

// seeded LCG generators — integer series with distinct delta-shapes.
export function genSeries(kind, seed, n) {
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
export function features(series, w = 3, bins = 7) {
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

export class Perceptron {
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

export function trainPerceptron(episodes, epochs, classes) {
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
export class NGram {
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
export const eventChar = (p) =>
  p.level === null ? "x" : `${Math.min(p.level, 7)}${p.signed < 0 ? "-" : p.signed > 0 ? "+" : "0"}`;

export function streamEvents(series, w = 3) {
  return perceive(series, w).map(eventChar);
}
