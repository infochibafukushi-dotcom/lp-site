/**
 * 交通圏判定モジュール単体のテスト（料金計算には使用しない）。
 * Run: node scripts/test-traffic-zone-detection.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const globalScope = globalThis;

const defaultsCode = readFileSync(join(root, "shared", "estimate-defaults.js"), "utf8");
new Function("global", defaultsCode)(globalScope);

const trafficZoneCode = readFileSync(join(root, "shared", "estimate-traffic-zone.js"), "utf8");
new Function("global", trafficZoneCode)(globalScope);

const config = JSON.parse(readFileSync(join(root, "data", "estimate-config.json"), "utf8"));

const { detectTrafficZone } = globalScope.EstimateTrafficZone;

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
    name: "判定できない住所",
    originAddress: "不明な場所ABC",
    expectedZoneId: "keiyo",
    expectedMethod: "fallback_config"
  }
];

let passed = 0;
let failed = 0;

console.log("=== 交通圏自動判定テスト（モジュール単体） ===\n");

cases.forEach(function(testCase){
  const detection = detectTrafficZone(config, {
    originAddress: testCase.originAddress,
    geocoding: testCase.geocoding || null
  });

  const checks = [
    ["交通圏ID", detection.selectedTrafficZoneId, testCase.expectedZoneId],
    ["判定方法", detection.trafficZoneDetectionMethod, testCase.expectedMethod]
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
