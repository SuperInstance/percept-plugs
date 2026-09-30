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

`node --test test/plugs.pins.mjs` — 8 pins:
P1–P3 Excel adapter goldens · P4 bundle determinism (rebuild ⇒ identical sha256)
· P5 bundle sandbox behavior · P6 **cross-language pins** (Python output
deep-equals JS output on every vector, incl. the `s==0` and negative-truncation
edges) · P7–P8 view-model goldens.

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

## Next builds (smallest first)

1. `functions.json` metadata for Excel CF registration (mechanical).
2. Sheets `sidebar.html` (paste-series UI → the bundle's analysis fns).
3. JetBrains port: JVM Kotlin of the four functions (P6-style cross-language pins).
4. JupyterLab/Obsidian web pane — same view-model, third host.
