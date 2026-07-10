/**
 * 正式認可ロジック（申請資料準拠）の検証。
 *
 * 根拠:
 * - shared/pre-fixed-fare-report-data.js
 *   「事前確定運賃 ＝ 距離制運賃 × 平準化係数（1円単位四捨五入）」
 *   千葉交通圏 coefficient: 1.18
 * - shared/pre-fixed-fare-submission-appendix-data.js
 *   端数処理: 1円未満四捨五入 / 平準化係数: 千葉交通圏 1.18
 *
 * 期待値（8.5km・迎車800・特殊車両1000・乗降介助1100・片道）:
 *   4120 × 1.18 = 4861.6 → Math.round → 4862
 *   予定時間加算 0
 *   支払合計 7762
 *
 * Run: node scripts/test-authorized-pre-fixed-fare.mjs
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
  return sandbox.EstimateCalc;
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

const EstimateCalc = loadCalc();
const config = JSON.parse(readFileSync(join(root, "data/estimate-config.json"), "utf8"));

function baseState(durationMinutes){
  const seconds = Math.round(Number(durationMinutes) * 60);
  return {
    originAddress: "千葉市中央区出洲港8-3-2",
    destinationAddress: "千葉メディカルセンター",
    distanceKm: 8.5,
    mobilityId: "free-wheelchair",
    assistanceId: "boarding-assist",
    stairId: "stair-none",
    tripTypeId: "one-way",
    roundTripAddonId: "",
    roadType: "general",
    routeCalcResult: { durationMinutes: Number(durationMinutes) },
    routePlan: {
      provider: "google_routes",
      pickup: { address: "千葉市中央区出洲港8-3-2" },
      destination: { address: "千葉メディカルセンター" },
      selectedRouteId: "route_0",
      distanceMeters: 8500,
      durationSeconds: seconds,
      routes: [{
        routeId: "route_0",
        distanceMeters: 8500,
        durationSeconds: seconds,
        preFixedFareConfirmable: true
      }]
    }
  };
}

function computeMode(fareMode, durationMinutes){
  return EstimateCalc.computeEstimate(
    Object.assign({}, config, { fareMode: fareMode }),
    baseState(durationMinutes)
  );
}

console.log("=== 距離制運賃境界（申請距離制運賃表） ===");
[
  [1.0, 520],
  [1.06, 520],
  [1.061, 620],
  [1.272, 620],
  [1.273, 720],
  [8.5, 4120],
  [20, 9520]
].forEach(function([km, expected]){
  assertEqual(EstimateCalc.calcDistanceFare(km, config.distancePricing), expected, km + "km distance fare");
});

console.log("=== 8.5km 正式認可試算（report-data: 距離制×1.18・1円四捨五入） ===");
const pf25 = computeMode("pre_fixed_fare", 25);
const snap = pf25.quoteSnapshot || {};
const baseDistance = EstimateCalc.calcDistanceFare(8.5, config.distancePricing);
assertEqual(baseDistance, 4120, "base distance fare 4120");
assertEqual(Math.round(4120 * 1.18), 4862, "4120*1.18 rounded");
assertEqual(Number(snap.baseDistanceFareAmount), 4120, "quoteSnapshot.baseDistanceFareAmount");
assertEqual(Number(snap.trafficZoneCoefficient), 1.18, "quoteSnapshot.trafficZoneCoefficient (千葉交通圏)");
assertEqual(String(snap.trafficZoneId || snap.selectedTrafficZoneId), "chiba", "trafficZoneId chiba");
assertEqual(Number(snap.adjustedDistanceFareAmount), 4862, "adjustedDistanceFareAmount");
assertEqual(Number(snap.preFixedFareAmount), 4862, "preFixedFareAmount = 事前確定運賃本体");
assertEqual(Number(snap.scheduledDurationSurcharge) || 0, 0, "scheduledDurationSurcharge=0（本体に含めない）");
assertEqual(getBreakdownAmount(snap.fixedFareBreakdown, "timeAdjustment"), 0, "timeAdjustment not charged");
assertEqual(getBreakdownAmount(snap.fixedFareBreakdown, "distanceFare"), 4862, "distanceFare after coefficient");
assertEqual(getBreakdownAmount(snap.fixedFareBreakdown, "pickupFee"), 800, "pickupFee without coefficient");
assertEqual(Number(snap.specialVehicleFeeAmount) || getBreakdownAmount(snap.fixedFareBreakdown, "specialVehicleFee"), 1000, "specialVehicleFee without coefficient");
assertEqual(Number(pf25.total), 7762, "totalAmount 7762");
assertEqual(Number(snap.totalAmount ?? pf25.total), 7762, "quoteSnapshot.totalAmount");

console.log("=== 予定時間非連動（10/25/60/120分で同額） ===");
[10, 25, 60, 120].forEach(function(minutes){
  const result = computeMode("pre_fixed_fare", minutes);
  assertEqual(Number(result.total), 7762, "duration " + minutes + "m total");
  assertEqual(Number(result.quoteSnapshot?.scheduledDurationSurcharge) || 0, 0, "duration " + minutes + "m surcharge");
});

console.log("=== 2モード一致（同一認可エンジン） ===");
const dt25 = computeMode("distance_time", 25);
assertEqual(Number(pf25.total), Number(dt25.total), "mode total parity");
assertEqual(
  Number(pf25.quoteSnapshot?.preFixedFareAmount),
  Number(dt25.quoteSnapshot?.preFixedFareAmount),
  "mode preFixedFareAmount parity"
);
assertEqual(Number(dt25.total), 7762, "distance_time also 7762");

console.log("=== 京葉1.20は料金に使わない / 係数なしにならない ===");
const keiyoConfig = JSON.parse(JSON.stringify(config));
keiyoConfig.preFixedFare = { trafficZoneId: "keiyo" };
const keiyoResult = EstimateCalc.computeEstimate(
  Object.assign({}, keiyoConfig, { fareMode: "pre_fixed_fare" }),
  baseState(25)
);
assertEqual(Number(keiyoResult.total), 7762, "keiyo config must not change authorized total");
assertEqual(Number(keiyoResult.quoteSnapshot?.trafficZoneCoefficient), 1.18, "still 1.18");
assertEqual(String(keiyoResult.quoteSnapshot?.trafficZoneId || keiyoResult.quoteSnapshot?.selectedTrafficZoneId), "chiba", "still chiba");

const noZoneConfig = JSON.parse(JSON.stringify(config));
noZoneConfig.trafficZones = { items: [] };
noZoneConfig.preFixedFare = { trafficZoneId: "keiyo" };
const noZoneResult = EstimateCalc.computeEstimate(
  Object.assign({}, noZoneConfig, { fareMode: "pre_fixed_fare" }),
  baseState(25)
);
assertEqual(Number(noZoneResult.total), 7762, "missing zones still use authorized 1.18");
assertEqual(Number(noZoneResult.quoteSnapshot?.trafficZoneCoefficient), 1.18, "coefficient present");

console.log("=== 迎車・介助へ係数を掛けない ===");
const pickup = getBreakdownAmount(snap.fixedFareBreakdown, "pickupFee");
const assist = (snap.serviceFees || []).find((row) => row.key === "assistanceFee");
assertEqual(pickup, 800, "pickup stays 800");
assertEqual(Number(assist?.amount), 1100, "assistance stays 1100");

console.log("\nAll authorized pre-fixed-fare tests passed.");
