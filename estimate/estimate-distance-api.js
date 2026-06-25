(function(global){
  const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
  const FIELD_MASK = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels,routes.routeToken,routes.travelAdvisory.tollInfo";

  function parseDurationSeconds(durationStr){
    if(!durationStr) return 0;
    const match = String(durationStr).match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : 0;
  }

  function roadTypeFromModifiers(avoidTolls){
    return avoidTolls ? "general" : "toll";
  }

  function getRouteSummaryText(route){
    if(route?.routeSummary){
      return String(route.routeSummary).trim();
    }
    const labels = Array.isArray(route?.routeLabels) ? route.routeLabels.filter(Boolean) : [];
    if(labels.length){
      return labels.join(" / ");
    }
    return String(route?.routeLabel || "").trim();
  }

  function normalizeRawRoute(route, context){
    const distanceMeters = Number(route?.distanceMeters) || 0;
    const durationSeconds = parseDurationSeconds(route?.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0;
    const avoidTolls = context.avoidTolls === true;
    const avoidHighways = context.avoidHighways === true;

    return {
      routeId: "",
      routeLabel: "",
      routeSource: "google_routes",
      routeStrategy: String(context.routeStrategy || ""),
      distanceMeters: distanceMeters,
      durationSeconds: durationSeconds,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      encodedPolyline: String(route?.polyline?.encodedPolyline || ""),
      routeLabels: Array.isArray(route?.routeLabels) ? route.routeLabels.slice() : [],
      routeToken: String(route?.routeToken || ""),
      routeSummary: "",
      tollInfo: route?.travelAdvisory?.tollInfo || null,
      roadType: context.roadType || roadTypeFromModifiers(avoidTolls),
      avoidTolls: avoidTolls,
      avoidHighways: avoidHighways,
      rawRouteIndex: Number(context.rawRouteIndex) || 0
    };
  }

  function isDuplicateRoute(left, right){
    if(!left || !right){
      return false;
    }
    const polyLeft = String(left.encodedPolyline || "");
    const polyRight = String(right.encodedPolyline || "");
    if(polyLeft && polyRight && polyLeft === polyRight){
      return true;
    }
    const distLeft = Number(left.distanceMeters) || 0;
    const distRight = Number(right.distanceMeters) || 0;
    const durLeft = Number(left.durationSeconds) || 0;
    const durRight = Number(right.durationSeconds) || 0;
    if(distLeft > 0 && distRight > 0 && Math.abs(distLeft - distRight) < 100){
      if(Math.abs(durLeft - durRight) < 60){
        return true;
      }
    }
    const summaryLeft = getRouteSummaryText(left);
    const summaryRight = getRouteSummaryText(right);
    if(summaryLeft && summaryRight && summaryLeft === summaryRight){
      return true;
    }
    return false;
  }

  function dedupeRoutes(routes){
    const deduped = [];
    (routes || []).forEach(function(route){
      const duplicate = deduped.some(function(existing){
        return isDuplicateRoute(existing, route);
      });
      if(!duplicate){
        deduped.push(route);
      }
    });
    return deduped;
  }

  function assignRouteLabels(routes){
    const strategyLabels = {
      recommended: "推奨ルート",
      alternative: "推奨ルート（代替）",
      avoid_tolls: "一般道優先ルート",
      allow_tolls: "有料道路利用可ルート",
      avoid_highways: "高速道路回避ルート"
    };

    routes.forEach(function(route){
      const strategy = String(route.routeStrategy || "");
      route.routeLabel = strategyLabels[strategy] || "ルート候補";
      route.routeSummary = getRouteSummaryText(route) || route.routeLabel;
    });

    let minDistance = Infinity;
    let minDuration = Infinity;
    routes.forEach(function(route){
      const distance = Number(route.distanceMeters) || 0;
      const duration = Number(route.durationSeconds) || 0;
      if(distance > 0 && distance < minDistance){
        minDistance = distance;
      }
      if(duration > 0 && duration < minDuration){
        minDuration = duration;
      }
    });

    const distanceWinners = routes.filter(function(route){
      return Number(route.distanceMeters) === minDistance && minDistance < Infinity;
    });
    const durationWinners = routes.filter(function(route){
      return Number(route.durationSeconds) === minDuration && minDuration < Infinity;
    });

    if(distanceWinners.length === 1){
      const winner = distanceWinners[0];
      const strategy = String(winner.routeStrategy || "");
      if(strategy === "alternative" || strategy === "recommended"){
        winner.routeLabel = "距離短めルート";
        winner.routeSummary = winner.routeLabel;
      }
    }

    if(durationWinners.length === 1){
      const winner = durationWinners[0];
      const strategy = String(winner.routeStrategy || "");
      if(strategy === "alternative" || strategy === "recommended"){
        if(winner.routeLabel !== "距離短めルート"){
          winner.routeLabel = "時間短めルート";
          winner.routeSummary = winner.routeLabel;
        }
      }
    }

    return routes;
  }

  function assignRouteIds(routes){
    return (routes || []).map(function(route, index){
      return Object.assign({}, route, {
        routeId: "route_" + index
      });
    });
  }

  async function fetchRoutesRequest(options, requestBody){
    const apiKey = String(options?.apiKey || "").trim();
    const response = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json().catch(function(){
      return {};
    });
    if(!response.ok){
      throw new Error(data?.error?.message || "ルートの取得に失敗しました。");
    }
    return Array.isArray(data.routes) ? data.routes : [];
  }

  async function fetchStrategyRoutes(options, strategy){
    const userAvoidTolls = options?.roadType === "general";
    const requestBody = {
      origin: { address: String(options.origin || "") },
      destination: { address: String(options.destination || "") },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: strategy.computeAlternativeRoutes === true,
      extraComputations: ["TOLLS"],
      routeModifiers: {
        avoidTolls: strategy.avoidTolls === true,
        avoidHighways: strategy.avoidHighways === true,
        avoidFerries: false
      },
      languageCode: options?.languageCode || "ja",
      units: "METRIC"
    };

    const rawRoutes = await fetchRoutesRequest(options, requestBody);
    return rawRoutes.map(function(route, index){
      const routeStrategy = strategy.key === "recommended" && index > 0
        ? "alternative"
        : strategy.key;
      return normalizeRawRoute(route, {
        routeStrategy: routeStrategy,
        avoidTolls: strategy.avoidTolls === true,
        avoidHighways: strategy.avoidHighways === true,
        roadType: strategy.roadType,
        rawRouteIndex: index
      });
    });
  }

  async function computePreFixedFareRouteCandidates(options){
    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();
    const userAvoidTolls = options?.roadType === "general";

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    const strategies = [
      {
        key: "recommended",
        computeAlternativeRoutes: true,
        avoidTolls: userAvoidTolls,
        avoidHighways: userAvoidTolls,
        roadType: userAvoidTolls ? "general" : "toll"
      },
      {
        key: "avoid_tolls",
        computeAlternativeRoutes: false,
        avoidTolls: true,
        avoidHighways: false,
        roadType: "general"
      },
      {
        key: "allow_tolls",
        computeAlternativeRoutes: false,
        avoidTolls: false,
        avoidHighways: false,
        roadType: "toll"
      },
      {
        key: "avoid_highways",
        computeAlternativeRoutes: false,
        avoidTolls: false,
        avoidHighways: true,
        roadType: "general"
      }
    ];

    const strategyResults = await Promise.all(strategies.map(function(strategy){
      return fetchStrategyRoutes(options, strategy).catch(function(){
        return [];
      });
    }));

    const rawRoutes = strategyResults.reduce(function(all, routes){
      return all.concat(routes);
    }, []);
    const routeGenerationStrategies = strategies.map(function(strategy){
      return strategy.key;
    });
    const deduped = assignRouteLabels(assignRouteIds(dedupeRoutes(rawRoutes)));
    const preFixedFareConfirmable = deduped.length >= 2;
    const primary = deduped[0] || null;

    if(!primary){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }

    return {
      distanceKm: primary.distanceKm,
      durationMinutes: primary.durationMinutes,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      selectedRouteId: primary.routeId,
      routes: deduped,
      alternativeRouteCount: deduped.length,
      multipleRoutesAvailable: deduped.length >= 2,
      preFixedFareConfirmable: preFixedFareConfirmable,
      routeDedupedCount: deduped.length,
      routeGenerationStrategies: routeGenerationStrategies,
      rawRouteCount: rawRoutes.length,
      fallbackReason: preFixedFareConfirmable ? null : "insufficient_distinct_routes"
    };
  }

  function normalizeRoute(route, index){
    const distanceMeters = Number(route?.distanceMeters) || 0;
    const durationSeconds = parseDurationSeconds(route?.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0;
    return {
      routeId: "route_" + index,
      distanceMeters: distanceMeters,
      durationSeconds: durationSeconds,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      encodedPolyline: String(route?.polyline?.encodedPolyline || ""),
      routeLabels: Array.isArray(route?.routeLabels) ? route.routeLabels.slice() : [],
      routeToken: String(route?.routeToken || ""),
      tollInfo: route?.travelAdvisory?.tollInfo || null
    };
  }

  async function computeRouteDistance(options){
    if(options?.requestPreFixedFareCandidates === true){
      return computePreFixedFareRouteCandidates(options);
    }

    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();
    const requestAlternativeRoutes = options?.requestAlternativeRoutes === true;

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    const rawRoutes = await fetchRoutesRequest(options, {
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: requestAlternativeRoutes,
      extraComputations: ["TOLLS"],
      routeModifiers: {
        avoidTolls: options?.roadType === "general",
        avoidHighways: options?.roadType === "general",
        avoidFerries: false
      },
      languageCode: options?.languageCode || "ja",
      units: "METRIC"
    });

    if(!rawRoutes.length){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }
    const routes = rawRoutes.map(function(route, index){
      return normalizeRoute(route, index);
    });
    const primary = routes[0];

    return {
      distanceKm: primary.distanceKm,
      durationMinutes: primary.durationMinutes,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      selectedRouteId: primary.routeId,
      routes: routes
    };
  }

  async function geocodeAddress(options){
    const apiKey = String(options?.apiKey || "").trim();
    const address = String(options?.address || "").trim();

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!address){
      throw new Error("住所を入力してください。");
    }

    const params = new URLSearchParams({
      address: address,
      key: apiKey,
      language: options?.languageCode || "ja",
      region: options?.region || "JP"
    });
    const response = await fetch(GEOCODE_URL + "?" + params.toString());
    const data = await response.json().catch(function(){
      return {};
    });

    if(!response.ok || data?.status !== "OK" || !Array.isArray(data.results) || !data.results.length){
      return null;
    }

    const result = data.results[0];
    return {
      formattedAddress: String(result?.formatted_address || ""),
      addressComponents: Array.isArray(result?.address_components) ? result.address_components : [],
      location: result?.geometry?.location || null
    };
  }

  global.EstimateDistanceApi = {
    computeRouteDistance: computeRouteDistance,
    computePreFixedFareRouteCandidates: computePreFixedFareRouteCandidates,
    geocodeAddress: geocodeAddress
  };
})(typeof window !== "undefined" ? window : globalThis);
