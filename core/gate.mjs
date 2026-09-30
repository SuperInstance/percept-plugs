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
import { createHash } from "node:crypto";

// integer-exact floor log2 for positive uint32 — clz32, no floats.
export const floorLog2 = (n) => (n <= 0 ? null : 31 - Math.clz32(n));

// causal surround: the membrane's recent state, NOT including the tap.
// a tap with no membrane at rest has no percept (null) — the first sample
// establishes rest.
export function surround(series, i, w = 4) {
  if (i === 0) return null;
  const win = series.slice(Math.max(0, i - w), i).sort((a, b) => a - b);
  return win[win.length >> 1];
}

// Weber-gate percept: |delta|/surround, scaled, then log2-binned.
// multiplicative by construction: double the surround, lose one JND bin.
export function percept(series, i, w = 4, scale = 1024) {
  const s = surround(series, i, w);
  if (s === null) return { level: null, signed: 0 };
  const d = series[i] - s;
  if (d === 0) return { level: null, signed: 0 };
  const mag = ((Math.abs(d) * scale) / s) | 0; // integer ratio
  if (mag === 0) return { level: 0, signed: Math.sign(d) }; // felt, below one bin
  return { level: floorLog2(mag), signed: Math.sign(d) };
}

// the discrete perception stream: events, not values.
export const perceive = (series, w = 4, scale = 1024) =>
  series.map((_, i) => ({ i, ...percept(series, i, w, scale) }));

// the tuning fork: quantize against an ABSOLUTE canon instead of the
// moving surround. The band hears nothing (level 0); the canon hears every
// drift. fleet lesson: prev_hash=0 everywhere = a band with no fork.
export function perceptAgainst(series, canon, scale = 1024) {
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
export const perceptHash = (stream) =>
  createHash("sha256")
    .update(stream.map((p) => `${p.level ?? "x"}${p.signed < 0 ? "-" : p.signed > 0 ? "+" : ""}`).join(","), "utf8")
    .digest("hex").slice(0, 16);
