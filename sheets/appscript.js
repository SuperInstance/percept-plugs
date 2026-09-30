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
