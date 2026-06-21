(function(global){
  const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

  function parseDurationSeconds(durationStr){
    if(!durationStr) return 0;
    const match = String(durationStr).match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : 0;
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
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
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

    const route = data.routes?.[0];
    if(!route){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }

    const distanceMeters = Number(route.distanceMeters) || 0;
    const durationSeconds = parseDurationSeconds(route.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0;

    return {
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      distanceMeters: distanceMeters,
      durationSeconds: durationSeconds
    };
  }

  global.EstimateDistanceApi = {
    computeRouteDistance: computeRouteDistance
  };
})(typeof window !== "undefined" ? window : globalThis);
