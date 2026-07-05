import assert from "node:assert/strict";

function legRequiresRouteSelection(legPlan){
  if(!legPlan || legPlan.preFixedFareConfirmable !== true){
    return false;
  }
  return legPlan.routeSelectionConfirmed !== true;
}

function hasOverallRouteSelected(routePlan){
  return Boolean(String(routePlan?.overallRouteSelection?.selectedOverallRouteId || "").trim());
}

function requiresOverallRouteSelection(routePlan){
  return Boolean(routePlan?.overallRouteSelection?.overallRouteCandidates?.length >= 2);
}

function isRouteReviewComplete(routePlan){
  if(!routePlan){
    return false;
  }
  const outbound = routePlan.outboundRoutePlan || routePlan;
  if(legRequiresRouteSelection(outbound)){
    return false;
  }
  if(requiresOverallRouteSelection(routePlan) && !hasOverallRouteSelected(routePlan)){
    return false;
  }
  const returnLeg = routePlan.returnRoutePlan;
  if(returnLeg && legRequiresRouteSelection(returnLeg)){
    return false;
  }
  return true;
}

const confirmableLeg = {
  preFixedFareConfirmable: true,
  selectedRouteId: "route_0",
  routeCandidates: [{ routeId: "route_0" }, { routeId: "route_1" }]
};

assert.equal(isRouteReviewComplete(confirmableLeg), false, "confirmable leg without explicit selection stays incomplete");

assert.equal(
  isRouteReviewComplete(Object.assign({}, confirmableLeg, { routeSelectionConfirmed: true })),
  true,
  "confirmable leg with routeSelectionConfirmed completes review"
);

const overallPlan = {
  overallRouteSelection: {
    overallRouteCandidates: [{ routeId: "overall_0" }, { routeId: "overall_1" }],
    selectedOverallRouteId: null
  },
  outboundRoutePlan: {
    preFixedFareConfirmable: true,
    selectedRouteId: "route_0",
    routeSelectionConfirmed: true
  }
};

assert.equal(isRouteReviewComplete(overallPlan), false, "return_with_stop waits for auto overall selection");

overallPlan.overallRouteSelection.selectedOverallRouteId = "overall_0";
assert.equal(isRouteReviewComplete(overallPlan), true, "auto-selected overall completes review");

console.log("route review complete tests passed");
