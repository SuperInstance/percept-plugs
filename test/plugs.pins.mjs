// test/plugs.pins.mjs — percept-plugs pins.
// HEWN where executed under node --test here; SHAPED where the platform
// itself (Excel, Google, LibreOffice, VS Code) must run it. We pin what we
// can execute, and we SAY which is which.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SHAPEOF, PERCEPTS, ETA, DRIFTALARM } from "../excel/functions.js";
import { analyzeSeries, deltaRows } from "../vscode/view-model.js";
import { PerceptStream } from "../streaming/percept-stream.mjs";
import { receipt, witness, audit, genesisTip, canonOf } from "../sheets/witness-core.mjs";

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
  assert.equal(a, "7294de6a3b087bca6e6f932faac455250512f454d645c2dd3dde3d9ef81346e9"); // v0.3 bundle (core + witness layer, 19567 bytes)
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

test("P9 C++ port: golden vectors byte-identical to JS/Python", () => {
  const cli = "/tmp/percept-cli";
  if (!existsSync(cli)) execFileSync("g++", ["-std=c++17", "-O2", "-o", cli, join(root, "cpp/cli.cpp")]);
  const run = (inp) => execFileSync(cli, { input: inp, encoding: "utf8" }).trim().split("\n");
  const [g1, g2] = run("S 6 5 5 5 9 9 2\nS 5 100 102 108 108 96\n");
  assert.equal(g1, "00+0- e2042a187102c385 | -1,-1,-1,9,9,9");
  assert.equal(g2, "++0- 0835f207b4ee59e2 | -1,4,5,5,6");
  const [e1] = run("S 4 0 5 10 15\nE 40 1 3 4\n").slice(1); // line 2 is the E result
  assert.equal(e1, "25 1"); // ETA 25 ticks; alarm at 1 — delta vs a ZERO surround
  // trips any ratio (division by zero = infinite drift), pinned on purpose.
  const [e2] = run("S 4 100 101 102 200\nE 300 1 3 4\n").slice(1);
  assert.equal(e2, "100 3"); // ETA 100; alarm at index 3
});

test("P10 streaming style: push-at-a-time equals batch, event by event", () => {
  const xs = [5, 5, 5, 9, 9, 2];
  const s = new PerceptStream({ w: 4 });
  const pushed = xs.map((x) => s.push(x).level);
  assert.deepEqual(pushed, [-1, -1, -1, 9, 9, 9]); // == PERCEPTS batch pin
  assert.equal(s.shape, "00+0-");
  assert.deepEqual(s.changePoints, [2, 3, 4]);
  const s2 = new PerceptStream({ w: 4 });
  for (const x of [100, 102, 108, 108, 96]) s2.push(x);
  assert.deepEqual(s2.series, [100, 102, 108, 108, 96]);
  assert.equal(s2.shape, "++0-");
});

test("P11 differential fuzz: 2000 seeded adversarial series, JS == Python == C++", { timeout: 180000 }, () => {
  execFileSync(process.execPath, [join(root, "test/differential.mjs")], { stdio: "pipe" });
});

// ---- witness sheet (CONCEPTS C1): the four canon-chain defect classes, pinned at the sheet layer ----
const SHEET = "pulse-2026-09-30", NONCE = "night-wheel";
const chain = (inputs) => inputs.map((inp, i) =>
  receipt(inp.args, inp.result, i, i === 0 ? null : chain.tips[i - 1], SHEET, NONCE));

test("P12 witness sheet: honest chain verifies; reorder / truncate / silent-edit all break", () => {
  const inputs = [
    { args: [5, 5, 5, 9, 9, 2], result: "00+0- e2042a187102c385" },
    { args: [10, 15, 20, 25], result: "+++ 0835f207b4ee59e2" },
    { args: [7, 7, 7], result: "0 cbf29ce484222325" },
  ];
  // honest chain
  let tips = [];
  const rows = inputs.map((inp, i) => {
    const r = receipt(inp.args, inp.result, i, i === 0 ? null : tips[i - 1], SHEET, NONCE);
    tips.push(r.tip);
    return r;
  });
  assert.equal(witness(tips, 3).ok, true);
  // genesis binds sheet name + nonce (D-1: a different sheet can't graft our chain)
  assert.notEqual(rows[0].prevTip, genesisTip("other-sheet", NONCE));
  assert.notEqual(rows[0].prevTip, genesisTip(SHEET, "other-nonce"));
  // D-4 truncation: declared 3, actual 2
  assert.equal(witness(tips.slice(0, 2), 3).ok, false);
  // D-3 reorder: swapped rows change every downstream tip -> recompute mismatch
  const swapped = audit([inputs[1], inputs[0], inputs[2]], SHEET, NONCE);
  assert.notEqual(swapped[1], tips[1]);
  assert.notEqual(swapped[2], tips[2]);
  // D-2 silent edit: one historical result altered, audit tips diverge exactly there
  const edited = audit([inputs[0], { args: inputs[1].args, result: "forged" }, inputs[2]], SHEET, NONCE);
  assert.equal(edited[0], tips[0]);
  assert.notEqual(edited[1], tips[1]);
  assert.notEqual(edited[2], tips[2]);
  // D-6 canonical edges survive the port: -0 != 0, >2^53 throws
  assert.notEqual(canonOf(-0), canonOf(0));
  assert.throws(() => canonOf(2 ** 53 + 1), /int53-overflow/);
  // the seq field is the caller's accountability: receipts carry it, witness checks length
  assert.equal(rows[2].seq, 2);
  assert.match(rows[0].text, /^0 \| [0-9a-f]{16} \| [0-9a-f]{16} \| [0-9a-f]{16} \| [0-9a-f]{16}$/);
});
