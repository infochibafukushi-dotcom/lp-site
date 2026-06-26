import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function createSandbox(){
  const sandbox = { window: {}, globalThis: {}, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function loadScript(sandbox, relativePath){
  const code = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInNewContext(code, sandbox, { filename: relativePath });
}

const routeResponses = {
  "goal->stop": {
    routes: [{
      distanceMeters: 2100,
      duration: "420s",
      polyline: { encodedPolyline: "common_polyline" },
      legs: [{
        distanceMeters: 2100,
        duration: "420s",
        polyline: { encodedPolyline: "common_polyline" },
        startLocation: { latLng: { latitude: 35.62, longitude: 140.12 } },
        endLocation: { latLng: { latitude: 35.58, longitude: 140.13 } }
      }]
    }]
  },
  "stop->home-pool": {
    routes: [
      {
        distanceMeters: 4800,
        duration: "840s",
        polyline: { encodedPolyline: "selectable_polyline_a" },
        legs: [{
          distanceMeters: 4800,
          duration: "840s",
          polyline: { encodedPolyline: "selectable_polyline_a" }
        }]
      },
      {
        distanceMeters: 5200,
        duration: "720s",
        polyline: { encodedPolyline: "selectable_polyline_b" },
        travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: "JPY", units: "1200" }] } },
        legs: [{
          distanceMeters: 5200,
          duration: "720s",
          polyline: { encodedPolyline: "selectable_polyline_b" }
        }]
      }
    ]
  },
  "stop->home-toll": {
    routes: [
      {
        distanceMeters: 4800,
        duration: "840s",
        polyline: { encodedPolyline: "selectable_polyline_a" },
        legs: [{ distanceMeters: 4800, duration: "840s", polyline: { encodedPolyline: "selectable_polyline_a" } }]
      },
      {
        distanceMeters: 5400,
        duration: "720s",
        polyline: { encodedPolyline: "selectable_polyline_toll" },
        travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: "JPY", units: "1500" }] } },
        legs: [{ distanceMeters: 5400, duration: "720s", polyline: { encodedPolyline: "selectable_polyline_toll" } }]
      }
    ]
  }
};

function buildFetch(){
  return async function mockFetch(url, options){
    const body = JSON.parse(options.body || "{}");
    const origin = body.origin?.address || "";
    const destination = body.destination?.address || "";
    let key = "";
    if(origin.includes("医療センター") && destination.includes("ディズニー")){
      key = "goal->stop";
    }else if(origin.includes("ディズニー") && destination.includes("出洲港")){
      key = body.computeAlternativeRoutes ? "stop->home-toll" : "stop->home-pool";
    }else if(origin.includes("メディカル") && destination.includes("蘇我")){
      key = "goal->stop";
    }else if(origin.includes("蘇我") && destination.includes("出洲港")){
      key = body.computeAlternativeRoutes ? "stop->home-toll" : "stop->home-pool";
    }
    const payload = routeResponses[key] || { routes: [] };
    return {
      ok: true,
      async json(){
        return payload;
      }
    };
  };
}

const sandbox = createSandbox();
loadScript(sandbox, "shared/pre-fixed-fare-route-presentation.js");
loadScript(sandbox, "shared/pre-fixed-fare-route-waypoints.js");
sandbox.fetch = buildFetch();
loadScript(sandbox, "estimate/estimate-distance-api.js");

const api = sandbox.EstimateDistanceApi;
const outboundRoute = {
  routeId: "route_0",
  routeStrategy: "recommended",
  routeLabel: "おすすめルート",
  routeDescription: "時間と距離のバランスを考慮した標準的なルートです。",
  distanceMeters: 3300,
  durationSeconds: 540,
  encodedPolyline: "outbound_polyline"
};

async function verifyCase(testCase){
  const split = await api.computeReturnWithStopOverallRouteSelection(Object.assign({
    apiKey: "test-key",
    outboundRoute,
    outboundRouteCandidates: [outboundRoute],
    roadType: "toll",
    languageCode: "ja",
    region: "JP"
  }, testCase));
  const overall = split.overallRouteSelection;
  const checks = {
    hasOverallRouteSelection: Boolean(overall),
    commonSegmentsLength: overall?.commonSegments?.length || 0,
    hasSelectableSegment: Boolean(overall?.selectableSegment?.key === "return_selectable"),
    overallRouteCandidatesLength: overall?.overallRouteCandidates?.length || 0,
    routeLabels: (overall?.overallRouteCandidates || []).map((item) => item.routeLabel),
    totalDistanceMeters: (overall?.overallRouteCandidates || []).map((item) => item.totalDistanceMeters),
    usesToll: (overall?.overallRouteCandidates || []).map((item) => item.usesToll),
    hasReturnLegApiResult: Boolean(split.returnLegApiResult?.routes?.length)
  };
  if(checks.commonSegmentsLength !== 2){
    throw new Error(testCase.name + ": commonSegments length expected 2");
  }
  if(!checks.hasSelectableSegment){
    throw new Error(testCase.name + ": selectableSegment missing");
  }
  if(checks.overallRouteCandidatesLength < 1){
    throw new Error(testCase.name + ": overallRouteCandidates empty");
  }
  if(!checks.routeLabels.every(Boolean)){
    throw new Error(testCase.name + ": routeLabel missing " + JSON.stringify(checks.routeLabels));
  }
  if(!checks.totalDistanceMeters.every((value) => value > 0)){
    throw new Error(testCase.name + ": totalDistanceMeters missing");
  }
  return checks;
}

const results = await Promise.all([
  verifyCase({
    name: "funabashi-disney",
    homeAddress: "千葉市中央区出洲港8-3-2",
    goalAddress: "船橋市立医療センター",
    stopAddress: "東京ディズニーランド"
  }),
  verifyCase({
    name: "chiba-medical-soga",
    homeAddress: "千葉市中央区出洲港8-3-2",
    goalAddress: "千葉メディカルセンター",
    stopAddress: "蘇我駅"
  })
]);

console.log(JSON.stringify({ ok: true, results }, null, 2));
