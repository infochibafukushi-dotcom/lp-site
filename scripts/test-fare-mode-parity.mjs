/**
 * distance_time と pre_fixed_fare が同一の正式認可エンジンを使うことを検証する。
 * 根拠: pre-fixed-fare-report-data.js（距離制×平準化係数1.18・1円四捨五入）
 * Run: node scripts/test-fare-mode-parity.mjs
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

function getServiceTotal(snapshot){
  return (Array.isArray(snapshot?.serviceFees) ? snapshot.serviceFees : [])
    .reduce((sum, row) => {
      if(row?.key === "specialVehicleFee"){
        return sum;
      }
      return sum + (Number(row?.amount) || 0);
    }, 0);
}

function extractFareParts(result){
  const snapshot = result?.quoteSnapshot || {};
  const breakdown = snapshot.fixedFareBreakdown || [];
  return {
    total: Number(result?.total) || 0,
    fareTotal: Number(snapshot.fixedFareTotal) || 0,
    distanceFare: getBreakdownAmount(breakdown, "distanceFare"),
    timeFare: getBreakdownAmount(breakdown, "timeAdjustment"),
    pickupFee: getBreakdownAmount(breakdown, "pickupFee"),
    specialVehicleFee: getBreakdownAmount(breakdown, "specialVehicleFee"),
    serviceTotal: getServiceTotal(snapshot),
    preFixedFareAmount: Number(snapshot.preFixedFareAmount) || 0,
    coefficient: snapshot.trafficZoneCoefficient
  };
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

  const dt = extractFareParts(distanceTimeResult);
  const pf = extractFareParts(preFixedResult);

  assertEqual(pf.total, dt.total, label + " total");
  assertEqual(pf.fareTotal, dt.fareTotal, label + " fareTotal");
  assertEqual(pf.distanceFare, dt.distanceFare, label + " distanceFare");
  assertEqual(pf.timeFare, dt.timeFare, label + " timeFare");
  assertEqual(pf.pickupFee, dt.pickupFee, label + " pickupFee");
  assertEqual(pf.specialVehicleFee, dt.specialVehicleFee, label + " specialVehicleFee");
  assertEqual(pf.serviceTotal, dt.serviceTotal, label + " serviceTotal");
  assertEqual(pf.preFixedFareAmount, dt.preFixedFareAmount, label + " preFixedFareAmount");
  assertEqual(pf.coefficient, 1.18, label + " coefficient 1.18");
  assertEqual(dt.coefficient, 1.18, label + " distance_time coefficient 1.18");
  assertEqual(pf.timeFare, 0, label + " scheduledDurationSurcharge not charged");

  return { distanceTimeResult, preFixedResult, dt, pf };
}

const { EstimateCalc, FareConstants } = loadCalc();
const config = JSON.parse(readFileSync(join(root, "data/estimate-config.json"), "utf8"));

function baseState(overrides){
  return Object.assign({
    originAddress: "千葉市中央区出洲港8-3-2",
    destinationAddress: "千葉メディカルセンター",
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
      pickup: { address: "千葉市中央区出洲港8-3-2" },
      destination: { address: "千葉メディカルセンター" },
      selectedRouteId: "route_0",
      distanceMeters: 8500,
      durationSeconds: 1500,
      routes: [{
        routeId: "route_0",
        distanceMeters: 8500,
        durationSeconds: 1500,
        preFixedFareConfirmable: true
      }]
    }
  }, overrides || {});
}

console.log("=== Test A: same input, mode only differs ===");
compareModes(config, baseState(), "testA");

console.log("=== Test B: keiyo/unknown settings do not override authorized chiba 1.18 ===");
const zoneCases = [
  { name: "coefficient 1.0 decoy", zone: { id: "test", label: "Test", coefficient: 1.0 } },
  { name: "coefficient 1.2 decoy", zone: { id: "test", label: "Test", coefficient: 1.2 } },
  { name: "fallback keiyo ignored", preFixedFare: { trafficZoneId: "keiyo" } },
  { name: "unknown zone ignored", preFixedFare: { trafficZoneId: "unknown-zone" } }
];

zoneCases.forEach(function(zoneCase){
  const zoneConfig = JSON.parse(JSON.stringify(config));
  if(zoneCase.zone){
    zoneConfig.trafficZones = {
      items: [
        { id: "chiba", label: "千葉交通圏", coefficient: 1.18 },
        zoneCase.zone
      ]
    };
    zoneConfig.preFixedFare = { trafficZoneId: zoneCase.zone.id };
  }else if(zoneCase.preFixedFare){
    zoneConfig.preFixedFare = zoneCase.preFixedFare;
  }
  const result = compareModes(zoneConfig, baseState(), "testB:" + zoneCase.name);
  assertEqual(result.pf.total, 7760, "testB:" + zoneCase.name + " authorized total");
});

console.log("=== Test C: multiple conditions ===");
const scenarios = [
  {
    name: "short distance (within initial)",
    state: baseState({
      distanceKm: 0.8,
      routeCalcResult: { durationMinutes: 15 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 800,
        durationSeconds: 900,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 800, durationSeconds: 900 }]
      }
    })
  },
  {
    name: "medium distance ~8.5km",
    state: baseState()
  },
  {
    name: "long distance 20km+",
    state: baseState({
      distanceKm: 22,
      routeCalcResult: { durationMinutes: 40 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 22000,
        durationSeconds: 2400,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 22000, durationSeconds: 2400 }]
      }
    })
  },
  {
    name: "duration 10min same fare",
    state: baseState({
      routeCalcResult: { durationMinutes: 10 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 8500,
        durationSeconds: 600,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 8500, durationSeconds: 600 }]
      }
    })
  },
  {
    name: "duration 120min same fare",
    state: baseState({
      routeCalcResult: { durationMinutes: 120 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 8500,
        durationSeconds: 7200,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 8500, durationSeconds: 7200 }]
      }
    })
  },
  {
    name: "service fees (assist + equipment)",
    state: baseState({
      mobilityId: "reclining-wheelchair",
      assistanceId: "boarding-assist",
      stairId: "stair-watch"
    })
  },
  {
    name: "round trip with waiting",
    state: baseState({
      tripTypeId: "round-trip",
      roundTripAddonId: "addon-waiting",
      distanceKm: 8.5,
      routeCalcResult: { durationMinutes: 50 },
      routePlan: {
        tripType: "round_trip",
        returnPlanType: "same_return",
        totalDistanceMeters: 17000,
        totalDurationSeconds: 3000,
        outboundRoutePlan: {
          selectedRouteId: "out-a",
          distanceMeters: 8500,
          durationSeconds: 1500,
          routes: [{ routeId: "out-a", distanceMeters: 8500, durationSeconds: 1500 }]
        },
        returnRoutePlan: {
          selectedRouteId: "ret-a",
          distanceMeters: 8500,
          durationSeconds: 1500,
          routes: [{ routeId: "ret-a", distanceMeters: 8500, durationSeconds: 1500 }]
        }
      }
    })
  }
];

scenarios.forEach(function(scenario){
  compareModes(config, scenario.state, "testC:" + scenario.name);
});

console.log("=== 8.5km authorized fare verification (report-data 1.18) ===");
const verifyState = baseState();
const billedKm = EstimateCalc.getEffectiveBilledDistanceKm(config, verifyState);
const rawDistanceFare = EstimateCalc.calcDistanceFare(billedKm, config.distancePricing);
const verifyResult = compareModes(config, verifyState, "verify8.5km");
const pattern = config.distancePricing?.patternA || {};
const incrementKm = FareConstants.resolveIncrementDistanceKm(pattern);
const excess = 8.5 - Number(pattern.initialDistanceKm || 0);
const increments = excess > 0 && incrementKm > 0 ? Math.ceil(excess / incrementKm) : 0;

assertEqual(rawDistanceFare, 4120, "base distance 4120");
assertEqual(verifyResult.pf.distanceFare, 4860, "adjusted distance 4860");
assertEqual(verifyResult.pf.total, 7760, "authorized total 7760");
assertEqual(verifyResult.dt.total, 7760, "distance_time total 7760");

console.log({
  stateDistanceKm: verifyState.distanceKm,
  getEffectiveBilledDistanceKm: billedKm,
  incrementDistanceMetersInConfig: pattern.incrementDistanceMeters,
  incrementDistanceKmResolved: incrementKm,
  excessKm: excess,
  incrementCount: increments,
  calcDistanceFareResult: rawDistanceFare,
  distanceFareInBreakdown: verifyResult.dt.distanceFare,
  timeFare: verifyResult.dt.timeFare,
  preFixedFareAmount: verifyResult.pf.preFixedFareAmount,
  fareTotal: verifyResult.dt.fareTotal,
  serviceTotal: verifyResult.dt.serviceTotal,
  finalTotal: verifyResult.dt.total,
  distance_time: verifyResult.dt.total,
  pre_fixed_fare: verifyResult.pf.total,
  diff: verifyResult.pf.total - verifyResult.dt.total
});

console.log("\nAll fare-mode parity tests passed.");
