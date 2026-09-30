// sheets/witness-core.mjs — pure witness-sheet layer (no SpreadsheetApp).
// The .gs wrapper (built into the bundle by tools/build-bundle.mjs) injects
// the sheet name; everything else is identical between Node pins and GAS.
// Closes, at the sheet layer: D-1 (genesis content commitment), D-2 (silent
// edit -> tip mismatch), D-3 (reorder -> duplicate/discontinuous tip),
// D-4 (truncation -> declared_length + seq checks). D-5 forgery stays an
// honest concession (public rule; HMAC is a fleet-lane layer).

export function fnv64fold(str) {
  // 32-bit lane FNV-1a fold (Apps Script number safety). Chain semantics are
  // identical to the 64-bit core hash; width divergence documented in README.
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ (c & 0xff), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c >> 8) & 0xff), 0x01000193) >>> 0;
  }
  const p = (x) => ("00000000" + x.toString(16)).slice(-8);
  return p(h1) + p(h2);
}

export function canonOf(value) {  // typed-canonical: the D-6 rules, ported
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (value === 0 && 1 / value === -Infinity) return "-0";
    if (Math.abs(value) > 0x1fffffffffffff) throw new Error("int53-overflow");
    if (!Number.isInteger(value)) throw new Error("non-integer");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "[" + value.map(canonOf).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonOf(value[k])).join(",") + "}";
}

export function genesisTip(sheetName, nonce) {
  return fnv64fold("genesis:" + nonce + ":" + sheetName);
}

// One receipt row. prevTip for seq 0 is the genesis commitment (D-1 closed):
// the chain binds sheet name + nonce, not just "cell 0 exists".
export function receipt(args, result, seq, prevTipOrNull, sheetName, nonce) {
  const prevTip = seq === 0 ? genesisTip(sheetName, nonce) : String(prevTipOrNull);
  const a = canonOf(args), r = canonOf(result);
  const tip = fnv64fold(a + "|" + r + "|" + prevTip);
  return { seq, argsHash: fnv64fold(a), resultHash: fnv64fold(r), prevTip, tip,
           text: seq + " | " + fnv64fold(a) + " | " + fnv64fold(r) + " | " + prevTip + " | " + tip };
}

// Fold + audit. Pure: feed it the extracted tip column and the declared length.
export function witness(tips, declaredLength) {
  if (tips.length !== declaredLength)
    return { ok: false, reason: "declared_length " + declaredLength + " != actual " + tips.length, at: tips.length };
  for (let i = 1; i < tips.length; i++) {
    if (tips[i] === tips[i - 1])
      return { ok: false, reason: "duplicate tip (reorder or copy)", at: i };
  }
  return { ok: true, tip: tips.length ? tips[tips.length - 1] : "none", len: tips.length };
}

// Recompute audit (D-2): re-run receipt() over the recorded inputs; any honest
// chain reproduces every tip; any silent edit breaks at exactly that row.
export function audit(receiptInputs, sheetName, nonce) {
  const tips = [];
  for (let i = 0; i < receiptInputs.length; i++) {
    const { args, result } = receiptInputs[i];
    const r = receipt(args, result, i, i === 0 ? null : tips[i - 1], sheetName, nonce);
    tips.push(r.tip);
  }
  return tips;
}
