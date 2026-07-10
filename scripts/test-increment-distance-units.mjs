/**
 * 加算距離 212m の単位変換と距離運賃境界値を検証する。
 * Run: node scripts/test-increment-distance-units.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadCalc(){
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(join(root, "shared/estimate-defaults.js"), "utf8"), sandbox);
  vm.runInNewContext(readFileSync(join(root, "shared/fare-constants.js"), "utf8"), sandbox);
  vm.runInNewContext(readFileSync(join(root, "estimate/estimate-calc.js"), "utf8"), sandbox);
  return {
    EstimateCalc: sandbox.EstimateCalc,
    FareConstants: sandbox.FareConstants
  };
}

function assertEqual(actual, expected, label){
  if(actual !== expected){
    throw new Error(label + ": expected " + expected + ", got " + actual);
  }
}

function getBreakdownAmount(rows, key){
  const row = (Array.isArray(rows) ? rows : []).find((item) => item?.key === key);
  return Number(row?.amount) || 0;
}

function compareModes(config, state, label){
  const distanceTimeResult = EstimateCalc.computeEstimate(
    Object.assign({}, config, { fareMode: "distance_time" }),
    state
  );
  const preFixedResult = EstimateCalc.computeEstimate(
    Object.assign({}, config, { fareMode: "pre_fixed_fare" }),
    state
  );
  assertEqual(preFixedResult.total, distanceTimeResult.total, label + " total parity");
  return { distanceTimeResult, preFixedResult };
}

const { EstimateCalc, FareConstants } = loadCalc();
const config = JSON.parse(readFileSync(join(root, "data/estimate-config.json"), "utf8"));
const pricing = config.distancePricing;

console.log("=== unit normalization ===");
assertEqual(FareConstants.resolveIncrementDistanceMeters({ incrementDistanceKm: 212 }), 212, "legacy 212 as meters");
assertEqual(FareConstants.resolveIncrementDistanceKm({ incrementDistanceKm: 212 }), 0.212, "legacy 212 to km");
assertEqual(FareConstants.resolveIncrementDistanceKm({ incrementDistanceKm: 0.212 }), 0.212, "already km");
assertEqual(FareConstants.resolveIncrementDistanceKm({ incrementDistanceMeters: 212 }), 0.212, "explicit meters");
assertEqual(FareConstants.resolveIncrementDistanceKm({ incrementDistanceKm: 0.221 }), 0.221, "legacy 0.221 km");

const fareCases = [
  { km: 1.0, expected: 520 },
  { km: 1.06, expected: 520 },
  { km: 1.061, expected: 620 },
  { km: 1.272, expected: 620 },
  { km: 1.273, expected: 720 },
  { km: 8.5, expected: 4120 },
  { km: 20, expected: 9520 }
];

console.log("=== calcDistanceFare boundaries ===");
fareCases.forEach(function(testCase){
  const actual = EstimateCalc.calcDistanceFare(testCase.km, pricing);
  assertEqual(actual, testCase.expected, testCase.km + "km distance fare");
  console.log("  " + testCase.km + "km -> " + actual + "円");
});

console.log("=== 8.5km full estimate ===");
const state85 = {
  originAddress: "千葉市中央区出洲港8-3-2",
  distanceKm: 8.5,
  mobilityId: "free-wheelchair",
  assistanceId: "boarding-assist",
  stairId: "stair-none",
  tripTypeId: "one-way",
  roundTripAddonId: "",
  roadType: "general",
  routeCalcResult: { durationMinutes: 25 },
  routePlan: {
    provider: "google_routes",
    distanceMeters: 8500,
    durationSeconds: 1500,
    selectedRouteId: "route_0",
    routes: [{ routeId: "route_0", distanceMeters: 8500, durationSeconds: 1500 }]
  }
};

const result85 = compareModes(config, state85, "8.5km");
const snapshot = result85.distanceTimeResult.quoteSnapshot || {};
const distanceFare = getBreakdownAmount(snapshot.fixedFareBreakdown, "distanceFare");
const timeFare = getBreakdownAmount(snapshot.fixedFareBreakdown, "timeAdjustment");
assertEqual(distanceFare, 4860, "8.5km adjusted distance fare (4120*1.18 -> 4860)");
assertEqual(timeFare, 0, "8.5km scheduledDurationSurcharge=0");
assertEqual(result85.distanceTimeResult.total, 7760, "8.5km authorized total 7760");

const excess = 8.5 - 1.06;
const incrementKm = FareConstants.resolveIncrementDistanceKm(pricing.patternA);
const increments = Math.ceil(excess / incrementKm);
console.log({
  excessKm: excess,
  incrementKm: incrementKm,
  incrementCount: increments,
  distanceFare: distanceFare,
  timeFare: timeFare,
  fareTotal: snapshot.fixedFareTotal,
  finalTotal: result85.distanceTimeResult.total,
  distance_time: result85.distanceTimeResult.total,
  pre_fixed_fare: result85.preFixedResult.total
});

console.log("=== service fees + mode parity ===");
const serviceState = Object.assign({}, state85, {
  mobilityId: "reclining-wheelchair",
  stairId: "stair-watch"
});
compareModes(config, serviceState, "service fees");

const legacyConfig = JSON.parse(JSON.stringify(config));
legacyConfig.distancePricing.patternA = {
  initialDistanceKm: 1.06,
  initialFare: 520,
  incrementDistanceKm: 212,
  incrementFare: 100
};
delete legacyConfig.distancePricing.patternA.incrementDistanceMeters;
assertEqual(
  EstimateCalc.calcDistanceFare(8.5, legacyConfig.distancePricing),
  4120,
  "legacy config without incrementDistanceMeters"
);
compareModes(legacyConfig, state85, "legacy config parity");

console.log("\nAll increment distance unit tests passed.");
