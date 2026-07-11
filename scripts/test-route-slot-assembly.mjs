import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

function loadScripts(){
  const sandbox = { window: {}, globalThis: {}, console };
  sandbox.window = sandbox.globalThis;
  sandbox.global = sandbox.globalThis;
  const presentation = fs.readFileSync(path.join(root, "shared/pre-fixed-fare-route-presentation.js"), "utf8");
  const api = fs.readFileSync(path.join(root, "estimate/estimate-distance-api.js"), "utf8");
  vm.runInNewContext(presentation + "\n" + api, sandbox);
  return {
    presentation: sandbox.globalThis.PreFixedFareRoutePresentation,
    api: sandbox.globalThis.EstimateDistanceApi
  };
}

const { presentation, api } = loadScripts();

assert.equal(presentation.routeUsesToll({ tollInfo: null }), false);
assert.equal(presentation.routeUsesToll({ tollInfo: { estimatedPrice: [] } }), false);
assert.equal(presentation.routeUsesToll({ tollInfo: { estimatedPrice: {} } }), false);
assert.equal(presentation.routeUsesToll({
  tollInfo: { estimatedPrice: { currencyCode: "JPY", units: "320" } }
}), true);
assert.equal(presentation.routeUsesToll({
  roadType: "toll",
  routeStrategy: "toll_allowed",
  usesToll: true
}), false, "request intent alone must not count as toll usage");

const timeRoute = {
  routeStrategy: "time_priority",
  avoidHighways: false,
  avoidTolls: true,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "poly-a",
  distanceMeters: 10000,
  durationSeconds: 1200,
  roadType: "general"
};
const generalRoute = {
  routeStrategy: "general_road_priority",
  avoidHighways: true,
  avoidTolls: true,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "poly-a",
  distanceMeters: 10000,
  durationSeconds: 1200,
  roadType: "general"
};
const sameAsTime = {
  routeStrategy: "shorter_distance",
  avoidHighways: false,
  avoidTolls: true,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "poly-a",
  distanceMeters: 10000,
  durationSeconds: 1200
};
const fakeToll = {
  routeStrategy: "toll_allowed",
  avoidHighways: false,
  avoidTolls: false,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "poly-d",
  distanceMeters: 11000,
  durationSeconds: 900,
  roadType: "toll",
  usesToll: true
};
const realToll = Object.assign({}, fakeToll, {
  tollInfo: { estimatedPrice: [{ currencyCode: "JPY", units: "450" }] }
});
const distinctDistance = {
  routeStrategy: "shorter_distance",
  avoidHighways: false,
  avoidTolls: true,
  routingPreference: "TRAFFIC_UNAWARE",
  encodedPolyline: "poly-c",
  distanceMeters: 8500,
  durationSeconds: 1500
};

const slotsAbOnly = api.assembleStrategySlotRoutes({
  time_priority: timeRoute,
  general_road_priority: generalRoute,
  shorter_distance: sameAsTime,
  toll_allowed: fakeToll
});
assert.equal(Object.keys(slotsAbOnly).sort().join(","), "general_road_priority,time_priority");
assert.ok(slotsAbOnly.time_priority);
assert.ok(slotsAbOnly.general_road_priority);
assert.equal(slotsAbOnly.shorter_distance, undefined, "duplicate C must not be forced");
assert.equal(slotsAbOnly.toll_allowed, undefined, "D without toll evidence must not be shown");

const slotsWithCd = api.assembleStrategySlotRoutes({
  time_priority: timeRoute,
  general_road_priority: generalRoute,
  shorter_distance: distinctDistance,
  toll_allowed: realToll
});
assert.equal(Object.keys(slotsWithCd).sort().join(","), "general_road_priority,shorter_distance,time_priority,toll_allowed");
assert.equal(slotsWithCd.toll_allowed.usesToll, true);

const noTollPresentation = presentation.resolveRoutePresentation({
  routeStrategy: "toll_allowed",
  roadType: "toll",
  usesToll: true
}, "toll_allowed");
assert.equal(noTollPresentation.usesToll, false);

console.log("route slot assembly tests passed");
