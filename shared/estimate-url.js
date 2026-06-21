(function(global){
  function parseUrlState(search){
    const params = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
    const distanceRaw = params.get("distance");
    return {
      mobilityId: String(params.get("mobility") || "").trim(),
      stairId: String(params.get("stair") || "").trim(),
      tripTypeId: String(params.get("trip") || "").trim(),
      distanceKm: distanceRaw !== null && distanceRaw !== "" ? Number(distanceRaw) : 0,
      bodyAssist: params.get("bodyAssist") === "1" || params.get("bodyAssist") === "true",
      estimateNumber: String(params.get("estimateNo") || params.get("estimateNumber") || "").trim()
    };
  }

  function buildShareUrl(state, options){
    const opts = options || {};
    const params = new URLSearchParams();
    if(state.mobilityId) params.set("mobility", state.mobilityId);
    if(state.stairId) params.set("stair", state.stairId);
    if(state.tripTypeId) params.set("trip", state.tripTypeId);
    if(Number(state.distanceKm) > 0) params.set("distance", String(state.distanceKm));
    if(state.bodyAssist) params.set("bodyAssist", "1");
    if(state.estimateNumber) params.set("estimateNo", state.estimateNumber);

    let path = opts.pathname;
    if(!path && typeof window !== "undefined"){
      path = window.location.pathname;
    }
    if(!path) path = "/estimate/";

    const origin = opts.origin || (typeof window !== "undefined" ? window.location.origin : "");
    const qs = params.toString();
    return origin + path + (qs ? "?" + qs : "");
  }

  function applyUrlStateToFormState(formState, urlState, config){
    if(!formState || !config) return formState;

    function hasItem(categoryKey, id){
      if(!id) return false;
      const items = config.categories?.[categoryKey]?.items || [];
      return items.some(function(item){
        return item && item.id === id && item.visible !== false;
      });
    }

    if(urlState.mobilityId && hasItem("mobility", urlState.mobilityId)){
      formState.mobilityId = urlState.mobilityId;
    }
    if(urlState.stairId && hasItem("stairAssist", urlState.stairId)){
      formState.stairId = urlState.stairId;
    }
    if(urlState.tripTypeId && hasItem("tripType", urlState.tripTypeId)){
      formState.tripTypeId = urlState.tripTypeId;
    }
    if(urlState.distanceKm > 0){
      formState.distanceKm = urlState.distanceKm;
    }
    formState.bodyAssist = urlState.bodyAssist === true;
    if(urlState.estimateNumber){
      formState.estimateNumber = urlState.estimateNumber;
    }
    return formState;
  }

  global.EstimateUrl = {
    parseUrlState: parseUrlState,
    buildShareUrl: buildShareUrl,
    applyUrlStateToFormState: applyUrlStateToFormState
  };
})(typeof window !== "undefined" ? window : globalThis);
