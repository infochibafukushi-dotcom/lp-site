(function(global){
  const FARE_AREA = "千葉地区";
  const FARE_VEHICLE_CLASS = "大型車";
  const FARE_PLAN = "B運賃";
  const FARE_NOTICE = "令和8年2月13日付け 関自旅二第4314号";
  const INITIAL_DISTANCE_KM = 1.06;
  const INITIAL_FARE_YEN = 520;
  const ADDITIONAL_DISTANCE_M = 212;
  const ADDITIONAL_DISTANCE_KM = ADDITIONAL_DISTANCE_M / 1000;
  const ADDITIONAL_FARE_YEN = 100;
  const TIME_DISTANCE_SECONDS = 80;
  const TIME_DISTANCE_FARE_YEN = 100;
  const CHARTER_UNIT_MINUTES = 30;
  const CHARTER_UNIT_FARE_YEN = 4180;

  const FARE_LABEL = FARE_AREA + " " + FARE_VEHICLE_CLASS + FARE_PLAN;
  const FARE_LABEL_WITH_NOTICE = FARE_NOTICE + " " + FARE_LABEL;

  function resolveIncrementDistanceKm(pattern){
    const patternObj = pattern || {};
    const meters = Number(patternObj.incrementDistanceMeters);
    if(meters > 0){
      return meters / 1000;
    }
    const raw = Number(patternObj.incrementDistanceKm) || 0;
    if(!(raw > 0)){
      return 0;
    }
    // 旧 lp-site 設定では incrementDistanceKm にメートル値（例: 212）が入っていた。
    if(raw >= 1){
      return raw / 1000;
    }
    return raw;
  }

  function resolveIncrementDistanceMeters(pattern){
    const patternObj = pattern || {};
    const explicitMeters = Number(patternObj.incrementDistanceMeters);
    if(explicitMeters > 0){
      return explicitMeters;
    }
    const km = resolveIncrementDistanceKm(patternObj);
    return km > 0 ? Math.round(km * 1000) : 0;
  }

  function normalizeDistancePricingPatternA(pattern){
    const src = pattern || {};
    const incrementDistanceMeters = resolveIncrementDistanceMeters(src);
    const incrementDistanceKm = incrementDistanceMeters > 0
      ? incrementDistanceMeters / 1000
      : resolveIncrementDistanceKm(src);
    return {
      initialDistanceKm: Number(src.initialDistanceKm) || 0,
      initialFare: Number(src.initialFare) || 0,
      incrementDistanceMeters: incrementDistanceMeters,
      incrementDistanceKm: incrementDistanceKm,
      incrementFare: Number(src.incrementFare) || 0
    };
  }

  function getDistancePricingPatternA(){
    return normalizeDistancePricingPatternA({
      initialDistanceKm: INITIAL_DISTANCE_KM,
      initialFare: INITIAL_FARE_YEN,
      incrementDistanceMeters: ADDITIONAL_DISTANCE_M,
      incrementFare: ADDITIONAL_FARE_YEN
    });
  }

  function getCharterTimeBlockParams(){
    return {
      baseMinutes: CHARTER_UNIT_MINUTES,
      baseAmount: CHARTER_UNIT_FARE_YEN,
      perBlockMinutes: CHARTER_UNIT_MINUTES,
      perBlockAmount: CHARTER_UNIT_FARE_YEN
    };
  }

  global.FareConstants = {
    FARE_AREA: FARE_AREA,
    FARE_VEHICLE_CLASS: FARE_VEHICLE_CLASS,
    FARE_PLAN: FARE_PLAN,
    FARE_NOTICE: FARE_NOTICE,
    FARE_LABEL: FARE_LABEL,
    FARE_LABEL_WITH_NOTICE: FARE_LABEL_WITH_NOTICE,
    INITIAL_DISTANCE_KM: INITIAL_DISTANCE_KM,
    INITIAL_FARE_YEN: INITIAL_FARE_YEN,
    ADDITIONAL_DISTANCE_M: ADDITIONAL_DISTANCE_M,
    ADDITIONAL_DISTANCE_KM: ADDITIONAL_DISTANCE_KM,
    ADDITIONAL_FARE_YEN: ADDITIONAL_FARE_YEN,
    TIME_DISTANCE_SECONDS: TIME_DISTANCE_SECONDS,
    TIME_DISTANCE_FARE_YEN: TIME_DISTANCE_FARE_YEN,
    CHARTER_UNIT_MINUTES: CHARTER_UNIT_MINUTES,
    CHARTER_UNIT_FARE_YEN: CHARTER_UNIT_FARE_YEN,
    getDistancePricingPatternA: getDistancePricingPatternA,
    getCharterTimeBlockParams: getCharterTimeBlockParams,
    resolveIncrementDistanceKm: resolveIncrementDistanceKm,
    resolveIncrementDistanceMeters: resolveIncrementDistanceMeters,
    normalizeDistancePricingPatternA: normalizeDistancePricingPatternA
  };
})(typeof window !== "undefined" ? window : globalThis);
