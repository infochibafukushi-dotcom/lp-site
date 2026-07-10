/**
 * 正式認可計算では予定時間を変えても金額が変わらないことを検証する。
 * 根拠: 申請資料 — 予定時間加算は事前確定運賃本体に含めない。
 * Run: node scripts/test-duration-fare-difference.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vm = require("node:vm");

function loadBrowserModule(relativePath, globals){
  const code = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    console: console
  };
  Object.assign(sandbox, globals || {});
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(code, sandbox, { filename: relativePath });
  return sandbox.window;
}

const defaultsWindow = loadBrowserModule("../shared/estimate-defaults.js");
const trafficZoneWindow = loadBrowserModule("../shared/estimate-traffic-zone.js", {
  EstimateDefaults: defaultsWindow.EstimateDefaults
});
const calcWindow = loadBrowserModule("../estimate/estimate-calc.js", {
  EstimateTrafficZone: trafficZoneWindow.EstimateTrafficZone
});

const EstimateCalc = calcWindow.EstimateCalc;
const createDefaultEstimateConfig = defaultsWindow.EstimateDefaults.createDefaultEstimateConfig;

function makeRoutePlan(totalDurationSeconds, totalDistanceMeters){
  return {
    tripType: "round_trip",
    returnPlanType: "same_return",
    totalDurationSeconds,
    totalDistanceMeters,
    outboundRoutePlan: {
      selectedRouteId: "out-a",
      distanceMeters: totalDistanceMeters / 2,
      durationSeconds: totalDurationSeconds / 2,
      routeSelectionConfirmed: true
    },
    returnRoutePlan: {
      selectedRouteId: "ret-a",
      distanceMeters: totalDistanceMeters / 2,
      durationSeconds: totalDurationSeconds / 2,
      routeSelectionConfirmed: true
    },
    overallRouteSelection: {
      selectedOverallRouteId: "stale-overall",
      overallRouteCandidates: [{
        routeId: "stale-overall",
        totalDistanceMeters,
        totalDurationSeconds: 69 * 60
      }]
    }
  };
}

function baseState(routePlan){
  return {
    mobilityId: "free-wheelchair",
    assistanceId: "boarding-assist",
    stairId: "stair-none",
    tripTypeId: "round-trip",
    roundTripAddonId: "",
    distanceKm: 37.7,
    roadType: "general",
    routePlan,
    routeCalcResult: {
      distanceKm: 37.7,
      durationMinutes: Math.round((routePlan.totalDurationSeconds || 0) / 60)
    }
  };
}

const config = createDefaultEstimateConfig();
config.fareMode = "pre_fixed_fare";

const meters = 37700;
const result69 = EstimateCalc.computeEstimate(config, baseState(makeRoutePlan(69 * 60, meters)));
const result72 = EstimateCalc.computeEstimate(config, baseState(makeRoutePlan(72 * 60, meters)));

const timeRow69 = (result69.quoteSnapshot.fixedFareBreakdown || []).find((row) => row.key === "timeAdjustment");
const timeRow72 = (result72.quoteSnapshot.fixedFareBreakdown || []).find((row) => row.key === "timeAdjustment");
const specialRow = (result69.quoteSnapshot.fixedFareBreakdown || []).find((row) => row.key === "specialVehicleFee");

let failed = 0;

if(result69.total !== result72.total){
  console.error("FAIL: authorized totals must be equal for 69 vs 72 minute routes", result69.total, result72.total);
  failed++;
}
if((Number(timeRow69?.amount) || 0) !== 0 || (Number(timeRow72?.amount) || 0) !== 0){
  console.error("FAIL: timeAdjustment must remain 0", { timeRow69, timeRow72 });
  failed++;
}
if(Number(result69.quoteSnapshot?.scheduledDurationSurcharge) !== 0){
  console.error("FAIL: scheduledDurationSurcharge must be 0", result69.quoteSnapshot?.scheduledDurationSurcharge);
  failed++;
}
if(!specialRow || specialRow.amount !== 1000){
  console.error("FAIL: specialVehicleFee should be 1000 in fixedFareBreakdown", specialRow);
  failed++;
}
if(result69.total < 1000){
  console.error("FAIL: total should include special vehicle fee", result69.total);
  failed++;
}

if(failed){
  console.error("\nFAILED assertions:", failed);
  process.exit(1);
}

console.log("Duration independence (authorized fare) test passed.");
console.log({
  total69: result69.total,
  total72: result72.total,
  timeAdjustment69: Number(timeRow69?.amount) || 0,
  timeAdjustment72: Number(timeRow72?.amount) || 0,
  specialVehicleFee: specialRow.amount,
  preFixedFareAmount: result69.quoteSnapshot?.preFixedFareAmount
});
