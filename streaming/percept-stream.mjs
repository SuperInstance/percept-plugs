// streaming/percept-stream.mjs — reactive style over the same pinned core.
// Batch adapters ask "what does the whole series say?"; a stream answers
// "what did THIS sample just tell me?" — the boat's predictor line, live.
// Equivalence vs batch is true by construction (percept reads only the past
// window); pinned anyway so a future core refactor cannot silently break it.

import { percept } from "../core/gate.mjs";
import { shapeOf, changePoints } from "../core/shape.mjs";

export class PerceptStream {
  #w; #scale; #series = [];
  constructor({ w = 4, scale = 1024 } = {}) { this.#w = w; this.#scale = scale; }

  push(x) {
    this.#series.push(x);
    const p = percept(this.#series, this.#series.length - 1, this.#w, this.#scale);
    return { i: this.#series.length - 1, level: p.level === null ? -1 : p.level, signed: p.signed };
  }

  get length() { return this.#series.length; }
  get series() { return [...this.#series]; }
  get shape() { return shapeOf(this.#series); }
  get changePoints() { return changePoints(this.#series); }
}

// Fused stream: N input streams push percepts into a downstream series that is
// itself shape-analyzed. The fleet pattern (several tapes -> one listener).
export function fuse(streams, onEvent = () => {}) {
  const sink = new PerceptStream();
  return streams.map((s) => (x) => { const e = s.push(x); onEvent(e); return e; });
}
