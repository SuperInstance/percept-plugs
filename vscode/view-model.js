// vscode/view-model.js — pure analysis used by the extension host.
// Runs the REAL vendored core (Node side); the webview only renders.
// Deterministic: same text in => same view model out (pinned).

import { shapeOf, changePoints } from "../core/shape.mjs";
import { perceive } from "../core/gate.mjs";
import { eta } from "../core/time.mjs";

export function analyzeSeries(text, { target = null, unitsPerTick = 1, w = 4 } = {}) {
  const series = String(text)
    .split(/[\s,;\n\t]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (series.length < 2) return { error: "need at least 2 numeric samples", series };

  const percepts = perceive(series, w);
  const cps = changePoints(series);
  let h = 0xcbf29ce484222325n;
  for (const c of cps) { h ^= BigInt(c + 1); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }

  const last = series[series.length - 1];
  const out = {
    series,
    n: series.length,
    shape: shapeOf(series),
    changePoints: cps,
    changePointsHash: h.toString(16).padStart(16, "0"),
    percepts: percepts.map((p) => ({
      i: p.i,
      level: p.level === null ? -1 : p.level,
      signed: p.signed,
    })),
    last,
  };
  if (target !== null && Number.isFinite(Number(target)) && Number(unitsPerTick) > 0) {
    out.eta = eta(Math.max(0, Number(target) - last), Number(unitsPerTick));
  }
  return out;
}

// delta vs previous percept (JND-bin crossings) for the panel sparkline rows
export function deltaRows(viewModel) {
  if (viewModel.error) return [];
  const rows = [];
  let prevLevel = null;
  for (const p of viewModel.percepts) {
    const lvl = p.level === -1 ? null : p.level;
    rows.push({ i: p.i, level: p.level, rose: prevLevel !== null && lvl !== null && lvl > prevLevel, fell: prevLevel !== null && lvl !== null && lvl < prevLevel });
    prevLevel = lvl;
  }
  return rows;
}
