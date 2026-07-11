(function(global){
  const ROUTE_PRESENTATION = {
    time_priority: {
      routeType: "time_priority",
      routeLabel: "時間優先ルート",
      routeDescription: "所要時間を優先して算定した走行予定ルートです。有料道路を含む場合、有料道路料金は別途必要です。"
    },
    general_road_priority: {
      routeType: "general_road_priority",
      routeLabel: "一般道優先ルート",
      routeDescription: "有料道路を使わず、一般道を優先して算定した走行予定ルートです。"
    },
    recommended: {
      routeType: "recommended",
      routeLabel: "おすすめルート",
      routeDescription: "時間と距離のバランスを考慮した標準的なルートです。"
    },
    shorter_distance: {
      routeType: "shorter_distance",
      routeLabel: "距離優先ルート",
      routeDescription: "走行距離を優先したルートです。道路状況により所要時間が長くなる場合があります。"
    },
    arterial_road: {
      routeType: "arterial_road",
      routeLabel: "幹線道路ルート",
      routeDescription: "近くの幹線道路を優先して通るルートです。"
    },
    toll_allowed: {
      routeType: "toll_allowed",
      routeLabel: "有料道路優先ルート",
      routeDescription: "有料道路を活用して所要時間短縮を見込むルートです。有料道路料金は別途必要です。"
    }
  };

  const INTERNAL_SUMMARY_PATTERN = /^(DEFAULT_ROUTE|POOL_CANDIDATE|ROUTE_\d+)$/i;

  function routeUsesToll(route){
    const tollInfo = route?.tollInfo || route?.travelAdvisory?.tollInfo || null;
    if(!tollInfo){
      return false;
    }
    const estimatedPrice = tollInfo.estimatedPrice;
    if(Array.isArray(estimatedPrice) && estimatedPrice.length > 0){
      return true;
    }
    if(estimatedPrice && !Array.isArray(estimatedPrice) && typeof estimatedPrice === "object"){
      const units = Number(estimatedPrice.units);
      const nanos = Number(estimatedPrice.nanos);
      if((Number.isFinite(units) && units !== 0) || (Number.isFinite(nanos) && nanos !== 0)){
        return true;
      }
      if(estimatedPrice.currencyCode){
        return true;
      }
    }
    if(Array.isArray(tollInfo.tollInfos) && tollInfo.tollInfos.length > 0){
      return true;
    }
    return false;
  }

  function resolveStrategy(route){
    return String(route?.routeStrategy || route?.strategy || "").trim();
  }

  function getPresentation(strategy){
    return ROUTE_PRESENTATION[strategy] || null;
  }

  function resolveTimePriorityLabel(route){
    const usesToll = routeUsesToll(route);
    return usesToll ? "時間優先（有料道）" : "時間優先ルート";
  }

  function getApiRouteSummary(route){
    if(route?.routeSummary && !isInternalRouteSummary(route.routeSummary)){
      return String(route.routeSummary).trim();
    }
    const labels = Array.isArray(route?.routeLabels) ? route.routeLabels.filter(Boolean) : [];
    if(labels.length){
      return labels.join(" / ");
    }
    return "";
  }

  function isInternalRouteSummary(summary){
    const text = String(summary || "").trim();
    if(!text){
      return true;
    }
    return INTERNAL_SUMMARY_PATTERN.test(text);
  }

  function resolveRoutePresentation(route, strategy){
    if(!route){
      return null;
    }
    const resolvedStrategy = String(strategy || resolveStrategy(route) || "").trim();
    const presentation = getPresentation(resolvedStrategy);
    // usesToll must reflect actual toll usage, not request intent (roadType/strategy).
    const usesToll = routeUsesToll(route);
    const apiSummary = getApiRouteSummary(route);
    let routeLabel = presentation?.routeLabel || String(route.routeLabel || "").trim() || "ルート候補";
    let routeDescription = presentation?.routeDescription || String(route.routeDescription || "").trim();
    if(resolvedStrategy === "time_priority"){
      routeLabel = resolveTimePriorityLabel(route);
    }
    if(resolvedStrategy === "time_priority" && usesToll && !routeDescription.includes("別途必要")){
      routeDescription = "所要時間を優先して算定した走行予定ルートです。有料道路料金は見積料金に含まれず、別途必要です。";
    }
    return Object.assign({}, route, {
      routeStrategy: resolvedStrategy || route.routeStrategy || null,
      routeType: presentation?.routeType || resolvedStrategy || route.routeType || null,
      routeLabel: routeLabel,
      routeDescription: routeDescription,
      usesToll: usesToll,
      routeSummary: apiSummary || routeLabel
    });
  }

  function getRouteDisplayLabel(route, index){
    const strategy = resolveStrategy(route);
    if(strategy === "time_priority"){
      return resolveTimePriorityLabel(route);
    }
    const label = String(route?.routeLabel || "").trim();
    if(label){
      return label;
    }
    const presentation = getPresentation(strategy);
    if(presentation){
      return presentation.routeLabel;
    }
    const labels = Array.isArray(route?.routeLabels) ? route.routeLabels.filter(Boolean) : [];
    if(labels.length){
      return labels.join(" / ");
    }
    return "ルート候補 " + (Number(index) + 1);
  }

  function getRouteDisplayDescription(route){
    const description = String(route?.routeDescription || "").trim();
    if(description){
      return description;
    }
    const presentation = getPresentation(resolveStrategy(route));
    return presentation?.routeDescription || "";
  }

  global.PreFixedFareRoutePresentation = {
    ROUTE_PRESENTATION: ROUTE_PRESENTATION,
    routeUsesToll: routeUsesToll,
    resolveRoutePresentation: resolveRoutePresentation,
    getRouteDisplayLabel: getRouteDisplayLabel,
    getRouteDisplayDescription: getRouteDisplayDescription,
    getPresentation: getPresentation,
    isInternalRouteSummary: isInternalRouteSummary,
    getApiRouteSummary: getApiRouteSummary,
    resolveTimePriorityLabel: resolveTimePriorityLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
