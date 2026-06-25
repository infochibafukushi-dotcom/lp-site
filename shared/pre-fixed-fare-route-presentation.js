(function(global){
  const ROUTE_PRESENTATION = {
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
      routeLabel: "高速道路ルート",
      routeDescription: "遠方移動に適したルートです。有料道路料金は別途必要です。"
    }
  };

  const INTERNAL_SUMMARY_PATTERN = /^(DEFAULT_ROUTE|POOL_CANDIDATE|ROUTE_\d+)$/i;

  function routeUsesToll(route){
    const tollInfo = route?.tollInfo;
    if(!tollInfo){
      return false;
    }
    if(tollInfo.estimatedPrice){
      return true;
    }
    if(Array.isArray(tollInfo.tollInfos) && tollInfo.tollInfos.length){
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
    const usesToll = routeUsesToll(route) || resolvedStrategy === "toll_allowed" || route?.roadType === "toll";
    const apiSummary = getApiRouteSummary(route);
    const routeLabel = presentation?.routeLabel || String(route.routeLabel || "").trim() || "ルート候補";
    const routeDescription = presentation?.routeDescription || String(route.routeDescription || "").trim();
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
    const label = String(route?.routeLabel || "").trim();
    if(label){
      return label;
    }
    const presentation = getPresentation(resolveStrategy(route));
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
    getApiRouteSummary: getApiRouteSummary
  };
})(typeof window !== "undefined" ? window : globalThis);
