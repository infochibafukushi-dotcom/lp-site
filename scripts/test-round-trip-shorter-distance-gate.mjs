import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

function loadApi(){
  const sandbox = { window: {}, globalThis: {}, console };
  sandbox.window = sandbox.globalThis;
  sandbox.global = sandbox.globalThis;
  const presentation = fs.readFileSync(path.join(root, "shared/pre-fixed-fare-route-presentation.js"), "utf8");
  const api = fs.readFileSync(path.join(root, "estimate/estimate-distance-api.js"), "utf8");
  vm.runInNewContext(presentation + "\n" + api, sandbox);
  return sandbox.globalThis.EstimateDistanceApi;
}

const api = loadApi();
const mainSource = fs.readFileSync(path.join(root, "estimate/estimate-main.js"), "utf8");

function pair(strategy, totalDistanceMeters){
  return {
    strategy: strategy,
    totalDistanceMeters: totalDistanceMeters,
    outboundDistanceMeters: Math.floor(totalDistanceMeters / 2),
    returnDistanceMeters: Math.ceil(totalDistanceMeters / 2)
  };
}

const basePairs = [
  pair("time_priority", 6400),
  pair("general_road_priority", 6400),
  pair("shorter_distance", 6800),
  pair("toll_allowed", 7200)
];

const filteredLonger = api.filterRoundTripPairsByShorterDistance(basePairs);
assert.equal(
  filteredLonger.some(function(item){ return item.strategy === "shorter_distance"; }),
  false,
  "round-trip C longer than A/B totals must be hidden"
);
assert.equal(
  filteredLonger.map(function(item){ return item.strategy; }).join(","),
  "time_priority,general_road_priority,toll_allowed",
  "A/B/D must remain when C is filtered"
);

const equalPairs = [
  pair("time_priority", 6400),
  pair("general_road_priority", 6400),
  pair("shorter_distance", 6400)
];
assert.equal(
  api.filterRoundTripPairsByShorterDistance(equalPairs).some(function(item){
    return item.strategy === "shorter_distance";
  }),
  false,
  "round-trip C equal to A/B totals must be hidden"
);

const shorterPairs = [
  pair("time_priority", 6400),
  pair("general_road_priority", 6400),
  pair("shorter_distance", 6100),
  pair("toll_allowed", 7000)
];
const filteredShorter = api.filterRoundTripPairsByShorterDistance(shorterPairs);
assert.ok(
  filteredShorter.some(function(item){ return item.strategy === "shorter_distance"; }),
  "round-trip C shorter than both A and B totals must stay visible"
);

// One-way legs can each look "short enough" in isolation for a synthetic case,
// but the combined C total is still longer than A/B totals.
const mixedLegPairs = [
  {
    strategy: "time_priority",
    totalDistanceMeters: 6000,
    outboundDistanceMeters: 3000,
    returnDistanceMeters: 3000
  },
  {
    strategy: "general_road_priority",
    totalDistanceMeters: 6000,
    outboundDistanceMeters: 3000,
    returnDistanceMeters: 3000
  },
  {
    strategy: "shorter_distance",
    totalDistanceMeters: 6300,
    outboundDistanceMeters: 2800,
    returnDistanceMeters: 3500
  }
];
assert.equal(
  api.filterRoundTripPairsByShorterDistance(mixedLegPairs).some(function(item){
    return item.strategy === "shorter_distance";
  }),
  false,
  "C must hide when round-trip total is longer even if one leg is shorter"
);

const longTripPairs = [
  pair("time_priority", 83418),
  pair("general_road_priority", 83418),
  pair("shorter_distance", 78500),
  pair("toll_allowed", 86426)
];
assert.ok(
  api.filterRoundTripPairsByShorterDistance(longTripPairs).some(function(item){
    return item.strategy === "shorter_distance";
  }),
  "genuinely shorter long-distance round-trip C must remain visible"
);

assert.match(
  mainSource,
  /filterRoundTripPairsByShorterDistance/,
  "estimate-main must apply the round-trip shorter-distance gate"
);
assert.match(
  mainSource,
  /pruneInvalidRoundTripShorterDistance/,
  "estimate-main must prune invalid C candidates from round-trip legs"
);
assert.match(
  mainSource,
  /pair\.strategy === "time_priority"/,
  "estimate-main must fall back to A when selected C becomes invalid"
);
assert.match(
  mainSource,
  /getSelectedRouteCtaPrefix|abInfo\.abLabel \+ "ルート"/,
  "CTA prefix wiring must remain intact"
);
assert.match(
  mainSource,
  /function buildHandoffRecord/,
  "reservation handoff builder must remain intact"
);
assert.doesNotMatch(
  mainSource,
  /filterRoundTripPairsByShorterDistance\([^\)]*toll_allowed/,
  "D must not be specially filtered by the C distance gate"
);

console.log("round-trip shorter-distance gate tests passed");
