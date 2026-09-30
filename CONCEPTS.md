# CONCEPTS — research sketches from the plugs lane

Three concepts that fall out of making the instruments into ordinary plugs.
Each: what exists (cited), the smallest first build, the honest caveat.

---

## C1. The witness sheet — a spreadsheet that testifies about itself

**Motivating incident.** 2026-09-30: the research-canons scout flagged quilt-gpu-lab
main RED — a manifest sealed `d23b_relational_hidden_angle.py = 80e545bb…`, a hash
matching *no committed revision* (dirty-tree seal at fc79ff1, carried by a
"re-seal"). The pin caught it after the fact; the repair added a `--require-clean`
guard so the seal tool refuses at seal-time. Failure class: **a ledger that
attests to content it never pinned.**

**Concept.** Every `=SHAPEOF(range)` call in a sheet is a witness statement about
data. Add a `RECEIPT(cell, result)` column convention: each formula writes
`(args_hash, result_hash)` — FNV-1a-64 over the canonical arg list, chained the
way `cp_hash` chains change points today. A **Witness tab** walks the chain and
prints: chain tip, length, first-receipt genesis commitment. Reorder or edit a
source cell → the chain breaks at that cell (D-3 class, proven by the
night-wheel's attack.mjs). Truncate → completion proof fails (D-4 class).

**What exists to build on.** The plug functions (this repo); the canon-chain
attack catalog (`night-wheel/builds/canon-chain/DEFECTS.md` — D-1 genesis splice,
D-2 silent edit, D-3 reorder, D-4 truncation, D-5 forgery → HMAC layer, D-6
canonical-JSON collisions); Casey's witness-validation DESIGN.md (integrity =
Merkle + signed checkpoints + external anchor; RFC 6962/9162 consistency proofs).

**Smallest build (one evening).** Sheets bundle gains `RECEIPT(range, result)`:
FNV over JSON-canonical args + result, plus `WITNESS(chain_range)` folding the
column into a tip hash. Pin in node --test exactly like P5. Genesis commitment:
first receipt's args include the sheet's title + a user nonce (closes D-1 the
same way the chain fix did).

**Honest caveats.** (1) FNV is not adversarial — public-rule forgery is the
D-5 lesson; HMAC/signature is a separate key-holding layer, same division as
edge-ledger today (integrity PARTIAL). (2) In-sheet chains detect tampering
*inside the sheet's history*, not silent re-computation by the platform —
external anchoring (publish the tip hash anywhere else, even another cell in
another file) is the old-head-retention answer from CANON-DOCK. (3) Apps
Script triggers are eventually-consistent; the receipt for edit N may land
after edit N+1 — chain still valid, *order* is the platform's, state it.

---

## C2. Live-column streams — percepts on a column as it is typed

**Concept.** `PerceptStream` (pinned by P10) is the boat's predictor line as an
API: each pushed sample answers "what did THIS tell me?" Bind it to a Sheets
`onEdit` trigger on a watched column: every append pushes, and a
conditional-format rule paints the cell when `signed != 0` and `level` jumps a
bin. The sheet becomes an *instrument you play*, not a report you read.

**What exists.** The streaming class (equivalence with batch pinned); the
DRIFTALARM semantics (ratio trip pinned including the zero-surround edge);
change-point hash for "this column's drift identity".

**Smallest build.** A 40-line Apps Script bound to the bundle: `onEdit` → push
value → write `{level, signed}` two columns right → conditional format on
`level >= K`. Pin the trigger handler logic in node with a fake events list.

**Honest caveats.** Triggers don't fire for paste-bulk in every client
(SHAPED); the stream state must live in Script Properties (survives edits) —
rebuild-from-column on open is the recovery path, and it's honest because
percepts are causal (past-window only, P10's proof).

---

## C3. The WASM uniform — one core binary, every host that allows WASM

**Concept.** `cpp/percept.hpp` compiles to WebAssembly. One artifact then runs:
Excel's JS runtime (Custom Functions may instantiate WASM), the VS Code
*webview* (no more "analysis in host, render in webview" split — the core ships
*inside* the panel), any browser sidebar (JupyterLab, Obsidian), and Python via
a WASM interpreter. Uniforms stop being ports; they become *embeddings of one
binary*.

**What exists.** The C++ core (P9 goldens + P11 fuzz — semantics proven
portable). Emscripten not installed on the build host (SHAPED: the compile must
run where emsdk lives).

**Smallest build.** `emcc -O2 -sEXPORTED_FUNCTIONS=[SHAPEOF,PERCEPTS,ETA,DRIFTALARM]`
→ `percept.wasm` + a 30-line JS glue; pin by instantiating in node (V8 has
native WASM) and re-running the P11 corpus through the WASM boundary.
Expected result: byte-identical outputs, single-artifact distribution.

**Honest caveats.** Google Apps Script's V8 does **not** expose WebAssembly —
Sheets stays on the JS bundle (P4's deterministic build). iOS Excel historically
lagged on WASM in add-ins (check at ship time). The WASM path is worth it for
the hosts that allow it: one audit surface instead of four ports.

---

### Research anchors (for the next research turn)

- IETF **draft-sharif-agent-audit-trail** (candor's shape, standards-track) —
  the witness sheet (C1) is a spreadsheet-instance of its audit-trail model;
  refusal-events-03 is the sibling draft for the refusal-export lane.
- **RFC 6962 / 9162** — consistency proofs; C1's `WITNESS` fold is a
  Merkle-less special case; upgrading the fold to a real tree is the
  already-named E9 build in edge-ledger.
- Shafer's e-processes / Howard–Ramdas anytime-valid p-values — the validity
  layer Casey's design assigns to e-processes; percepts stay the drift
  *detector*, never the significance decider (witness-design's caveat, kept).
- Gibbs & Candès (arXiv:2106.00170) — change-point false-alarm control;
  backs the README line "shape ≠ significance".
