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
    { routeId: "route_0", routeStrategy: "time_priority", distanceMeters: 10000 },
    { routeId: "route_1", routeStrategy: "general_road_priority", distanceMeters: 11000 },
    { routeId: "route_2", routeStrategy: "shorter_distance", distanceMeters: 9000 },
    { routeId: "route_3", routeStrategy: "toll_allowed", distanceMeters: 8000 }
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
    { routeId: "route_1", routeStrategy: "confirmation_fallback", isConfirmationFallback: true, distanceMeters: 10000 }
  ]
};
const fallbackRoutes = display.getDisplayRouteCandidates(fallbackLeg);
if(fallbackRoutes.length !== 2){
  throw new Error("Expected 2 routes with confirmation fallback, got " + fallbackRoutes.length + " (" + fallbackRoutes.map((r) => r.routeStrategy).join(",") + ")");
}
const fallbackRoute = fallbackRoutes.find((route) => route.routeStrategy === "confirmation_fallback");
if(!fallbackRoute){
  throw new Error("Missing confirmation fallback route in display list");
}
if(display.isMapRenderableRoute(fallbackRoute)){
  throw new Error("Confirmation fallback should not be map-renderable");
}

console.log("display route candidate tests passed");
