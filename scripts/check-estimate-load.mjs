import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const scriptOrder = [
  "shared/estimate-config-loader.js",
  "shared/estimate-number.js",
  "shared/estimate-defaults.js",
  "shared/estimate-url.js",
  "shared/estimate-handoff.js",
  "shared/tenant-defaults.js",
  "shared/estimate-quote-config.js",
  "shared/estimate-quote-register.js",
  "shared/estimate-fare-display.js",
  "shared/estimate-traffic-zone.js",
  "carechan-cta-defaults.js",
  "estimate/estimate-calc.js",
  "shared/pre-fixed-fare-route-waypoints.js",
  "estimate/estimate-distance-api.js",
  "estimate/estimate-help.js",
  "shared/estimate-route-map-display.js",
  "estimate/estimate-pdf.js",
  "estimate/estimate-main.js"
];

const innerHtml = { value: '<div class="estimate-loading">読み込み中...</div>' };
const rootEl = {
  innerHTML: innerHtml.value,
  addEventListener() {}
};

const sandbox = {
  window: {},
  document: {
    readyState: "complete",
    getElementById(id){
      if(id === "estimateApp"){
        return {
          get innerHTML(){ return innerHtml.value; },
          set innerHTML(v){ innerHtml.value = v; },
          addEventListener: rootEl.addEventListener
        };
      }
      return null;
    },
    addEventListener() {},
    querySelectorAll(){ return []; },
    createElement(){ return { style: {}, appendChild(){} }; },
    head: { appendChild(){} },
    body: { appendChild(){} }
  },
  console,
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "{}" }),
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  Promise: globalThis.Promise,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  requestAnimationFrame(cb){ cb(); },
  navigator: { clipboard: null },
  localStorage: { getItem(){ return null; } }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

for(const rel of scriptOrder){
  const file = path.join(root, rel);
  const code = fs.readFileSync(file, "utf8");
  try{
    vm.runInNewContext(code, sandbox, { filename: rel });
    console.log("loaded:", rel);
  }catch(error){
    console.error("FAILED:", rel, error.message);
    process.exit(1);
  }
}

console.log("EstimateCalc:", Boolean(sandbox.EstimateCalc));
console.log("EstimateConfigLoader:", Boolean(sandbox.EstimateConfigLoader));
console.log("innerHTML after scripts:", innerHtml.value.slice(0, 80));

if(innerHtml.value.includes("読み込み中...")){
  console.error("BUG: init did not replace loading message");
  process.exit(1);
}

console.log("OK: loading message replaced");
