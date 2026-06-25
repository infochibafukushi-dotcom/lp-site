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
if(sameReturnSegments.length !== 2){
  throw new Error("same return should have 2 segments, got " + sameReturnSegments.length);
}
if(sameReturnSegments[0].key !== "outbound" || sameReturnSegments[0].color !== "#1565C0"){
  throw new Error("outbound segment mismatch");
}
if(sameReturnSegments[1].key !== "return" || sameReturnSegments[1].color !== "#C62828"){
  throw new Error("return segment mismatch");
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
if(stopSegments.length !== 3){
  throw new Error("stop return should have 3 segments, got " + stopSegments.length);
}
if(stopSegments[1].key !== "stop" || stopSegments[1].color !== "#2E7D32"){
  throw new Error("stop segment mismatch");
}
if(stopSegments[2].key !== "return" || stopSegments[2].color !== "#C62828"){
  throw new Error("return-after-stop segment mismatch");
}
if(!display.shouldShowLegend(stopSegments)){
  throw new Error("legend should show for round trip");
}

const markers = display.buildRouteMapMarkers(stopPlan, stopSegments, { lat: 35.615, lng: 140.105 });
if(!markers.some(function(marker){ return marker.label === "寄"; })){
  throw new Error("waypoint marker expected");
}
const stopMarker = markers.find(function(marker){ return marker.label === "寄"; });
if(!stopSegments[1] || !stopSegments[1].path.some(function(point){
  return Math.abs(point.lat - stopMarker.position.lat) < 0.0001
    && Math.abs(point.lng - stopMarker.position.lng) < 0.0001;
})){
  throw new Error("waypoint marker should sit on green segment");
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
if(legStopSegments.length !== 3){
  throw new Error("routeLegs stop return should have 3 segments, got " + legStopSegments.length);
}
if(legStopSegments[1].key !== "stop" || legStopSegments[1].color !== "#2E7D32"){
  throw new Error("routeLegs stop segment mismatch");
}
if(legStopSegments[2].key !== "return" || legStopSegments[2].color !== "#C62828"){
  throw new Error("routeLegs return segment mismatch");
}

console.log("OK: route map display tests passed");
