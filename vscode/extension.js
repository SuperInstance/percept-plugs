// vscode/extension.js — side-panel extension host. Analysis runs HERE (Node,
// real vendored core); the webview is a dumb renderer. No telemetry, no
// network: the panel is an instrument, not a service.

import * as vscode from "vscode";
import { analyzeSeries, deltaRows } from "./view-model.js";

export function activate(context) {
  const provider = {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = panelHtml();
      webviewView.webview.onDidReceiveMessage((msg) => {
        if (msg?.type !== "analyze") return;
        const vm = analyzeSeries(msg.text, {
          target: msg.target ?? null,
          unitsPerTick: msg.unitsPerTick ?? 1,
          w: msg.w ?? 4,
        });
        webviewView.webview.postMessage({ type: "result", vm, rows: deltaRows(vm) });
      });
    },
  };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("percept.panel", provider)
  );
}

export function deactivate() {}

function panelHtml() {
  return `<!doctype html><html><body style="font-family:monospace;padding:8px">
<h3>percept instruments</h3>
<textarea id="s" rows="6" style="width:100%" placeholder="paste a numeric series, one value per line"></textarea>
<div><input id="t" placeholder="target (optional)" size="8"/> <input id="r" placeholder="units/tick" size="6" value="1"/></div>
<button id="go">analyze</button>
<pre id="out"></pre>
<script>
const vs = acquireVsCodeApi();
document.getElementById("go").onclick = () => vs.postMessage({
  type: "analyze",
  text: document.getElementById("s").value,
  target: document.getElementById("t").value,
  unitsPerTick: Number(document.getElementById("r").value || 1),
});
window.addEventListener("message", (e) => {
  if (e.data.type !== "result") return;
  const vm = e.data.vm;
  document.getElementById("out").textContent = vm.error
    ? vm.error
    : "shape: " + vm.shape + "  cps(" + vm.changePoints.length + "): " + vm.changePoints.join(",") + "  hash: " + vm.changePointsHash +
      "\\neta: " + (vm.eta ?? "n/a") + "\\npercepts: " + vm.percepts.map(p => p.level === -1 ? "." : p.level).join(" ");
});
</script></body></html>`;
}
