// tools/build-bundle.mjs — concatenate core modules + the Sheets adapter into
// one Apps-Script-compatible file (no imports/exports). Deterministic output:
// same core commit + same adapter => byte-identical bundle (pinned).

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_COMMIT = readFileSync(join(root, "core/VENDORED-FROM"), "utf8").trim().split("@")[1];

const files = ["shape.mjs", "gate.mjs", "time.mjs", "learn.mjs"];
let out = `// AUTO-GENERATED percept-bundle.gs — do not edit by hand.\n// Core vendored from SuperInstance/delta-shape@${CORE_COMMIT}\n// Build: node tools/build-bundle.mjs\n\n`;
for (const f of files) {
  let src = readFileSync(join(root, "core", f), "utf8");
  src = src
    .replace(/^import[^\n]*\n/gm, "")        // strip ES imports
    .replace(/^export\s+default\s+/gm, "")   // (none today; future-proof)
    .replace(/^export\s+(?=(const|let|var|function|class))/gm, ""); // keep declarations, drop export keyword
  out += `// ==== core/${f} ====\n${src}\n`;
}
out += `// ==== sheets/appscript.js ====\n`;
out += readFileSync(join(root, "sheets/appscript.js"), "utf8");

const dest = join(root, "sheets/percept-bundle.gs");
writeFileSync(dest, out);
const sha = createHash("sha256").update(out, "utf8").digest("hex");
console.log(`${CORE_COMMIT}  ${sha.slice(0, 16)}  ${out.length} bytes -> sheets/percept-bundle.gs`);
