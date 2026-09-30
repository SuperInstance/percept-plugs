# percept-plugs

The delta-shape perceptual primitives as **ordinary plugs**: spreadsheet
functions (Excel, Google Sheets, LibreOffice) and a VS Code side panel, all
running one pinned core.

**Core:** vendored from `SuperInstance/delta-shape@e2ad00d5` (see
`core/VENDORED-FROM`) — pure ESM, zero dependencies, deterministic,
integer-exact. Adapters are thin because the core is thin.

## How the plug compatibility works

Every platform gets a custom-function layer; the core never changes per
platform. That is the whole trick — write instruments once, wear platform
uniforms over them.

| platform | plug point | file | status |
|---|---|---|---|
| Google Sheets | Apps Script custom functions + sidebar | `sheets/appscript.js` → `sheets/percept-bundle.gs` (via `tools/build-bundle.mjs`) | functions **HEWN** under node --test; menu/sidebar in-Google **SHAPED** |
| Excel | Office Add-in: Custom Functions + shared-runtime taskpane | `excel/functions.js`, `excel/manifest.xml` | functions **HEWN**; sideloading needs Excel — **SHAPED** |
| LibreOffice | Python macro module (UNO-scriptable) | `libreoffice/percept.py` | pure module **HEWN** (cross-language pins vs JS); UNO glue **SHAPED** |
| VS Code (side panel) | WebviewView provider; analysis in the extension host (Node, real core), webview renders only | `vscode/extension.js`, `vscode/view-model.js`, `vscode/package.json` | view-model **HEWN**; panel render in-editor **SHAPED** |
| other IDEs | same portable trick: host runs core, web pane renders | — | **SHAPED** (JetBrains needs a JVM port; Zed/others accept webviews or WASM) |

HEWN = executed and pinned on the build host. SHAPED = the platform itself
must run it; we pin everything upstream of that seam.

## Functions (identical names and semantics everywhere)

- `SHAPEOF(series)` → `"<sign-pattern> <fnv-1a-64(change-points)>"` — value-independent identity.
- `PERCEPTS(series, w=4)` → Weber-gated event levels; nulls as `-1`. Multiplicative: double the surround, lose one JND bin.
- `ETA(series, target, unitsPerTick)` → whole ticks to cover `target − last`, ceiling division; `0` if already there. No floats cross the decision.
- `DRIFTALARM(series, num, den)` → first index with `|delta| > |prev|·num/den`, cross-multiplied in integers; `-1` if never. (Absolute-threshold crossing lives in the core as `firstCrossing`; the ratio form is adapter-side, one layer down.)

## Install

- **Sheets:** paste `sheets/percept-bundle.gs` into Extensions → Apps Script (the bundle is dependency-free; the builder strips ES modules deterministically — pinned sha256, see P4).
- **Excel:** sideload `excel/manifest.xml` per Microsoft docs; serve `excel/functions.js` + a `functions.json` metadata file from the manifest's URLs.
- **LibreOffice:** copy `libreoffice/percept.py` to your user scripts dir; bind `SHAPEOF` etc. as Basic-callable macros.
- **VS Code:** `code --install-extension` from the `vscode/` folder (dev: F5 launch).

## Pins

`node --test test/plugs.pins.mjs` — 12 pins:
P1–P3 Excel adapter goldens · P4 bundle determinism (rebuild ⇒ identical sha256)
· P5 bundle sandbox behavior · P6 cross-language JS==Python golden vectors
· P7–P8 view-model goldens · P9 C++ port goldens · P10 streaming style ≡ batch
· P11 **differential fuzz: 2000 seeded adversarial series (zeros, negatives,
plateaus, spikes, drift, sign-flips), JS == Python == C++ byte-for-byte**
(`test/differential.mjs`, also standalone)
· P12 **witness sheet: honest chain verifies; reorder / truncate / silent-edit
all break; genesis binds sheet+nonce (D-1), audit diverges exactly at the
edited row (D-2)** — the canon-chain defect classes pinned at the sheet layer.

## Languages & styles tried (captain 16:56: "try different languages and styles")

| runtime | file | style | pinned by |
|---|---|---|---|
| JS (core) | `core/*.mjs` vendored | pure ESM, functional, prototype-free | P1–P5, P11 |
| JS (streaming) | `streaming/percept-stream.mjs` | reactive/push-class over the same core | P10 |
| Python | `libreoffice/percept.py` | procedural, LO-macro-ready | P6, P11 |
| C++17 | `cpp/percept.hpp` | header-only, `constexpr`-friendly, RAII-free | P9, P11 |

