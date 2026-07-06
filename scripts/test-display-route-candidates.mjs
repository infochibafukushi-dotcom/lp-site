import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const displayCode = readFileSync(join(root, "shared/estimate-route-map-display.js"), "utf8");
const sandbox = { window: {}, globalThis: {} };
sandbox.window = sandbox.globalThis;
vm.runInNewContext(displayCode, sandbox);
const display = sandbox.window.EstimateRouteMapDisplay;

const legPlan = {
  routeCandidates: [
    { routeId: "route_0", routeStrategy: "time_priority", distanceMeters: 10000, encodedPolyline: "abcd" },
    { routeId: "route_1", routeStrategy: "general_road_priority", distanceMeters: 11000, encodedPolyline: "efgh" },
    { routeId: "route_2", routeStrategy: "shorter_distance", distanceMeters: 9000, encodedPolyline: "ijkl" },
    { routeId: "route_3", routeStrategy: "toll_allowed", distanceMeters: 8000, encodedPolyline: "mnop" }
  ]
};

const displayRoutes = display.getDisplayRouteCandidates(legPlan);
const strategies = displayRoutes.map((route) => route.routeStrategy);

if(strategies.length !== 4){
  throw new Error("Expected 4 display routes, got " + strategies.length);
}
if(strategies.join(",") !== "time_priority,general_road_priority,shorter_distance,toll_allowed"){
  throw new Error("Unexpected strategy order: " + strategies.join(","));
}

const fallbackLeg = {
  routeCandidates: [
    { routeId: "route_0", routeStrategy: "time_priority", distanceMeters: 10000 },
    { routeId: "route_1", routeStrategy: "general_road_priority", distanceMeters: 10000, isSyntheticRoute: true }
  ]
};
const fallbackRoutes = display.getDisplayRouteCandidates(fallbackLeg);
if(fallbackRoutes.length !== 2){
  throw new Error("Expected 2 routes with synthetic B, got " + fallbackRoutes.length);
}

const allSegments = [
  { key: "routeA", isAbRoute: true, path: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] },
  { key: "routeB", isAbRoute: true, path: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] }
];
const filtered = display.filterSegmentsByActiveStrategy(allSegments, "time_priority");
if(filtered.length !== 1 || filtered[0].key !== "routeA"){
  throw new Error("Expected only routeA segment when filtering by time_priority");
}

console.log("display route candidate tests passed");
