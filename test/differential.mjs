// test/differential.mjs — cross-language differential fuzzing.
// One seeded LCG (1664525*x+1013904223 >>> 0, same family as learn.mjs) drives
// 2000 adversarial series (zeros / negatives / plateaus / spikes / drift / steps).
// Every series runs through ALL THREE runtimes — JS core, Python port, C++ port —
// and every output must be identical. Any disagreement = a semantics bug in a port.
//
// Run: node test/differential.mjs            (standalone)
//      (also invoked by plugs.pins.mjs P11)

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { shapeOf, changePoints } from "../core/shape.mjs";
import { perceive } from "../core/gate.mjs";
import { eta } from "../core/time.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = 2000, SEED = 20260930;
const TARGET_OFFSET = 37, UPT = 3, ALARM_NUM = 3, ALARM_DEN = 4;

function lcg(state) { state.x = (Math.imul(1664525, state.x) + 1013904223) >>> 0; return state.x; }

function genSeries(state) {
  const len = 2 + (lcg(state) % 39);            // 2..40
  const style = lcg(state) % 6;
  const xs = [];
  let v = (lcg(state) % 2001) - 1000;           // start -1000..1000
  for (let i = 0; i < len; i++) {
    xs.push(v);
    const r = lcg(state);
    if (style === 0) v += 0;                     // constant
    else if (style === 1) v += (lcg(state) % 7) - 3;         // drift ±3
    else if (style === 2 && r % 11 === 0) v += 200 - (lcg(state) % 401); // spikes
    else if (style === 3) v = r % 5 === 0 ? 0 : v;            // zero resets
    else if (style === 4 && r % 13 === 0) v = -v;             // sign flips
    else v += (lcg(state) % 5) - 2;                           // wander ±2
  }
  return xs;
}

// ---- JS side ----
function jsOut(xs) {
  let h = 0xcbf29ce484222325n;
  for (const c of changePoints(xs)) { h ^= BigInt(c + 1); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  const percepts = perceive(xs, 4).map((p) => p.level === null ? -1 : p.level);
  const target = xs[xs.length - 1] + TARGET_OFFSET;
  return {
    shape: `${shapeOf(xs)} ${h.toString(16).padStart(16, "0")}`,
    percepts,
    eta: eta(Math.max(0, target - xs[xs.length - 1]), UPT),
    alarm: alarm(xs),
    target,
  };
  function alarm(xs) {
    for (let i = 1; i < xs.length; i++) {
      if (BigInt(Math.abs(xs[i] - xs[i - 1])) * BigInt(ALARM_DEN) > BigInt(Math.abs(xs[i - 1])) * BigInt(ALARM_NUM)) return i;
    }
    return -1;
  }
}

// ---- generate corpus ----
const state = { x: SEED >>> 0 };
const corpus = [];
for (let k = 0; k < N; k++) corpus.push(genSeries(state));
const jsResults = corpus.map(jsOut);

// ---- Python side ----
const pyScript = `
import sys, json
sys.path.insert(0, "${join(root, "libreoffice").replace(/\\/g, "/")}")
import percept as P
lines = open(sys.argv[1]).read().splitlines()
out = []
for ln in lines:
    xs = [int(t) for t in ln.split(",")]
    t = xs[-1] + ${TARGET_OFFSET}
    target = t
    alarm = P.DRIFTALARM(xs, ${ALARM_NUM}, ${ALARM_DEN})
    shape = P.SHAPEOF(xs)
    per = P.PERCEPTS(xs, 4)
    out.append({"shape": shape, "percepts": per, "eta": P.ETA(xs, target, ${UPT}), "alarm": alarm})
print(json.dumps(out))
`;
const corpusPath = "/tmp/percept-fuzz-corpus.txt";
writeFileSync(corpusPath, corpus.map((xs) => xs.join(",")).join("\n"));
const pyResults = JSON.parse(execFileSync("python3", ["-c", pyScript, corpusPath], { encoding: "utf8", maxBuffer: 1 << 24 }));

// ---- C++ side ----
const cli = "/tmp/percept-cli";
if (!existsSync(cli)) execFileSync("g++", ["-std=c++17", "-O2", "-o", cli, join(root, "cpp/cli.cpp")]);
let cppIn = "";
corpus.forEach((xs, k) => {
  cppIn += `S ${xs.length} ${xs.join(" ")}\n`;
  cppIn += `E ${jsResults[k].target} ${UPT} ${ALARM_NUM} ${ALARM_DEN}\n`;
});
const cppRaw = execFileSync(cli, { input: cppIn, encoding: "utf8", maxBuffer: 1 << 24 }).split("\n").filter(Boolean);
const cppResults = [];
for (let k = 0; k < N; k++) {
  const [shape, per] = cppRaw[2 * k].split(" | ");
  const [etaV, alarmV] = cppRaw[2 * k + 1].split(" ");
  cppResults.push({ shape, percepts: per.split(",").map(Number), eta: Number(etaV), alarm: Number(alarmV) });
}

// ---- compare all three ----
let bad = 0;
for (let k = 0; k < N; k++) {
  const a = jsResults[k], b = pyResults[k], c = cppResults[k];
  if (a.shape !== b.shape || a.shape !== c.shape ||
      a.eta !== b.eta || a.eta !== c.eta ||
      a.alarm !== b.alarm || a.alarm !== c.alarm ||
      a.percepts.length !== b.percepts.length || a.percepts.length !== c.percepts.length ||
      a.percepts.some((p, i) => p !== b.percepts[i] || p !== c.percepts[i])) {
    bad++;
    if (bad <= 5) {
      console.error(`MISMATCH #${k}: series=${corpus[k].join(",")}`);
      console.error(`  JS : ${JSON.stringify(a)}`);
      console.error(`  PY : ${JSON.stringify(b)}`);
      console.error(`  C++: ${JSON.stringify(c)}`);
    }
  }
}
console.log(`differential fuzz: ${N} series, seed ${SEED} — ${bad === 0 ? "ALL THREE RUNTIMES AGREE" : bad + " MISMATCHES"}`);
process.exit(bad === 0 ? 0 : 1);