Verdict so far: **semantics are the hard part, syntax is not.** The three
runtimes agree on 2000 fuzzed series because every port pins the same four
un-portable details: trunc-toward-zero (never floor), the `s==0 → mag 0`
division edge, upper median for even windows, and FNV-1a-64 chaining. A fourth
language (Rust/Kotlin/Go) is a day of porting plus the same four pins —
WASM from the C++ core is the strategic next uniform (see CONCEPTS.md).

## Honesty notes (do not remove)

- Adapters were corrected once during pinning: the core's true signatures are
  `firstCrossing(xs, k)` (absolute) and `eta(spaceUnits, unitsPerTick)`
  (ceil division). The ratio form and target-form ETA live in the adapters.
  P6/P7 pin the corrected behavior.
- The Python port uses `math.trunc`, never `//`, to mirror JS `|0` on
  negatives; `surround` takes the upper median for even windows
  (`win[len>>1]`), matching the JS sort-index exactly.
- In-sheet spill shapes differ per platform (Sheets 2-D arrays, Excel dynamic
  arrays); the functions return the platform-native shapes already.

## The witness layer (CONCEPTS C1, built)

`sheets/witness-core.mjs` + GAS wrappers (`RECEIPT`, `WITNESS` in
`sheets/appscript.js`): every `=SHAPEOF(...)` call can carry a chained receipt
(FNV-1a fold over typed-canonical args + result + prev tip). The genesis
receipt commits `sheet name + WITNESS_GENESIS_NONCE`, so a chain cannot be
spliced onto another sheet (D-1). `WITNESS(tips, declaredLength)` reports
truncation (D-4) and duplicate tips (D-3); an offline `audit()` recompute
catches silent edits at exactly the altered row (D-2). D-5 (adversarial
recomputation) stays an honest concession — the public rule verifies any
recomputed chain; signatures are a fleet-lane layer, same division as the
night-wheel's canon-chain fix. Hash width note: the sheet layer folds two
32-bit FNV lanes (Apps Script number safety); the core hash stays 64-bit —
semantics identical, width divergent, stated.

## EKN — e-calibrated kNN over shape space (`learn/ekn.mjs`, P13)

The ML layer: an anomaly column whose number is *evidence*, not a vibe.
Motivated by the fleet's own measurement (2026-09-30 org pulse): a learned
gate without calibration scored AUC 0.510 — a coin flip at the bar.

- **Embedding**: run-length-encoded sign runs + change-point set (diff-based,
  translation-invariant by construction). Weber percept levels are deliberately
  excluded from the distance: `perceive()` measures against the raw local
  surround (Weber law — magnitude-relative by design), so levels move under a
  +1000 translation. Shape/runs/cps do not.
- **Nonconformity**: kNN sum of the 3 smallest integer `shapeDist`s.
- **Calibration**: rank e-value `e = (R+1) / (1 + #{null ≥ query})` — exact
  rational, valid under exchangeability (Vovk; kNN-CAD family, Ishimtsev &
  Burnaev 2017). P13 pins: planted drift crosses the 1/0.05 Ville bar (e=201);
  400 null replicates stay under it (≤ delta + slack); +1000 translation is
  bit-identical; determinism; exactness `eNum=R+1, eDen=ge+1`.
- **Fail-first catches** (this build): raw-sign scoring let jitter nulls drown
  a planted step (fixed by RLE regime features); train-as-corpus self-distance
  contamination broke the level (fixed by disjoint calibration corpus).
- **Honest scope**: one-shot e-values are pinned. Sequential martingale
  composition (power martingale over a stream, anytime Ville bound) is SHAPED,
  per the EP-2 lesson — never claim a composition you haven't pinned.
- **Sheet form**: `=EKNN(range, nullcorpus)` → e-value; conditional format on
  `e ≥ 1/0.05`. The calibration corpus lives on a hidden `ekn-nulls` tab.

## Next builds (smallest first)

1. `functions.json` metadata for Excel CF registration (mechanical).
2. Sheets `sidebar.html` (paste-series UI → the bundle's analysis fns).
3. WASM uniform from `cpp/percept.hpp` (Emscripten) → Excel JS-runtime + VS Code
   webview + browsers; **not** Apps Script (V8 there exposes no WebAssembly).
4. JetBrains port: JVM Kotlin of the four functions (P11-style differential pins).
5. JupyterLab/Obsidian web pane — same view-model, third host.

See `CONCEPTS.md` for the research sketches (witness-sheet, live-column
streams, WASM uniformity).
