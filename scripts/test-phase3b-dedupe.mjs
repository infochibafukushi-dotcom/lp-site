import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

function loadPresentation(){
  const code = fs.readFileSync(path.join(root, "shared/pre-fixed-fare-route-presentation.js"), "utf8");
  vm.runInThisContext(code);
  return global.PreFixedFareRoutePresentation;
}

function getRouteRoutingFingerprint(route){
  return [
    route?.avoidHighways === true ? "1" : "0",
    route?.avoidTolls === true ? "1" : "0",
    String(route?.routingPreference || "TRAFFIC_AWARE"),
    String(route?.intermediateWaypoint?.waypointId || "")
  ].join("|");
}

function isDuplicateRoute(left, right){
  if(!left || !right){
    return false;
  }
  if(getRouteRoutingFingerprint(left) !== getRouteRoutingFingerprint(right)){
    return false;
  }
  const polyLeft = String(left.encodedPolyline || "");
  const polyRight = String(right.encodedPolyline || "");
  if(polyLeft && polyRight && polyLeft === polyRight){
    return true;
  }
  const distLeft = Number(left.distanceMeters) || 0;
  const distRight = Number(right.distanceMeters) || 0;
  const durLeft = Number(left.durationSeconds) || 0;
  const durRight = Number(right.durationSeconds) || 0;
  if(distLeft > 0 && distRight > 0 && distLeft === distRight && durLeft === durRight){
    return true;
  }
  if(distLeft > 0 && distRight > 0 && Math.abs(distLeft - distRight) < 100){
    if(Math.abs(durLeft - durRight) < 60){
      return true;
    }
  }
  return false;
}

const presentation = loadPresentation();

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

assert.equal(isDuplicateRoute(timeRoute, generalRoute), false, "different routing fingerprints must not dedupe");

const timeRouteCopy = Object.assign({}, timeRoute, { routeStrategy: "recommended" });
assert.equal(isDuplicateRoute(timeRoute, timeRouteCopy), true, "same fingerprint and polyline must dedupe");

const nearTimeRoute = Object.assign({}, timeRoute, {
  routeStrategy: "pool_candidate",
  distanceMeters: 1250,
  durationSeconds: 330
});
assert.equal(isDuplicateRoute(timeRoute, nearTimeRoute), true, "near metrics with same fingerprint must dedupe");

const resolved = presentation.resolveRoutePresentation({
  routeStrategy: "time_priority",
  usesToll: true,
  tollInfo: { estimatedPrice: { units: "1" } }
}, "time_priority");
assert.equal(resolved.routeLabel, "時間優先（有料道）");
assert.match(resolved.routeDescription, /別途必要/);

console.log("phase3b unit tests passed");
