// learn/ekn.mjs — EKN: e-calibrated kNN over SHAPE space (the anomaly column, honest).
//
// Motivation (fleet evidence, 2026-09-30 org pulse): realm-ml's JEV primitive-ratio
// gate measured AUC 0.510 = a coin flip, while realm-evolve's *agents* hold 0.825.
// Learned scores without calibration are canon-shaped but worthless at the bar.
// EKN closes that gap with exchangeability-calibrated e-values over the
// value-independent shape embedding — so a +1000 translation cannot move the score.
//
// Method family (prior art, cited in CONCEPTS.md / README):
//   kNN-CAD (Ishimtsev & Burnaev 2017, top-3 Numenta 2016) — conformal kNN anomaly;
//   Vovk et al. — exchangeability, conformal martingales, Ville thresholds;
//   rank e-value: e = (R+1) / (1 + #{null nonconformity >= observed}) — exact rational.
// Novelty claimed (modest, pinned): the nonconformity score is the delta-shape
// embedding (sign pattern + change-point set + Weber levels) instead of raw-value
// distance — translation-proof BY CONSTRUCTION, integer-exact throughout.
//
// Honest scope: one-shot e-values under exchangeability are PINNED (P13).
// Sequential martingale composition (power martingale over a stream of these
// e-values, Ville anytime bound) is SHAPED — the EP-2 lesson: never claim a
// composition you haven't pinned.

import { shapeOf, changePoints, diffs } from "../core/shape.mjs";
import { perceive } from "../core/gate.mjs";

// ---- the shape embedding (integer-only features of the pinned core) ----
// runs = run-length encoding of the sign string: one char per MAXIMAL run.
// Jittery series alternate signs every step (many runs); a regime change has
// few long runs. Scoring on runs separates REGIME from TEXTURE — the first
// EKN draft scored raw signs and let jitter nulls drown the planted step
// (P13 fail-first caught exactly this).
export function shapeEmbed(xs, w = 4) {
  const shape = shapeOf(xs);
  const runs = [];
  for (const ch of shape) { if (runs.length && runs[runs.length - 1].s === ch) runs[runs.length - 1].n++; else runs.push({ s: ch, n: 1 }); }
  return {
    shape,                                           // "+0-" sign pattern (fine)
    runs: runs.map((r) => r.s),                      // sign per maximal run (texture-free)
    runLens: runs.map((r) => r.n),                    // run lengths (regime persistence)
    cps: changePoints(xs),                           // change-point positions
    percepts: perceive(xs, w).map((p) => p.level === null ? -1 : p.level),
  };
}

// ---- integer nonconformity distance between two embeddings ----
// Additive integer terms, all pinned, all TRANSLATION-INVARIANT (diff-based):
//   run signs:       index-aligned Hamming over the RLE sign sequence, w=10
//   run count:       25 per unit of run-count difference (texture penalty)
//   run length L1:   index-aligned |len diff| summed, w=1 (persistence drift)
//   change points:   greedy nearest-match L1 over positions, w=3
// The embedding's percept levels are deliberately EXCLUDED here: perceive()
// measures against the raw local surround (Weber law — magnitude-relative by
// design), so levels move under a +1000 translation. Shape, runs, cps are
// diff-based and invariant. (P13 value-independence pin proves the boundary.)
export function shapeDist(a, b) {
  let d = 0;
  const rn = Math.max(a.runs.length, b.runs.length);
  for (let i = 0; i < rn; i++) {
    const ca = a.runs[i], cb = b.runs[i];
    if (ca === undefined || cb === undefined) d += 5;
    else if (ca !== cb) d += 10;
  }
  d += 25 * Math.abs(a.runs.length - b.runs.length);
  const ln = Math.max(a.runLens.length, b.runLens.length);
  for (let i = 0; i < ln; i++) {
    const x = a.runLens[i], y = b.runLens[i];
    if (x === undefined || y === undefined) d += 4;
    else d += Math.abs(x - y);
  }
  const used = new Set();
  for (const p of a.cps) {
    let best = null, bi = -1;
    b.cps.forEach((q, j) => {
      if (used.has(j)) return;
      const c = Math.abs(p - q);
      if (best === null || c < best) { best = c; bi = j; }
    });
    if (bi >= 0) { used.add(bi); d += 3 * best; } else d += 15; // unmatched cp
  }
  // note: directed distance — b's surplus cps beyond a's count are not penalized;
  // knnScore uses it consistently in one direction (query embedding as `a`).
  return d;
}

// ---- kNN nonconformity of a series against a training corpus ----
export function knnScore(xs, train, k = 3, w = 4) {
  const e = shapeEmbed(xs, w);
  const ds = train.map((t) => shapeDist(e, shapeEmbed(t, w))).sort((x, y) => x - y);
  const kk = Math.min(k, ds.length);
  let s = 0;
  for (let i = 0; i < kk; i++) s += ds[i];
  return s;                                          // integer: sum of k smallest distances
}

// ---- the rank e-value (exact rational, returned as {num, den} + decimal-free form) ----
// e = (R+1) / (1 + #{i in nulls: knnScore(null_i) >= knnScore(query)})
// Under exchangeability this is a valid e-value: E[e] <= 1 under the null.
export function eknE(xs, train, nulls, { k = 3, w = 4 } = {}) {
  const q = knnScore(xs, train, k, w);
  let ge = 0;
  for (const n of nulls) if (knnScore(n, train, k, w) >= q) ge++;
  return { eNum: nulls.length + 1, eDen: ge + 1, query: q, ge,
           e: (nulls.length + 1) / (ge + 1), crosses20: (nulls.length + 1) >= 20 * (ge + 1) };
}

// ---- seeded null-corpus generator (same LCG family as test/differential.mjs) ----
export function nullGen(seed, count, len = 24) {
  let x = seed >>> 0;
  const next = () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x; };
  const out = [];
  for (let i = 0; i < count; i++) {
    const xs = [];
    let v = (next() % 101) - 50;
    for (let j = 0; j < len; j++) {
      xs.push(v);
      v += (next() % 5) - 2;                       // wander ±2 — the null regime
    }
    out.push(xs);
  }
  return out;
}

export { diffs };
