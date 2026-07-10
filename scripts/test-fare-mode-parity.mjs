/**
 * distance_time と pre_fixed_fare の料金計算が完全一致することを検証する。
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
    serviceTotal: getServiceTotal(snapshot)
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

  const dtSnapshot = distanceTimeResult.quoteSnapshot || {};
  const pfSnapshot = preFixedResult.quoteSnapshot || {};
  if(pfSnapshot.trafficZoneCoefficient != null){
    throw new Error(label + ": pre_fixed_fare quoteSnapshot should not include trafficZoneCoefficient");
  }
  if(pfSnapshot.adjustedDistanceFareAmount != null){
    throw new Error(label + ": pre_fixed_fare quoteSnapshot should not include adjustedDistanceFareAmount");
  }
  if(dtSnapshot.trafficZoneCoefficient != null){
    throw new Error(label + ": distance_time quoteSnapshot should not include trafficZoneCoefficient");
  }

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
const testA = compareModes(config, baseState(), "testA");

console.log("=== Test B: traffic zone settings do not change fare ===");
const zoneCases = [
  { name: "coefficient 1.0", zone: { id: "test", label: "Test", coefficient: 1.0 } },
  { name: "coefficient 1.2", zone: { id: "test", label: "Test", coefficient: 1.2 } },
  { name: "coefficient 1.5", zone: { id: "test", label: "Test", coefficient: 1.5 } },
  { name: "fallback keiyo", preFixedFare: { trafficZoneId: "keiyo" } },
  { name: "unknown zone", preFixedFare: { trafficZoneId: "unknown-zone" } }
];

zoneCases.forEach(function(zoneCase){
  const zoneConfig = JSON.parse(JSON.stringify(config));
  if(zoneCase.zone){
    zoneConfig.trafficZones = { items: [zoneCase.zone] };
    zoneConfig.preFixedFare = { trafficZoneId: zoneCase.zone.id };
  }else if(zoneCase.preFixedFare){
    zoneConfig.preFixedFare = zoneCase.preFixedFare;
  }
  compareModes(zoneConfig, baseState(), "testB:" + zoneCase.name);
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
    name: "no time adjustment (<=20min)",
    state: baseState({
      routeCalcResult: { durationMinutes: 18 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 8500,
        durationSeconds: 1080,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 8500, durationSeconds: 1080 }]
      }
    })
  },
  {
    name: "time adjustment (>25min)",
    state: baseState({
      routeCalcResult: { durationMinutes: 28 },
      routePlan: {
        provider: "google_routes",
        distanceMeters: 8500,
        durationSeconds: 1680,
        selectedRouteId: "route_0",
        routes: [{ routeId: "route_0", distanceMeters: 8500, durationSeconds: 1680 }]
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

console.log("=== 8.5km distance fare verification ===");
const verifyState = baseState();
const billedKm = EstimateCalc.getEffectiveBilledDistanceKm(config, verifyState);
const rawDistanceFare = EstimateCalc.calcDistanceFare(billedKm, config.distancePricing);
const verifyResult = compareModes(config, verifyState, "verify8.5km");
const pattern = config.distancePricing?.patternA || {};
const incrementKm = FareConstants.resolveIncrementDistanceKm(pattern);
const excess = 8.5 - Number(pattern.initialDistanceKm || 0);
const increments = excess > 0 && incrementKm > 0 ? Math.ceil(excess / incrementKm) : 0;

console.log({
  stateDistanceKm: verifyState.distanceKm,
  getEffectiveBilledDistanceKm: billedKm,
  calcDistanceFareInputKm: billedKm,
  incrementDistanceMetersInConfig: pattern.incrementDistanceMeters,
  incrementDistanceKmResolved: incrementKm,
  excessKm: excess,
  incrementCount: increments,
  calcDistanceFareResult: rawDistanceFare,
  distanceFareInBreakdown: verifyResult.dt.distanceFare,
  timeFare: verifyResult.dt.timeFare,
  fareTotal: verifyResult.dt.fareTotal,
  serviceTotal: verifyResult.dt.serviceTotal,
  finalTotal: verifyResult.dt.total,
  distance_time: verifyResult.dt.total,
  pre_fixed_fare: verifyResult.pf.total,
  diff: verifyResult.pf.total - verifyResult.dt.total
});

console.log("\nAll fare-mode parity tests passed.");
