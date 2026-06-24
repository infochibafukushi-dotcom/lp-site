(function(global){
  const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

  function parseDurationSeconds(durationStr){
    if(!durationStr) return 0;
    const match = String(durationStr).match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : 0;
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
    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    const response = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels,routes.routeToken,routes.travelAdvisory.tollInfo"
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        extraComputations: ["TOLLS"],
        routeModifiers: {
          avoidTolls: options?.roadType === "general",
          avoidHighways: options?.roadType === "general",
          avoidFerries: false
        },
        languageCode: options?.languageCode || "ja",
        units: "METRIC"
      })
    });

    const data = await response.json().catch(function(){
      return {};
    });

    if(!response.ok){
      throw new Error(data?.error?.message || "ルートの取得に失敗しました。");
    }

    const rawRoutes = Array.isArray(data.routes) ? data.routes : [];
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
    geocodeAddress: geocodeAddress
  };
})(typeof window !== "undefined" ? window : globalThis);
