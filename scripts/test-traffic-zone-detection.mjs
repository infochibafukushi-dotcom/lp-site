import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadModule(relativePath){
  const code = readFileSync(join(__dirname, "..", relativePath), "utf8");
  const module = { exports: {} };
  const fn = new Function("module", "exports", code);
  fn(module, module.exports);
  return module.exports;
}

const globalScope = globalThis;
const defaultsCode = readFileSync(join(__dirname, "..", "shared", "estimate-defaults.js"), "utf8");
new Function("global", defaultsCode)(globalScope);

const trafficZoneCode = readFileSync(join(__dirname, "..", "shared", "estimate-traffic-zone.js"), "utf8");
new Function("global", trafficZoneCode)(globalScope);

const calcCode = readFileSync(join(__dirname, "..", "estimate", "estimate-calc.js"), "utf8");
new Function("global", calcCode)(globalScope);

const config = JSON.parse(readFileSync(join(__dirname, "..", "data", "estimate-config.json"), "utf8"));
config.fareMode = "pre_fixed_fare";

const { detectTrafficZone } = globalScope.EstimateTrafficZone;
const { computeEstimate } = globalScope.EstimateCalc;

const cases = [
  {
    name: "千葉市中央区",
    originAddress: "千葉市中央区富士見2-1-1",
    geocoding: {
      addressComponents: [
        { long_name: "中央区", short_name: "中央区", types: ["sublocality_level_1", "sublocality", "political"] },
        { long_name: "千葉市", short_name: "千葉市", types: ["locality", "political"] },
        { long_name: "千葉県", short_name: "千葉県", types: ["administrative_area_level_1", "political"] }
      ]
    },
    expectedZoneId: "keiyo",
    expectedMethod: "auto_geocoding"
  },
  {
    name: "四街道市",
    originAddress: "四街道市大日町123",
    expectedZoneId: "keiyo",
    expectedMethod: "auto_address"
  },
  {
    name: "船橋市",
    originAddress: "船橋市本町1-1",
    expectedZoneId: "keiyo",
    expectedMethod: "auto_address"
  },
  {
    name: "市川市",
    originAddress: "市川市市川1-1",
    expectedZoneId: "keiyo",
    expectedMethod: "auto_address"
  },
  {
    name: "判定できない住所",
    originAddress: "不明な場所ABC",
    expectedZoneId: "keiyo",
    expectedMethod: "fallback_config"
  }
];

let passed = 0;
let failed = 0;

console.log("=== 交通圏自動判定テスト ===\n");

cases.forEach(function(testCase){
  const detection = detectTrafficZone(config, {
    originAddress: testCase.originAddress,
    geocoding: testCase.geocoding || null
  });

  const state = {
    originAddress: testCase.originAddress,
    routePlan: {
      pickup: {
        address: testCase.originAddress,
        geocoding: testCase.geocoding || null
      }
    },
    distanceKm: 5,
    mobilityId: "cane-walk",
    assistanceId: "watch-assist",
    stairId: "stair-none",
    tripTypeId: "one-way",
    roundTripAddonId: "",
    roadType: "general",
    routeCalcResult: { durationMinutes: 15 }
  };

  const result = computeEstimate(config, state);
  const snapshot = result.quoteSnapshot || {};

  const checks = [
    ["交通圏ID", detection.selectedTrafficZoneId, testCase.expectedZoneId],
    ["判定方法", detection.trafficZoneDetectionMethod, testCase.expectedMethod],
    ["quoteSnapshot.zoneId", snapshot.selectedTrafficZoneId, testCase.expectedZoneId],
    ["quoteSnapshot.method", snapshot.trafficZoneDetectionMethod, testCase.expectedMethod]
  ];

  let caseFailed = false;
  console.log("[" + testCase.name + "]");
  console.log("  出発地: " + testCase.originAddress);
  console.log("  判定市区町村: " + (detection.detectedMunicipality || "-"));
  console.log("  適用交通圏: " + (detection.selectedTrafficZoneLabel || "-"));
  console.log("  係数: " + (detection.trafficZoneCoefficient ?? "-"));

  checks.forEach(function([label, actual, expected]){
    const ok = actual === expected;
    console.log("  " + (ok ? "OK" : "NG") + " " + label + ": " + actual + (ok ? "" : " (expected " + expected + ")"));
    if(!ok){
      caseFailed = true;
    }
  });

  if(caseFailed){
    failed += 1;
  }else{
    passed += 1;
  }
  console.log("");
});

console.log("結果: " + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
