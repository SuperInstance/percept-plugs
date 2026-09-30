// test/plugs.pins.mjs — percept-plugs pins.
// HEWN where executed under node --test here; SHAPED where the platform
// itself (Excel, Google, LibreOffice, VS Code) must run it. We pin what we
// can execute, and we SAY which is which.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SHAPEOF, PERCEPTS, ETA, DRIFTALARM } from "../excel/functions.js";
import { analyzeSeries, deltaRows } from "../vscode/view-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SERIES = [[5], [5], [5], [9], [9], [2]];
const PERCEPT_SERIES = [[100], [102], [108], [108], [96]];
const LONG = [[10],[15],[20],[25],[30],[35],[40],[45],[50],[55],[200],[200],[3]];

test("P1 Excel adapter SHAPEOF: golden shape + change-point hash, value-independent", () => {
  assert.equal(SHAPEOF(SERIES), "00+0- e2042a187102c385");
  assert.equal(SHAPEOF(LONG), "++++++++++0- 08511a07b5056592");
});

test("P2 Excel adapter PERCEPTS: nulls as -1, Weber levels exact", () => {
  assert.deepEqual(PERCEPTS(PERCEPT_SERIES, 4), [[-1], [4], [5], [5], [6]]);
});

test("P3 Excel adapter ETA + DRIFTALARM: ceil ticks; ratio alarm integer-exact", () => {
  assert.equal(ETA([[0], [5], [10], [15]], 40, 1), 25);
  assert.equal(ETA([[39], [40]], 40, 1), 0);
  assert.equal(DRIFTALARM([[100], [101], [102], [200]], 3, 4), 3);
  assert.equal(DRIFTALARM([[100], [101], [102], [103]], 3, 4), -1);
});

test("P4 Sheets bundle is deterministic: rebuild reproduces the pinned hash", () => {
  execFileSync(process.execPath, [join(root, "tools/build-bundle.mjs")]);
  const a = createHash("sha256").update(readFileSync(join(root, "sheets/percept-bundle.gs"))).digest("hex");
  execFileSync(process.execPath, [join(root, "tools/build-bundle.mjs")]);
  const b = createHash("sha256").update(readFileSync(join(root, "sheets/percept-bundle.gs"))).digest("hex");
  assert.equal(a, b);
  assert.equal(a, "c2c0f84bf5d79a770d6c8d2eb6229186d9a707f5290e5a07a79fa5b328fb3ae9");
});

test("P5 Sheets bundle behaves: the four cell functions run inside the bundle sandbox", () => {
  const src = readFileSync(join(root, "sheets/percept-bundle.gs"), "utf8");
  const B = new Function(`${src}; return { SHAPEOF, PERCEPTS, ETA, DRIFTALARM };`)();
  assert.equal(B.SHAPEOF(SERIES), "00+0- e2042a187102c385");
  assert.deepEqual(B.PERCEPTS(PERCEPT_SERIES, 4), [[-1], [4], [5], [5], [6]]);
  assert.equal(B.ETA([[0], [5], [10], [15]], 40, 1), 25);
  assert.equal(B.DRIFTALARM([[100], [101], [102], [200]], 3, 4), 3);
});

test("P6 Python port agrees with JS on every golden vector (cross-language pins)", () => {
  const py = `
import sys, json; sys.path.insert(0, "${join(root, "libreoffice").replace(/\\/g, "/")}")
import percept as P
print(json.dumps({
  "shapeof": P.SHAPEOF([5,5,5,9,9,2]),
  "long": P.SHAPEOF([10,15,20,25,30,35,40,45,50,55,200,200,3]),
  "percepts": P.PERCEPTS([100,102,108,108,96],4),
  "eta": P.ETA([0,5,10,15],40,1),
  "alarm": P.DRIFTALARM([100,101,102,200],3,4),
  "zero_surround": P.percept([0,5],1,4,1024),
  "neg_trunc": P.percept([-100,-102],1,4,1024),
}))`;
  const out = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
  assert.equal(out.shapeof, SHAPEOF(SERIES));
  assert.equal(out.long, SHAPEOF(LONG));
  assert.deepEqual(out.percepts.map((x) => [x]), PERCEPTS(PERCEPT_SERIES, 4));
  assert.equal(out.eta, ETA([[0], [5], [10], [15]], 40, 1));
  assert.equal(out.alarm, DRIFTALARM([[100], [101], [102], [200]], 3, 4));
  assert.deepEqual(out.zero_surround, { level: 0, signed: 1 });
  assert.deepEqual(out.neg_trunc, { level: null, signed: -1 });
});

test("P7 VS Code view-model: analysis golden, ETA only when asked", () => {
  const vm = analyzeSeries("5 5 5 9 9 2", { target: 40, unitsPerTick: 1 });
  assert.equal(vm.shape, "00+0-");
  assert.deepEqual(vm.changePoints, [2, 3, 4]);
  assert.equal(vm.changePointsHash, "e2042a187102c385");
  assert.deepEqual(vm.percepts.map((p) => p.level), [-1, -1, -1, 9, 9, 9]);
  assert.equal(vm.eta, 38); // 40 - 2 remaining, 1/tick
  const bare = analyzeSeries("5 5 5 9 9 2");
  assert.equal(bare.eta, undefined);
});

test("P8 VS Code view-model: rejects garbage honestly; delta rows flag JND crossings", () => {
  const bad = analyzeSeries("abc def");
  assert.match(bad.error, /at least 2/);
  const rows = deltaRows(analyzeSeries("100 102 108 108 96"));
  assert.equal(rows.length, 5);
  assert.equal(rows[1].rose, false);  // emergence from silence is not a rise
  assert.equal(rows[2].rose, true);   // 4 -> 5
  assert.equal(rows[4].rose, true);   // 5 -> 6
  assert.equal(rows[4].fell, false);
});
