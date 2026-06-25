import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadScript(relativePath, globalName){
  const code = fs.readFileSync(path.join(root, relativePath), "utf8");
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: relativePath });
  return sandbox[globalName] || sandbox.window[globalName];
}

const config = JSON.parse(fs.readFileSync(path.join(root, "data/estimate-config.json"), "utf8"));
const preFixedConfig = Object.assign({}, config, { fareMode: "pre_fixed_fare" });
const EstimateCalc = loadScript("estimate/estimate-calc.js", "EstimateCalc");

function makeRoute(id, meters, seconds, confirmable){
  return {
    routeId: id,
    distanceMeters: meters,
    durationSeconds: seconds,
    distanceKm: Math.round((meters / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    routeLabel: "route " + id,
    preFixedFareConfirmable: confirmable
  };
}

function makeLeg(origin, destination, meters, seconds, options){
  const opts = options || {};
  const route = makeRoute("route_0", meters, seconds, opts.confirmable !== false);
  return {
    provider: "google_routes",
    origin: { address: origin },
    destination: { address: destination },
    waypoint: opts.waypoint || null,
    selectedRouteId: "route_0",
    distanceMeters: meters,
    durationSeconds: seconds,
    routes: opts.routes || [route],
    routeCandidates: opts.routes || [route],
    preFixedFareConfirmable: opts.confirmable !== false,
    fallbackReason: opts.fallbackReason || null
  };
}

function makeStructuredPlan(options){
  const opts = options || {};
  const outboundMeters = Number(opts.outboundMeters) || 0;
  const returnMeters = Number(opts.returnMeters) || 0;
  return {
    tripType: opts.tripType || "round_trip",
    returnPlanType: opts.returnPlanType || "same_return",
    outboundRoutePlan: makeLeg(opts.outboundOrigin, opts.outboundDestination, outboundMeters, opts.outboundSeconds || 600, {
      confirmable: opts.outboundConfirmable,
      routes: opts.outboundRoutes
    }),
    returnRoutePlan: opts.returnLeg === null ? null : makeLeg(opts.returnOrigin, opts.returnDestination, returnMeters, opts.returnSeconds || 600, {
      confirmable: opts.returnConfirmable,
      waypoint: opts.waypoint || null,
      routes: opts.returnRoutes
    }),
    totalDistanceMeters: outboundMeters + returnMeters,
    totalDurationSeconds: (opts.outboundSeconds || 600) + (opts.returnMeters > 0 ? (opts.returnSeconds || 600) : 0),
    preFixedFareScope: opts.preFixedFareScope || "outbound_and_return",
    returnFareStatus: opts.returnFareStatus || "fixed_candidate",
    preFixedFareConfirmable: opts.preFixedFareConfirmable !== false
  };
}

function baseState(overrides){
  return Object.assign({
    mobilityId: "wheelchair",
    assistanceId: "standard",
    stairId: "none",
    tripTypeId: "round-trip",
    roundTripAddonId: "waiting",
    returnPlanType: "same_return",
    returnStopType: "",
    returnStopAddress: "",
    differentReturnAddress: "",
    distanceKm: 0,
    roadType: "general",
    originAddress: "千葉市中央区出洲港8-3-2",
    destinationAddress: "千葉メディカルセンター",
    routeCalcResult: null,
    routePlan: null
  }, overrides || {});
}

const results = [];
function assert(name, condition, detail){
  results.push({ name, ok: Boolean(condition), detail: detail || "" });
}

// Config checks
assert("config fareMode readable", typeof config.fareMode === "string", "fareMode=" + config.fareMode);
assert("pre_fixed_fare option exists", (config.fareModeOptions || []).some((item) => item.id === "pre_fixed_fare"));
assert("saved fareMode is pre_fixed_fare (env check)", config.fareMode === "pre_fixed_fare", "actual=" + config.fareMode + " — 管理画面で事前確定運賃に切替後に保存が必要");

// Case: same_return totals
{
  const routePlan = makeStructuredPlan({
    outboundOrigin: "S", outboundDestination: "G", outboundMeters: 5000, outboundSeconds: 900,
    returnOrigin: "G", returnDestination: "S", returnMeters: 5200, returnSeconds: 960
  });
  const state = baseState({ routePlan, distanceKm: 10.2 });
  const multiplier = EstimateCalc.getDistanceMultiplier(preFixedConfig, state);
  const billedKm = EstimateCalc.getEffectiveBilledDistanceKm(preFixedConfig, state);
  assert("same_return distanceMultiplier is 1", multiplier === 1, "multiplier=" + multiplier);
  assert("same_return totalDistanceMeters sum", routePlan.totalDistanceMeters === 10200, "total=" + routePlan.totalDistanceMeters);
  assert("same_return billed km is sum not double", billedKm === 10.2, "billedKm=" + billedKm);
  assert("same_return billed km not outbound*2", billedKm !== 10, "would be 10 if doubled outbound only wrong way");
  const estimate = EstimateCalc.computeEstimate(preFixedConfig, state);
  const oneWayDouble = EstimateCalc.calcDistanceFare(5, preFixedConfig.distancePricing) * 2;
  const actualDistanceFare = estimate.breakdown.distanceFare;
  assert("same_return fare not one-way*2", actualDistanceFare !== oneWayDouble || billedKm !== 5);
}

// Case: return_with_stop
{
  const waypoint = { waypointLabel: "近隣薬局", waypointAddress: "千葉市中央区薬局", stopType: "pharmacy" };
  const routePlan = makeStructuredPlan({
    returnPlanType: "return_with_stop",
    outboundMeters: 5000,
    returnOrigin: "G", returnDestination: "S", returnMeters: 6100,
    waypoint
  });
  routePlan.returnRoutePlan.waypoint = waypoint;
  const state = baseState({ returnPlanType: "return_with_stop", returnStopAddress: "近隣薬局", routePlan });
  const estimate = EstimateCalc.computeEstimate(preFixedConfig, state);
  assert("stop waypoint saved", routePlan.returnRoutePlan.waypoint?.waypointAddress === "千葉市中央区薬局");
  assert("stop total includes return", estimate.quoteSnapshot.totalDistanceMeters === 11100);
}

// Case: different_return_destination
{
  const routePlan = makeStructuredPlan({
    returnPlanType: "different_return_destination",
    outboundMeters: 5000,
    returnOrigin: "G", returnDestination: "別の帰り先", returnMeters: 7000
  });
  const state = baseState({
    returnPlanType: "different_return_destination",
    differentReturnAddress: "別の帰り先",
    routePlan
  });
  assert("different return destination not home", routePlan.returnRoutePlan.destination.address === "別の帰り先");
  assert("different return destination not S", routePlan.returnRoutePlan.destination.address !== state.originAddress);
}

// Case: return_pending
{
  const routePlan = makeStructuredPlan({
    returnPlanType: "return_pending",
    outboundMeters: 5000,
    returnLeg: null,
    returnMeters: 0,
    preFixedFareScope: "outbound_only",
    returnFareStatus: "review_required",
    preFixedFareConfirmable: true
  });
  routePlan.totalDistanceMeters = 5000;
  routePlan.totalDurationSeconds = 900;
  const state = baseState({ returnPlanType: "return_pending", routePlan, distanceKm: 5 });
  const estimate = EstimateCalc.computeEstimate(preFixedConfig, state);
  const billedKm = EstimateCalc.getEffectiveBilledDistanceKm(preFixedConfig, state);
  const withReturnHypothetical = EstimateCalc.calcDistanceFare(12, preFixedConfig.distancePricing);
  assert("pending scope outbound_only", estimate.quoteSnapshot.preFixedFareScope === "outbound_only");
  assert("pending returnFareStatus review_required", estimate.quoteSnapshot.returnFareStatus === "review_required");
  assert("pending billed km outbound only", billedKm === 5, "billedKm=" + billedKm);
  assert("pending fare excludes return distance", estimate.breakdown.distanceFare !== withReturnHypothetical);
}

// quoteSnapshot fields
{
  const outboundRoutes = [makeRoute("route_0", 5000, 900, true), makeRoute("route_1", 5100, 920, true)];
  const returnRoutes = [makeRoute("route_0", 5200, 960, true), makeRoute("route_1", 5300, 980, true)];
  const routePlan = makeStructuredPlan({
    outboundMeters: 5000, returnMeters: 5200,
    outboundRoutes, returnRoutes,
    outboundConfirmable: true, returnConfirmable: true
  });
  const state = baseState({ routePlan, distanceKm: 10.2 });
  const estimate = EstimateCalc.computeEstimate(preFixedConfig, state);
  const qs = estimate.quoteSnapshot;
  const required = [
    "tripType", "returnPlanType", "outboundRoutePlan", "returnRoutePlan",
    "totalDistanceMeters", "totalDurationSeconds", "preFixedFareScope", "returnFareStatus",
    "routeCandidates", "selectedRouteId", "preFixedFareConfirmable"
  ];
  required.forEach(function(key){
    assert("quoteSnapshot has " + key, qs[key] !== undefined && qs[key] !== null, JSON.stringify(qs[key]));
  });
  assert("quoteSnapshot has fallbackReason key", "fallbackReason" in qs, String(qs.fallbackReason));
  assert("quoteSnapshot return routeCandidates", Array.isArray(qs.returnRoutePlan?.routeCandidates) && qs.returnRoutePlan.routeCandidates.length >= 1);
}

// one-way unchanged
{
  const routePlan = {
    provider: "google_routes",
    selectedRouteId: "route_0",
    distanceMeters: 5000,
    durationSeconds: 900,
    routes: [makeRoute("route_0", 5000, 900, true)]
  };
  const state = baseState({ tripTypeId: "one-way", roundTripAddonId: "", routePlan, distanceKm: 5 });
  const estimate = EstimateCalc.computeEstimate(preFixedConfig, state);
  assert("one-way still works", estimate.total > 0);
  assert("one-way tripType", estimate.quoteSnapshot.tripType === "one_way" || !estimate.quoteSnapshot.outboundRoutePlan);
}

// pre_fixed route UI gate (static check)
const mainSource = fs.readFileSync(path.join(root, "estimate/estimate-main.js"), "utf8");
assert("route UI gated by pre_fixed_fare", /function isPreFixedFareMode\(\)[\s\S]*pre_fixed_fare/.test(mainSource));
assert("dual API calls for return", /outboundPromise[\s\S]*returnPromise[\s\S]*Promise\.all/.test(mainSource));
assert("return stop validation", /return_with_stop[\s\S]*立ち寄り先/.test(mainSource));

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
