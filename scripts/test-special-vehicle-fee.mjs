import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vm = require("node:vm");

function loadBrowserModule(relativePath, globals){
  const code = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    console: console
  };
  Object.assign(sandbox, globals || {});
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(code, sandbox, { filename: relativePath });
  return sandbox.window;
}

const defaultsWindow = loadBrowserModule("../shared/estimate-defaults.js");
const trafficZoneWindow = loadBrowserModule("../shared/estimate-traffic-zone.js", {
  EstimateDefaults: defaultsWindow.EstimateDefaults
});
const calcWindow = loadBrowserModule("../estimate/estimate-calc.js", {
  EstimateTrafficZone: trafficZoneWindow.EstimateTrafficZone
});
const displayWindow = loadBrowserModule("../shared/estimate-fare-display.js");

const EstimateCalc = calcWindow.EstimateCalc;
const EstimateFareDisplay = displayWindow.EstimateFareDisplay;
const createDefaultEstimateConfig = defaultsWindow.EstimateDefaults.createDefaultEstimateConfig;

function baseState(){
  return {
    mobilityId: "free-wheelchair",
    assistanceId: "boarding-assist",
    stairId: "stair-none",
    tripTypeId: "one-way",
    roundTripAddonId: "",
    distanceKm: 5,
    roadType: "general",
    routeCalcResult: { durationMinutes: 25 },
    routePlan: {
      provider: "google_routes",
      distanceMeters: 5000,
      durationSeconds: 1500
    }
  };
}

function runScenario(name, feeConfig){
  const config = createDefaultEstimateConfig();
  config.fareMode = "distance_time";
  config.basicFees.specialVehicleFee = Object.assign(
    {},
    config.basicFees.specialVehicleFee,
    feeConfig
  );

  const result = EstimateCalc.computeEstimate(config, baseState());
  const snapshot = result.quoteSnapshot;
  const emailText = EstimateFareDisplay.buildFareCalculationEmailText({
    quoteSnapshot: snapshot,
    breakdown: result.breakdown,
    total: result.total,
    routePlan: result.routePlan
  });

  const careServiceRows = (snapshot.serviceFees || []).filter((row) => row.amount > 0);
  const fixedRows = (snapshot.fixedFareBreakdown || []).filter((row) => row.key !== "specialVehicleFee");

  return {
    name: name,
    total: result.total,
    specialVehicleFeeEnabled: snapshot.specialVehicleFeeEnabled,
    specialVehicleFeeAmount: snapshot.specialVehicleFeeAmount,
    careServiceRows: careServiceRows.map((row) => `${row.label}: ${row.amount}`),
    fixedFareOrder: (snapshot.fixedFareBreakdown || []).map((row) => row.key),
    emailHasSpecialFee: emailText.includes("特殊車両使用料"),
    emailSpecialLine: (emailText.match(/特殊車両使用料：.+/u) || [])[0] || null,
    calcLines: EstimateFareDisplay.buildFareCalculationLines({
      quoteSnapshot: snapshot,
      breakdown: result.breakdown,
      total: result.total,
      routePlan: result.routePlan
    }).filter((line) => line.label === "特殊車両使用料")
  };
}

const scenarios = [
  runScenario("enabled-1000", { visible: true, amount: 1000 }),
  runScenario("enabled-1500", { visible: true, amount: 1500 }),
  runScenario("disabled", { visible: false, amount: 1000 })
];

let failed = 0;
for(const scenario of scenarios){
  console.log("\n=== " + scenario.name + " ===");
  console.log(JSON.stringify(scenario, null, 2));

  if(scenario.name === "enabled-1000"){
    if(scenario.specialVehicleFeeAmount !== 1000) failed++;
    if(!scenario.careServiceRows.some((row) => row.includes("1000"))) failed++;
    if(!scenario.emailHasSpecialFee) failed++;
    if(scenario.fixedFareOrder.indexOf("specialVehicleFee") <= scenario.fixedFareOrder.indexOf("pickupFee")) failed++;
  }
  if(scenario.name === "enabled-1500"){
    if(scenario.specialVehicleFeeAmount !== 1500) failed++;
    if(!scenario.careServiceRows.some((row) => row.includes("1500"))) failed++;
  }
  if(scenario.name === "disabled"){
    if(scenario.specialVehicleFeeAmount !== 0) failed++;
    if(scenario.specialVehicleFeeEnabled !== false) failed++;
    if(scenario.careServiceRows.some((row) => row.includes("特殊車両"))) failed++;
    if(scenario.emailHasSpecialFee) failed++;
  }
}

if(failed){
  console.error("\nFAILED assertions:", failed);
  process.exit(1);
}

console.log("\nAll special vehicle fee scenarios passed.");
