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

assert.equal(
  presentation.resolveTimePriorityLabel({ usesToll: false }),
  "時間優先ルート"
);
assert.equal(
  presentation.resolveTimePriorityLabel({ tollInfo: { estimatedPrice: { currencyCode: "JPY", units: "500" } } }),
  "時間優先（有料道）"
);
assert.equal(
  presentation.resolveTimePriorityLabel({ usesToll: true }),
  "時間優先ルート",
  "usesToll flag alone must not imply toll usage"
);

const timeRoute = {
  routeStrategy: "time_priority",
  avoidHighways: false,
  avoidTolls: false,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "abc",
  distanceMeters: 1200,
  durationSeconds: 300
};
const generalRoute = {
  routeStrategy: "general_road_priority",
  avoidHighways: true,
  avoidTolls: true,
  routingPreference: "TRAFFIC_AWARE",
  encodedPolyline: "abc",
  distanceMeters: 1200,
  durationSeconds: 300
};
const distinctGeneralRoute = Object.assign({}, generalRoute, {
  encodedPolyline: "def",
  distanceMeters: 1500,
  durationSeconds: 420
});

assert.equal(
  api.isDuplicateRoute(timeRoute, generalRoute),
  true,
  "same polyline must dedupe even across A/B routing fingerprints"
);
assert.equal(
  api.isDuplicateRoute(timeRoute, distinctGeneralRoute),
  false,
  "different polyline with different fingerprint must not dedupe"
);

const timeRouteCopy = Object.assign({}, timeRoute, { routeStrategy: "recommended" });
assert.equal(api.isDuplicateRoute(timeRoute, timeRouteCopy), true, "same fingerprint and polyline must dedupe");

const nearTimeRoute = Object.assign({}, timeRoute, {
  routeStrategy: "pool_candidate",
  encodedPolyline: "near-abc",
  distanceMeters: 1250,
  durationSeconds: 330
});
assert.equal(api.isDuplicateRoute(timeRoute, nearTimeRoute), true, "near metrics with same fingerprint must dedupe");

const resolved = presentation.resolveRoutePresentation({
  routeStrategy: "time_priority",
  usesToll: true,
  tollInfo: { estimatedPrice: { units: "1" } }
}, "time_priority");
assert.equal(resolved.routeLabel, "時間優先（有料道）");
assert.match(resolved.routeDescription, /別途必要/);

console.log("phase3b unit tests passed");
