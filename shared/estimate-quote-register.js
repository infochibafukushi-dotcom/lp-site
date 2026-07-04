(function(global){
  const REGISTER_PATH = "/api/quotes/register";
  const REGISTER_WARN_MESSAGE =
    "見積登録に失敗しました。予約に進めない場合は、お電話ください。";
  const QUOTE_JSON_SOFT_MAX = 45000;

  function getConfig(){
    return global.EstimateQuoteConfig || {};
  }

  function roundDownToTenYen(amountYen){
    return Math.floor(Math.max(Number(amountYen) || 0, 0) / 10) * 10;
  }

  function sumServiceFees(serviceFees){
    return (Array.isArray(serviceFees) ? serviceFees : []).reduce(function(sum, row){
      if(String(row?.key || "") === "specialVehicleFee"){
        return sum;
      }
      return sum + (Number(row?.amount) || 0);
    }, 0);
  }

  function stripHeavyRouteFields(value){
    if(Array.isArray(value)){
      return value.map(stripHeavyRouteFields);
    }
    if(!value || typeof value !== "object"){
      return value;
    }
    const next = {};
    Object.keys(value).forEach(function(key){
      if(key === "encodedPolyline" || key === "routeToken" || key === "polyline" || key === "overviewPolyline"){
        return;
      }
      next[key] = stripHeavyRouteFields(value[key]);
    });
    return next;
  }

  function cloneJson(value){
    if(value == null){
      return null;
    }
    try{
      return JSON.parse(JSON.stringify(value));
    }catch(error){
      return null;
    }
  }

  function jsonLength(value){
    try{
      return JSON.stringify(value || null).length;
    }catch(error){
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function buildRegisterPayload(handoff){
    const tenant = global.TenantDefaults || {};
    const cfg = getConfig();
    const snapshot = cloneJson(handoff?.quoteSnapshot) || {};
    const routePlan = cloneJson(handoff?.routePlan);
    const usageSummary = cloneJson(handoff?.usageSummary);

    snapshot.fixedFareTotal = roundDownToTenYen(snapshot.fixedFareTotal);
    const derivedTotal = snapshot.fixedFareTotal + sumServiceFees(snapshot.serviceFees);
    const handoffTotal = Math.round(Number(handoff?.total) || 0);
    const total = derivedTotal > 0 ? derivedTotal : handoffTotal;
    snapshot.total = total;

    let lightSnapshot = stripHeavyRouteFields(snapshot);
    let lightRoutePlan = routePlan ? stripHeavyRouteFields(routePlan) : null;

    if(jsonLength(lightSnapshot) > QUOTE_JSON_SOFT_MAX){
      lightSnapshot = Object.assign({}, lightSnapshot, {
        routeCandidates: [],
        alternativeRoutes: [],
        routeLegs: [],
        encodedPolyline: "",
        routeToken: ""
      });
      if(lightSnapshot.outboundRoutePlan){
        lightSnapshot.outboundRoutePlan = Object.assign({}, lightSnapshot.outboundRoutePlan, {
          routeCandidates: [],
          routes: [],
          encodedPolyline: "",
          routeToken: ""
        });
      }
      if(lightSnapshot.returnRoutePlan){
        lightSnapshot.returnRoutePlan = Object.assign({}, lightSnapshot.returnRoutePlan, {
          routeCandidates: [],
          routes: [],
          encodedPolyline: "",
          routeToken: ""
        });
      }
      if(lightSnapshot.routePlan){
        lightSnapshot.routePlan = Object.assign({}, lightSnapshot.routePlan, {
          routeCandidates: [],
          encodedPolyline: "",
          routeToken: ""
        });
      }
    }

    if(lightRoutePlan && jsonLength(lightRoutePlan) > QUOTE_JSON_SOFT_MAX){
      lightRoutePlan = {
        tripType: lightRoutePlan.tripType || null,
        returnPlanType: lightRoutePlan.returnPlanType || null,
        totalDistanceMeters: lightRoutePlan.totalDistanceMeters || null,
        totalDurationSeconds: lightRoutePlan.totalDurationSeconds || null,
        preFixedFareConfirmable: lightRoutePlan.preFixedFareConfirmable === true,
        selectedRouteId: lightRoutePlan.selectedRouteId || null,
        selectedRouteLabel: lightRoutePlan.selectedRouteLabel || null
      };
    }

    return {
      estimateNo: String(handoff?.estimateNumber || "").trim(),
      total: total,
      fareType: "fixed",
      quoteSnapshot: lightSnapshot,
      routePlan: lightRoutePlan,
      usageSummary: usageSummary,
      handoffSource: String(handoff?.handoffSource || "lp-site-estimate").trim() || "lp-site-estimate",
      dtoVersion: Number(handoff?.dtoVersion) || 2,
      franchiseeId: String(tenant.franchiseeId || cfg.franchiseeId || "").trim(),
      storeId: String(tenant.storeId || cfg.storeId || "").trim()
    };
  }

  function buildRegisterHeaders(cfg){
    const headers = { "Content-Type": "application/json" };
    const token = String(cfg.REGISTER_TOKEN || cfg.LP_REGISTER_TOKEN || "").trim();
    if(token){
      headers.Authorization = "Bearer " + token;
    }
    const franchiseeId = String((global.TenantDefaults || {}).franchiseeId || cfg.franchiseeId || "").trim();
    const storeId = String((global.TenantDefaults || {}).storeId || cfg.storeId || "").trim();
    if(franchiseeId){
      headers["X-Franchisee-Id"] = franchiseeId;
    }
    if(storeId){
      headers["X-Store-Id"] = storeId;
    }
    return headers;
  }

  async function registerQuoteFromHandoff(handoff){
    const cfg = getConfig();
    if(cfg.REGISTER_ENABLED === false){
      return { ok: true, skipped: true, reason: "disabled" };
    }
    const base = String(cfg.API_BASE || "").replace(/\/$/, "");
    if(!base){
      return { ok: false, message: "API_BASE が未設定です", userMessage: REGISTER_WARN_MESSAGE };
    }
    const payload = buildRegisterPayload(handoff);
    if(!payload.estimateNo || !payload.quoteSnapshot || payload.total <= 0){
      return { ok: false, message: "register payload invalid", userMessage: REGISTER_WARN_MESSAGE };
    }

    let response;
    try{
      response = await fetch(base + REGISTER_PATH, {
        method: "POST",
        headers: buildRegisterHeaders(cfg),
        body: JSON.stringify(payload)
      });
    }catch(error){
      console.warn("[estimate-quote-register] network error", error);
      return {
        ok: false,
        message: String(error?.message || error),
        userMessage: REGISTER_WARN_MESSAGE
      };
    }

    let data = {};
    try{
      data = await response.json();
    }catch(error){
      data = {};
    }

    if(response.ok && data.success){
      return { ok: true, data: data, duplicate: false };
    }
    if(response.status === 409){
      return { ok: true, data: data, duplicate: true };
    }

    console.warn("[estimate-quote-register] failed", {
      status: response.status,
      message: data?.message || "register failed",
      estimateNo: payload.estimateNo,
      total: payload.total,
      snapshotBytes: jsonLength(payload.quoteSnapshot),
      routePlanBytes: jsonLength(payload.routePlan)
    });

    return {
      ok: false,
      status: response.status,
      message: String(data?.message || "register failed"),
      userMessage: REGISTER_WARN_MESSAGE
    };
  }

  global.EstimateQuoteRegister = {
    REGISTER_WARN_MESSAGE: REGISTER_WARN_MESSAGE,
    buildRegisterPayload: buildRegisterPayload,
    registerQuoteFromHandoff: registerQuoteFromHandoff
  };
})(typeof window !== "undefined" ? window : globalThis);
