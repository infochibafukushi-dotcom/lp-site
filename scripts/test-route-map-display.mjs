import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const code = fs.readFileSync(path.join(root, "shared/estimate-route-map-display.js"), "utf8");
const sandbox = { window: {}, console };
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox, { filename: "estimate-route-map-display.js" });

const display = sandbox.EstimateRouteMapDisplay;

function encodeSigned(value){
  let signed = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while(signed >= 0x20){
    output += String.fromCharCode((0x20 | (signed & 0x1f)) + 63);
    signed >>= 5;
  }
  output += String.fromCharCode(signed + 63);
  return output;
}

function encodePolyline(points){
  let lastLat = 0;
  let lastLng = 0;
  let result = "";
  points.forEach(function(point){
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    result += encodeSigned(lat - lastLat);
    result += encodeSigned(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  });
  return result;
}

function makeLeg(pathPoints){
  const encodedPolyline = encodePolyline(pathPoints);
  return {
    selectedRouteId: "route_0",
    encodedPolyline: encodedPolyline,
    routes: [{ routeId: "route_0", encodedPolyline: encodedPolyline, distanceMeters: 1000 }]
  };
}

const outboundPath = [
  { lat: 35.60, lng: 140.10 },
  { lat: 35.61, lng: 140.11 },
  { lat: 35.62, lng: 140.12 }
];
const returnPath = [
  { lat: 35.62, lng: 140.12 },
  { lat: 35.615, lng: 140.105 },
  { lat: 35.61, lng: 140.10 },
  { lat: 35.60, lng: 140.10 }
];

const roundTripPlan = {
  tripType: "round_trip",
  returnPlanType: "same_return",
  outboundRoutePlan: makeLeg(outboundPath),
  returnRoutePlan: makeLeg(returnPath)
};

const sameReturnSegments = display.buildRouteMapSegments(roundTripPlan);
if(sameReturnSegments.length !== 1){
  throw new Error("same return should merge into 1 route segment, got " + sameReturnSegments.length);
}
if(sameReturnSegments[0].key !== "routeA" || sameReturnSegments[0].color !== "#C62828"){
  throw new Error("round trip should use routeA color, got " + sameReturnSegments[0].key);
}

const stopPlan = Object.assign({}, roundTripPlan, {
  returnPlanType: "return_with_stop",
  returnRoutePlan: Object.assign({}, roundTripPlan.returnRoutePlan, {
    waypoint: {
      waypointAddress: "薬局",
      waypointLatLng: { latitude: 35.615, longitude: 140.105 }
    }
  })
});
const stopSegments = display.buildRouteMapSegments(stopPlan, { lat: 35.615, lng: 140.105 });
if(stopSegments.length !== 1){
  throw new Error("stop return should merge into 1 route segment, got " + stopSegments.length);
}
if(stopSegments[0].key !== "routeA" || stopSegments[0].color !== "#C62828"){
  throw new Error("stop return should use routeA color");
}
if(stopSegments.some(function(segment){ return segment.key === "stop" || segment.key === "return" || segment.key === "outbound"; })){
  throw new Error("stop return must not use leg-type segment keys");
}
if(!display.shouldShowLegend(stopSegments)){
  throw new Error("legend should show for round trip");
}

const markers = display.buildRouteMapMarkers(stopPlan, stopSegments, { lat: 35.615, lng: 140.105 });
if(!markers.some(function(marker){ return marker.label === "寄"; })){
  throw new Error("waypoint marker expected");
}
const stopMarker = markers.find(function(marker){ return marker.label === "寄"; });
const mergedStopPath = stopSegments[0]?.path || [];
if(!mergedStopPath.some(function(point){
  return Math.abs(point.lat - stopMarker.position.lat) < 0.0001
    && Math.abs(point.lng - stopMarker.position.lng) < 0.0001;
})){
  throw new Error("waypoint marker should sit on merged route path");
}

const legStopPath = [
  { lat: 35.62, lng: 140.12 },
  { lat: 35.615, lng: 140.105 }
];
const legReturnPath = [
  { lat: 35.615, lng: 140.105 },
  { lat: 35.61, lng: 140.10 },
  { lat: 35.60, lng: 140.10 }
];
const legStopPlan = Object.assign({}, roundTripPlan, {
  returnPlanType: "return_with_stop",
  returnRoutePlan: Object.assign({}, roundTripPlan.returnRoutePlan, {
    routes: [{
      routeId: "route_0",
      encodedPolyline: encodePolyline(returnPath),
      distanceMeters: 2000,
      routeLegs: [
        { encodedPolyline: encodePolyline(legStopPath), endLatLng: { lat: 35.615, lng: 140.105 } },
        { encodedPolyline: encodePolyline(legReturnPath), startLatLng: { lat: 35.615, lng: 140.105 } }
      ]
    }],
    selectedRouteId: "route_0"
  })
});
const legStopSegments = display.buildRouteMapSegments(legStopPlan);
if(legStopSegments.length !== 1){
  throw new Error("routeLegs stop return should merge into 1 segment, got " + legStopSegments.length);
}
if(legStopSegments[0].key !== "routeA"){
  throw new Error("routeLegs stop return should use routeA key");
}

const legJunctionPlan = Object.assign({}, roundTripPlan, {
  returnPlanType: "return_with_stop",
  returnRoutePlan: Object.assign({}, roundTripPlan.returnRoutePlan, {
    routes: [{
      routeId: "route_0",
      encodedPolyline: encodePolyline(returnPath),
      distanceMeters: 2000,
      routeLegs: [
        { encodedPolyline: "", endLatLng: { lat: 35.615, lng: 140.105 } },
        { encodedPolyline: "", startLatLng: { lat: 35.615, lng: 140.105 } }
      ]
    }],
    selectedRouteId: "route_0"
  })
});
const legJunctionSegments = display.buildRouteMapSegments(legJunctionPlan);
if(legJunctionSegments.length !== 1){
  throw new Error("leg junction split should merge into 1 segment, got " + legJunctionSegments.length);
}
if(legJunctionSegments[0].key !== "routeA"){
  throw new Error("leg junction should use routeA key");
}

function makeAbLeg(pathPoints, strategy, routeId){
  const encodedPolyline = encodePolyline(pathPoints);
  return {
    selectedRouteId: routeId,
    encodedPolyline: encodedPolyline,
    routes: [{
      routeId: routeId,
      routeStrategy: strategy,
      encodedPolyline: encodedPolyline,
      distanceMeters: 1000
    }],
    routeCandidates: [{
      routeId: routeId,
      routeStrategy: strategy,
      encodedPolyline: encodedPolyline,
      distanceMeters: 1000
    }]
  };
}

const outboundAPath = [
  { lat: 35.60, lng: 140.10 },
  { lat: 35.61, lng: 140.11 },
  { lat: 35.62, lng: 140.12 }
];
const outboundBPath = [
  { lat: 35.60, lng: 140.10 },
  { lat: 35.605, lng: 140.115 },
  { lat: 35.62, lng: 140.12 }
];
const stopLegPath = [
  { lat: 35.62, lng: 140.12 },
  { lat: 35.615, lng: 140.105 }
];
const returnLegPath = [
  { lat: 35.615, lng: 140.105 },
  { lat: 35.60, lng: 140.10 }
];
const abStopPlan = {
  tripType: "round_trip",
  returnPlanType: "return_with_stop",
  outboundRoutePlan: Object.assign(
    makeAbLeg(outboundAPath, "time_priority", "route_a"),
    {
      routeCandidates: [
        { routeId: "route_a", routeStrategy: "time_priority", encodedPolyline: encodePolyline(outboundAPath), distanceMeters: 1000 },
        { routeId: "route_b", routeStrategy: "general_road_priority", encodedPolyline: encodePolyline(outboundBPath), distanceMeters: 1100 }
      ]
    }
  ),
  returnRoutePlan: Object.assign({}, makeLeg(returnPath), {
    routes: [{
      routeId: "route_0",
      routeStrategy: "recommended",
      encodedPolyline: encodePolyline(returnPath),
      distanceMeters: 2000,
      routeLegs: [
        { encodedPolyline: encodePolyline(stopLegPath), endLatLng: { lat: 35.615, lng: 140.105 } },
        { encodedPolyline: encodePolyline(returnLegPath), startLatLng: { lat: 35.615, lng: 140.105 } }
      ]
    }],
    waypoint: {
      waypointAddress: "東邦大医療センター佐倉",
      waypointLatLng: { latitude: 35.615, longitude: 140.105 }
    }
  })
};
const abStopSegments = display.buildDisplayRouteMapSegments(abStopPlan, { lat: 35.615, lng: 140.105 });
if(!abStopSegments.some(function(segment){ return segment.key === "routeA"; })){
  throw new Error("return_with_stop + AB outbound should keep routeA");
}
if(!abStopSegments.some(function(segment){ return segment.key === "routeB"; })){
  throw new Error("return_with_stop + AB outbound should keep routeB");
}
if(abStopSegments.some(function(segment){ return segment.key === "stop"; })){
  throw new Error("return_with_stop + AB outbound should not use stop segment colors");
}
if(abStopSegments.some(function(segment){ return segment.key === "return"; })){
  throw new Error("return_with_stop + AB outbound should not use return segment colors");
}
if(!abStopSegments.some(function(segment){
  return segment.key === "routeA" && segment.path.length >= outboundAPath.length;
})){
  throw new Error("return_with_stop + AB outbound should merge outbound and return into routeA");
}
const abStopLegendHtml = display.buildLegendHtml(abStopSegments);
if(/立ち寄り|復路|往路/.test(abStopLegendHtml)){
  throw new Error("legend must not include leg-based line labels");
}
if(!abStopLegendHtml.includes("A 赤線")){
  throw new Error("legend must include route A label");
}
if(!abStopLegendHtml.includes("B 青点線")){
  throw new Error("legend must include route B label");
}
const abStopMarkers = display.buildRouteMapMarkers(abStopPlan, abStopSegments, { lat: 35.615, lng: 140.105 });
if(!abStopMarkers.some(function(marker){ return marker.label === "寄"; })){
  throw new Error("return_with_stop + AB outbound should include waypoint marker");
}
const abRouteA = abStopSegments.find(function(segment){ return segment.key === "routeA"; });
if(abRouteA && !abRouteA.path.some(function(point){
  return Math.abs(point.lat - 35.615) < 0.0001 && Math.abs(point.lng - 140.105) < 0.0001;
})){
  throw new Error("merged routeA should pass through waypoint");
}

const displayStopSegments = display.buildDisplayRouteMapSegments(stopPlan, { lat: 35.615, lng: 140.105 });
if(displayStopSegments.some(function(segment){ return segment.key === "stop" || segment.key === "return"; })){
  throw new Error("display segments should use strategy colors instead of stop/return keys");
}
if(!displayStopSegments.some(function(segment){ return segment.key === "routeA"; })){
  throw new Error("display stop plan should include routeA-colored path");
}

const outboundCPath = [
  { lat: 35.60, lng: 140.10 },
  { lat: 35.605, lng: 140.105 },
  { lat: 35.62, lng: 140.12 }
];
const abFullPlan = {
  tripType: "round_trip",
  returnPlanType: "same_return",
  outboundRoutePlan: Object.assign(
    makeAbLeg(outboundAPath, "time_priority", "route_a"),
    {
      routeCandidates: [
        { routeId: "route_a", routeStrategy: "time_priority", encodedPolyline: encodePolyline(outboundAPath), distanceMeters: 1000 },
        { routeId: "route_b", routeStrategy: "general_road_priority", encodedPolyline: encodePolyline(outboundBPath), distanceMeters: 1100 },
        { routeId: "route_c", routeStrategy: "shorter_distance", encodedPolyline: encodePolyline(outboundCPath), distanceMeters: 900 }
      ]
    }
  ),
  returnRoutePlan: makeAbLeg(returnPath, "time_priority", "route_a")
};
const abFullSegments = display.buildDisplayRouteMapSegments(abFullPlan);
if(!abFullSegments.some(function(segment){ return segment.key === "routeC"; })){
  throw new Error("routeC segment expected when shorter_distance candidate exists");
}
if(!abFullSegments.some(function(segment){ return segment.key === "routeC" && segment.color === "#F9A825"; })){
  throw new Error("routeC should use yellow color");
}
const abFullLegendHtml = display.buildLegendHtml(abFullSegments);
if(!abFullLegendHtml.includes("C 黄線")){
  throw new Error("legend must include route C label");
}
if(/立ち寄り|復路|往路/.test(abFullLegendHtml)){
  throw new Error("legend must not include leg-based line labels");
}

function makeReturnLegWithStrategyCandidates(){
  const returnCommonPath = [
    { lat: 35.62, lng: 140.12 },
    { lat: 35.615, lng: 140.105 }
  ];
  const returnBPath = [
    { lat: 35.615, lng: 140.105 },
    { lat: 35.602, lng: 140.108 },
    { lat: 35.60, lng: 140.10 }
  ];
  const returnCPath = [
    { lat: 35.615, lng: 140.105 },
    { lat: 35.601, lng: 140.102 },
    { lat: 35.60, lng: 140.10 }
  ];
  const makeReturnRoute = function(strategy, routeId, selectablePath){
    return {
      routeId: routeId,
      routeStrategy: strategy,
      encodedPolyline: encodePolyline(selectablePath),
      distanceMeters: 1500,
      routeLegs: [
        { encodedPolyline: encodePolyline(returnCommonPath), endLatLng: { lat: 35.615, lng: 140.105 } },
        { encodedPolyline: encodePolyline(selectablePath), startLatLng: { lat: 35.615, lng: 140.105 } }
      ]
    };
  };
  return {
    selectedRouteId: "route_b",
    encodedPolyline: encodePolyline(returnBPath),
    routes: [
      makeReturnRoute("time_priority", "route_a", returnBPath),
      makeReturnRoute("general_road_priority", "route_b", returnBPath),
      makeReturnRoute("shorter_distance", "route_c", returnCPath),
      makeReturnRoute("toll_allowed", "route_d", returnCPath)
    ],
    routeCandidates: [
      makeReturnRoute("time_priority", "route_a", returnBPath),
      makeReturnRoute("general_road_priority", "route_b", returnBPath),
      makeReturnRoute("shorter_distance", "route_c", returnCPath),
      makeReturnRoute("toll_allowed", "route_d", returnCPath)
    ],
    waypoint: {
      waypointAddress: "立ち寄り先",
      waypointLatLng: { latitude: 35.615, longitude: 140.105 }
    }
  };
}

const abReturnStopFullPlan = {
  tripType: "round_trip",
  returnPlanType: "return_with_stop",
  outboundRoutePlan: Object.assign(
    makeAbLeg(outboundAPath, "time_priority", "route_a"),
    {
      routeCandidates: [
        { routeId: "route_a", routeStrategy: "time_priority", encodedPolyline: encodePolyline(outboundAPath), distanceMeters: 1000 },
        { routeId: "route_b", routeStrategy: "general_road_priority", encodedPolyline: encodePolyline(outboundBPath), distanceMeters: 1100 },
        { routeId: "route_c", routeStrategy: "shorter_distance", encodedPolyline: encodePolyline(outboundCPath), distanceMeters: 900 },
        { routeId: "route_d", routeStrategy: "toll_allowed", encodedPolyline: encodePolyline(outboundCPath), distanceMeters: 950 }
      ]
    }
  ),
  returnRoutePlan: makeReturnLegWithStrategyCandidates()
};
const strategyKeys = ["time_priority", "general_road_priority", "shorter_distance", "toll_allowed"];
strategyKeys.forEach(function(strategy){
  const mapKey = strategy === "time_priority" ? "routeA"
    : strategy === "general_road_priority" ? "routeB"
    : strategy === "shorter_distance" ? "routeC"
    : "routeD";
  const segments = display.buildDisplayRouteMapSegments(abReturnStopFullPlan, { lat: 35.615, lng: 140.105 }, {
    activeStrategy: strategy
  });
  if(segments.length !== 1 || segments[0].key !== mapKey){
    throw new Error(strategy + " active map should render one merged " + mapKey + " segment");
  }
  const path = segments[0].path || [];
  if(path.length < outboundAPath.length + 2){
    throw new Error(strategy + " merged path should include outbound and both return legs");
  }
  if(!path.some(function(point){
    return Math.abs(point.lat - 35.615) < 0.0001 && Math.abs(point.lng - 140.105) < 0.0001;
  })){
    throw new Error(strategy + " merged path should pass through waypoint");
  }
  if(Math.abs(path[0].lat - outboundAPath[0].lat) > 0.0001 || Math.abs(path[0].lng - outboundAPath[0].lng) > 0.0001){
    throw new Error(strategy + " merged path should start at outbound origin");
  }
  if(Math.abs(path[path.length - 1].lat - 35.60) > 0.0001 || Math.abs(path[path.length - 1].lng - 140.10) > 0.0001){
    throw new Error(strategy + " merged path should end at home");
  }
});

console.log("OK: route map display tests passed");
