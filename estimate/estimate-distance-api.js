(function(global){
  const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
  const FIELD_MASK = [
    "routes.distanceMeters",
    "routes.duration",
    "routes.polyline.encodedPolyline",
    "routes.routeLabels",
    "routes.routeToken",
    "routes.travelAdvisory.tollInfo",
    "routes.legs.distanceMeters",
    "routes.legs.duration",
    "routes.legs.staticDuration",
    "routes.legs.polyline.encodedPolyline",
    "routes.legs.startLocation.latLng",
    "routes.legs.endLocation.latLng"
  ].join(",");
  const MAX_ROUTE_CANDIDATES = 4;
  const MIN_ROUTE_CANDIDATES = 2;
  const DISPLAY_STRATEGY_ORDER = [
    "time_priority",
    "general_road_priority",
    "shorter_distance",
    "toll_allowed"
  ];

  function applyRoutePresentation(route, strategy){
    if(global.PreFixedFareRoutePresentation && typeof global.PreFixedFareRoutePresentation.resolveRoutePresentation === "function"){
      return global.PreFixedFareRoutePresentation.resolveRoutePresentation(route, strategy);
    }
    return route;
  }

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

  function normalizeApiLatLng(latLng){
    if(!latLng){
      return null;
    }
    const lat = Number(latLng.latitude != null ? latLng.latitude : latLng.lat);
    const lng = Number(latLng.longitude != null ? latLng.longitude : latLng.lng);
    if(!Number.isFinite(lat) || !Number.isFinite(lng)){
      return null;
    }
    return { lat: lat, lng: lng };
  }

  function normalizeRouteLegs(route){
    const legs = Array.isArray(route?.legs) ? route.legs : [];
    return legs.map(function(leg, index){
      return {
        legIndex: index,
        distanceMeters: Number(leg?.distanceMeters) || 0,
        durationSeconds: parseDurationSeconds(leg?.duration || leg?.staticDuration),
        encodedPolyline: String(leg?.polyline?.encodedPolyline || ""),
        startLatLng: normalizeApiLatLng(leg?.startLocation?.latLng),
        endLatLng: normalizeApiLatLng(leg?.endLocation?.latLng)
      };
    }).filter(function(leg){
      return leg.encodedPolyline.length > 0;
    });
  }

  function buildIntermediateWaypointFromLegs(routeLegs, intermediateAddress){
    const address = String(intermediateAddress || "").trim();
    if(!address || !Array.isArray(routeLegs) || routeLegs.length < 2){
      return null;
    }
    const endLatLng = routeLegs[0]?.endLatLng || routeLegs[1]?.startLatLng || null;
    const waypoint = {
      waypointLabel: address,
      waypointAddress: address
    };
    if(endLatLng){
      waypoint.waypointLatLng = {
        latitude: endLatLng.lat,
        longitude: endLatLng.lng
      };
    }
    return waypoint;
  }

  function normalizeRawRoute(route, context){
    const distanceMeters = Number(route?.distanceMeters) || 0;
    const durationSeconds = parseDurationSeconds(route?.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0;
    const avoidTolls = context.avoidTolls === true;
    const avoidHighways = context.avoidHighways === true;
    const routeLegs = normalizeRouteLegs(route);
    const intermediateWaypoint = context.intermediateWaypoint
      || buildIntermediateWaypointFromLegs(routeLegs, context.intermediateAddress);

    return {
      routeId: "",
      routeLabel: "",
      routeDescription: "",
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
      tollPreference: context.tollPreference || null,
      tollExcludedFromFare: context.tollExcludedFromFare === true,
      intermediateWaypoint: intermediateWaypoint,
      routeLegs: routeLegs,
      roadType: context.roadType || roadTypeFromModifiers(avoidTolls),
      avoidTolls: avoidTolls,
      avoidHighways: avoidHighways,
      routingPreference: String(context.routingPreference || "TRAFFIC_AWARE"),
      generationReason: String(context.generationReason || ""),
      dedupeDecision: "kept",
      rawRouteIndex: Number(context.rawRouteIndex) || 0
    };
  }

  function getRouteRoutingFingerprint(route){
    return [
      route?.avoidHighways === true ? "1" : "0",
      route?.avoidTolls === true ? "1" : "0",
      String(route?.routingPreference || "TRAFFIC_AWARE"),
      String(route?.intermediateWaypoint?.waypointId || "")
    ].join("|");
  }

  function isSameEncodedPath(left, right){
    const polyLeft = String(left?.encodedPolyline || "");
    const polyRight = String(right?.encodedPolyline || "");
    return Boolean(polyLeft && polyRight && polyLeft === polyRight);
  }

  function isDuplicateRoute(left, right){
    if(!left || !right){
      return false;
    }
    // Identical polyline means the same driven path, even when request
    // fingerprints differ (e.g. TRAFFIC_AWARE vs TRAFFIC_UNAWARE for C).
    // Slot C must not be shown as a filler copy of A/B in that case.
    if(isSameEncodedPath(left, right)){
      return true;
    }
    // Near distance/time heuristics only apply within the same request shape,
    // so role-different A/B fetches with distinct paths are not collapsed.
    if(getRouteRoutingFingerprint(left) !== getRouteRoutingFingerprint(right)){
      return false;
    }
    const distLeft = Number(left.distanceMeters) || 0;
    const distRight = Number(right.distanceMeters) || 0;
    const durLeft = Number(left.durationSeconds) || 0;
    const durRight = Number(right.durationSeconds) || 0;
    if(distLeft > 0 && distRight > 0 && distLeft === distRight && durLeft === durRight){
      return true;
    }
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

  function isDuplicateOfAny(route, others){
    return (others || []).some(function(existing){
      return isDuplicateRoute(existing, route);
    });
  }

  function slotsToOrderedRoutes(slots){
    return DISPLAY_STRATEGY_ORDER.map(function(strategy){
      return slots?.[strategy] || null;
    }).filter(Boolean).slice(0, MAX_ROUTE_CANDIDATES);
  }

  function isCoreDisplayStrategy(strategy){
    return strategy === "time_priority" || strategy === "general_road_priority";
  }

  function canAssignStrategySlot(strategy, route, kept){
    if(!route){
      return false;
    }
    if(strategy === "toll_allowed" && !routeUsesToll(route)){
      return false;
    }
    if(strategy === "shorter_distance"){
      if(!Number(route.distanceMeters) || !Number(route.durationSeconds)){
        return false;
      }
      if(isDuplicateOfAny(route, kept)){
        return false;
      }
      return true;
    }
    // A/B are always kept when their dedicated fetches succeed,
    // even if distance/time/path are similar to each other.
    if(isCoreDisplayStrategy(strategy)){
      return true;
    }
    return !isDuplicateOfAny(route, kept);
  }

  function assembleStrategySlotRoutes(strategyFetches){
    const slots = {};
    const kept = [];

    // Only assign routes from their dedicated strategy fetches.
    // Do not backfill empty C/D slots from the recommended/arterial pool.
    DISPLAY_STRATEGY_ORDER.forEach(function(strategy){
      const route = strategyFetches?.[strategy];
      if(!canAssignStrategySlot(strategy, route, kept)){
        return;
      }
      slots[strategy] = applyRoutePresentation(Object.assign({}, route, {
        routeStrategy: strategy
      }), strategy);
      kept.push(slots[strategy]);
    });

    return slots;
  }

  async function fillMissingStrategySlots(slots, options, userAvoidTolls){
    const nextSlots = Object.assign({}, slots || {});
    const kept = slotsToOrderedRoutes(nextSlots);

    for(let index = 0; index < DISPLAY_STRATEGY_ORDER.length; index += 1){
      const strategy = DISPLAY_STRATEGY_ORDER[index];
      if(nextSlots[strategy]){
        continue;
      }

      let route = null;
      if(strategy === "shorter_distance"){
        route = await fetchDistancePriorityRoute(options, userAvoidTolls, kept);
      }else if(strategy === "general_road_priority"){
        route = await fetchGeneralRoadPriorityRoute(options);
      }else if(strategy === "toll_allowed"){
        route = await fetchTollAllowedRoute(options, kept[0] || null);
      }else if(strategy === "time_priority"){
        route = await fetchTimePriorityRoute(options, userAvoidTolls);
      }

      if(!canAssignStrategySlot(strategy, route, kept)){
        continue;
      }
      nextSlots[strategy] = applyRoutePresentation(Object.assign({}, route, {
        routeStrategy: strategy
      }), strategy);
      kept.push(nextSlots[strategy]);
    }

    return nextSlots;
  }

  function dedupeRoutes(routes){
    const deduped = [];
    (routes || []).forEach(function(route){
      const duplicate = deduped.some(function(existing){
        return isDuplicateRoute(existing, route);
      });
      if(!duplicate){
        deduped.push(Object.assign({}, route, {
          dedupeDecision: "kept"
        }));
      }
    });
    return deduped;
  }

  function assignRouteIds(routes){
    return (routes || []).map(function(route, index){
      return Object.assign({}, route, {
        routeId: "route_" + index
      });
    });
  }

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

  function routeUsesHighways(route){
    if(route?.avoidHighways === true){
      return false;
    }
    if(route?.roadType === "toll" || routeUsesToll(route)){
      return true;
    }
    const strategy = String(route?.routeStrategy || "").trim();
    return strategy === "time_priority" || strategy === "toll_allowed";
  }

  function buildGeneralRoadPriorityFallbackRoute(primaryRoute){
    const primary = applyRoutePresentation(Object.assign({}, primaryRoute, {
      routeStrategy: "time_priority",
      generationReason: primaryRoute?.generationReason || "time_priority_route"
    }), "time_priority");
    return applyRoutePresentation(Object.assign({}, primary, {
      routeStrategy: "general_road_priority",
      generationReason: "general_road_priority_fallback",
      isSyntheticRoute: true
    }), "general_road_priority");
  }

  async function fetchAlternateRouteForMinimum(options, primaryRoute){
    const userAvoidTolls = options?.roadType === "general";
    if(routeUsesHighways(primaryRoute)){
      const generalRoute = await fetchGeneralRoadPriorityRoute(options);
      if(generalRoute && !isDuplicateRoute(primaryRoute, generalRoute)){
        return generalRoute;
      }
    }
    if(primaryRoute?.avoidHighways === true || primaryRoute?.avoidTolls === true){
      const timeRoute = await fetchTimePriorityRoute(options, userAvoidTolls);
      if(timeRoute && !isDuplicateRoute(primaryRoute, timeRoute)){
        return timeRoute;
      }
    }else{
      const generalRoute = await fetchGeneralRoadPriorityRoute(options);
      if(generalRoute && !isDuplicateRoute(primaryRoute, generalRoute)){
        return generalRoute;
      }
      const tollRoute = await fetchTollAllowedRoute(options, primaryRoute);
      if(tollRoute && !isDuplicateRoute(primaryRoute, tollRoute)){
        return tollRoute;
      }
    }
    return null;
  }

  async function ensureMinimumRouteCandidates(routes, options){
    const initial = Array.isArray(routes) ? routes.slice(0, MAX_ROUTE_CANDIDATES) : [];
    const distinctRouteCount = initial.length;
    if(initial.length >= MIN_ROUTE_CANDIDATES){
      return {
        routes: assignRouteIds(initial),
        distinctRouteCount: distinctRouteCount,
        preFixedFareConfirmable: distinctRouteCount >= MIN_ROUTE_CANDIDATES,
        fallbackReason: null
      };
    }
    if(!initial.length){
      return {
        routes: [],
        distinctRouteCount: 0,
        preFixedFareConfirmable: false,
        fallbackReason: "only_one_distinct_route"
      };
    }

    const primary = applyRoutePresentation(Object.assign({}, initial[0], {
      routeStrategy: initial[0]?.routeStrategy || "time_priority"
    }), initial[0]?.routeStrategy || "time_priority");
    const alternate = await fetchAlternateRouteForMinimum(options, primary);
    if(alternate){
      const merged = dedupeRoutes([primary, alternate]);
      if(merged.length >= MIN_ROUTE_CANDIDATES){
        return {
          routes: assignRouteIds(merged.slice(0, MAX_ROUTE_CANDIDATES)),
          distinctRouteCount: merged.length,
          preFixedFareConfirmable: true,
          fallbackReason: null
        };
      }
    }

    return {
      routes: assignRouteIds([primary, buildGeneralRoadPriorityFallbackRoute(primary)]),
      distinctRouteCount: 1,
      preFixedFareConfirmable: true,
      fallbackReason: null
    };
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

  function buildRoutesRequestBody(options, params){
    const body = {
      origin: { address: String(params.origin || options.origin || "") },
      destination: { address: String(params.destination || options.destination || "") },
      travelMode: "DRIVE",
      routingPreference: String(params.routingPreference || options?.routingPreference || "TRAFFIC_AWARE"),
      computeAlternativeRoutes: params.computeAlternativeRoutes === true,
      extraComputations: ["TOLLS"],
      routeModifiers: {
        avoidTolls: params.avoidTolls === true,
        avoidHighways: params.avoidHighways === true,
        avoidFerries: false
      },
      languageCode: options?.languageCode || "ja",
      units: "METRIC"
    };
    const intermediateAddress = String(params.intermediateAddress || options?.intermediateAddress || "").trim();
    if(params.intermediateWaypoint){
      body.intermediates = [{
        location: {
          latLng: {
            latitude: Number(params.intermediateWaypoint.waypointLatLng.latitude),
            longitude: Number(params.intermediateWaypoint.waypointLatLng.longitude)
          }
        }
      }];
    }else if(intermediateAddress){
      body.intermediates = [{
        address: intermediateAddress
      }];
    }
    return body;
  }

  async function fetchRecommendedPool(options, userAvoidTolls){
    const intermediateAddress = String(options?.intermediateAddress || "").trim();
    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      computeAlternativeRoutes: !intermediateAddress,
      avoidTolls: userAvoidTolls,
      avoidHighways: userAvoidTolls,
      intermediateAddress: intermediateAddress
    }));
    return rawRoutes.map(function(route, index){
      return normalizeRawRoute(route, {
        routeStrategy: index === 0 ? "recommended" : "pool_candidate",
        avoidTolls: userAvoidTolls,
        avoidHighways: userAvoidTolls,
        roadType: userAvoidTolls ? "general" : "toll",
        routingPreference: "TRAFFIC_AWARE",
        generationReason: index === 0 ? "recommended_route" : "pool_candidate_route",
        rawRouteIndex: index
      });
    });
  }

  function pickShorterDistanceRoute(pool, recommendedRoute){
    if(!pool.length){
      return null;
    }
    let minDistance = Infinity;
    pool.forEach(function(route){
      const distance = Number(route.distanceMeters) || 0;
      if(distance > 0 && distance < minDistance){
        minDistance = distance;
      }
    });
    if(!Number.isFinite(minDistance)){
      return null;
    }

    const shortestCandidates = pool.filter(function(route){
      return Number(route.distanceMeters) === minDistance;
    });
    for(let index = 0; index < shortestCandidates.length; index += 1){
      const candidate = shortestCandidates[index];
      if(!recommendedRoute || !isDuplicateRoute(recommendedRoute, candidate)){
        return applyRoutePresentation(candidate, "shorter_distance");
      }
    }
    return null;
  }

  async function fetchArterialRoute(options, userAvoidTolls){
    const waypointSelector = global.PreFixedFareRouteWaypoints;
    if(!waypointSelector || typeof waypointSelector.selectArterialWaypoint !== "function"){
      return null;
    }

    const geocodeOptions = {
      apiKey: options.apiKey,
      languageCode: options.languageCode,
      region: options.region
    };
    const results = await Promise.all([
      geocodeAddress(Object.assign({}, geocodeOptions, { address: options.origin })).catch(function(){
        return null;
      }),
      geocodeAddress(Object.assign({}, geocodeOptions, { address: options.destination })).catch(function(){
        return null;
      })
    ]);
    const originLocation = results[0]?.location || null;
    const destinationLocation = results[1]?.location || null;
    if(!originLocation || !destinationLocation){
      return null;
    }

    const waypoint = waypointSelector.selectArterialWaypoint(originLocation, destinationLocation);
    if(!waypoint){
      return null;
    }

    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      computeAlternativeRoutes: false,
      avoidTolls: userAvoidTolls,
      avoidHighways: false,
      intermediateWaypoint: waypoint
    })).catch(function(){
      return [];
    });
    if(!rawRoutes.length){
      return null;
    }

    const route = applyRoutePresentation(normalizeRawRoute(rawRoutes[0], {
      routeStrategy: "arterial_road",
      avoidTolls: userAvoidTolls,
      avoidHighways: false,
      roadType: userAvoidTolls ? "general" : "toll",
      routingPreference: "TRAFFIC_AWARE",
      generationReason: "arterial_road_route",
      intermediateWaypoint: waypoint,
      rawRouteIndex: 0
    }), "arterial_road");
    route.intermediateWaypoint = waypoint;
    return route;
  }

  async function fetchTimePriorityRoute(options, userAvoidTolls){
    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      computeAlternativeRoutes: false,
      avoidTolls: userAvoidTolls,
      avoidHighways: false
    })).catch(function(){
      return [];
    });
    if(!rawRoutes.length){
      return null;
    }
    return applyRoutePresentation(normalizeRawRoute(rawRoutes[0], {
      routeStrategy: "time_priority",
      avoidTolls: userAvoidTolls,
      avoidHighways: false,
      roadType: userAvoidTolls ? "general" : "toll",
      routingPreference: "TRAFFIC_AWARE",
      generationReason: "time_priority_route",
      tollExcludedFromFare: true,
      rawRouteIndex: 0
    }), "time_priority");
  }

  async function fetchGeneralRoadPriorityRoute(options){
    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      computeAlternativeRoutes: false,
      avoidTolls: true,
      avoidHighways: true
    })).catch(function(){
      return [];
    });
    if(!rawRoutes.length){
      return null;
    }
    return applyRoutePresentation(normalizeRawRoute(rawRoutes[0], {
      routeStrategy: "general_road_priority",
      avoidTolls: true,
      avoidHighways: true,
      roadType: "general",
      routingPreference: "TRAFFIC_AWARE",
      generationReason: "general_road_priority_route",
      rawRouteIndex: 0
    }), "general_road_priority");
  }

  async function fetchDistancePriorityRoute(options, userAvoidTolls, excludeRoutes){
    const intermediateAddress = String(options?.intermediateAddress || "").trim();
    const attempts = [
      {
        computeAlternativeRoutes: !intermediateAddress,
        avoidTolls: userAvoidTolls,
        avoidHighways: userAvoidTolls,
        routingPreference: "TRAFFIC_UNAWARE",
        generationReason: "shorter_distance_traffic_unaware"
      },
      {
        computeAlternativeRoutes: !intermediateAddress,
        avoidTolls: userAvoidTolls,
        avoidHighways: false,
        routingPreference: "TRAFFIC_UNAWARE",
        generationReason: "shorter_distance_highway_allowed"
      },
      {
        computeAlternativeRoutes: !intermediateAddress,
        avoidTolls: true,
        avoidHighways: true,
        routingPreference: "TRAFFIC_UNAWARE",
        generationReason: "shorter_distance_general_road"
      }
    ];
    let bestRoute = null;
    let bestDistance = Infinity;

    for(let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1){
      const attempt = attempts[attemptIndex];
      const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
        computeAlternativeRoutes: attempt.computeAlternativeRoutes === true,
        avoidTolls: attempt.avoidTolls === true,
        avoidHighways: attempt.avoidHighways === true,
        routingPreference: attempt.routingPreference,
        intermediateAddress: intermediateAddress
      })).catch(function(){
        return [];
      });
      rawRoutes.forEach(function(route, index){
        const normalized = normalizeRawRoute(route, {
          routeStrategy: "shorter_distance",
          avoidTolls: attempt.avoidTolls === true,
          avoidHighways: attempt.avoidHighways === true,
          roadType: attempt.avoidTolls ? "general" : "toll",
          routingPreference: attempt.routingPreference,
          generationReason: attempt.generationReason,
          intermediateAddress: intermediateAddress,
          rawRouteIndex: index
        });
        if(isDuplicateOfAny(normalized, excludeRoutes)){
          return;
        }
        const distance = Number(normalized.distanceMeters) || 0;
        if(distance > 0 && distance < bestDistance){
          bestDistance = distance;
          bestRoute = normalized;
        }
      });
    }

    if(!bestRoute){
      return null;
    }
    return applyRoutePresentation(bestRoute, "shorter_distance");
  }

  async function fetchTollAllowedRoute(options, recommendedRoute){
    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      computeAlternativeRoutes: true,
      avoidTolls: false,
      avoidHighways: false
    })).catch(function(){
      return [];
    });

    for(let index = 0; index < rawRoutes.length; index += 1){
      const normalized = normalizeRawRoute(rawRoutes[index], {
        routeStrategy: "toll_allowed",
        avoidTolls: false,
        avoidHighways: false,
        roadType: "toll",
        tollPreference: "allow",
        tollExcludedFromFare: true,
        routingPreference: "TRAFFIC_AWARE",
        generationReason: "toll_allowed_route",
        rawRouteIndex: index
      });
      if(!routeUsesToll(normalized)){
        continue;
      }
      if(recommendedRoute && isDuplicateRoute(recommendedRoute, normalized)){
        continue;
      }
      const route = applyRoutePresentation(normalized, "toll_allowed");
      route.tollPreference = "allow";
      route.tollExcludedFromFare = true;
      return route;
    }
    return null;
  }

  function buildSegmentSnapshot(key, label, originAddress, destinationAddress, route){
    if(!route){
      return {
        key: key,
        label: label,
        originAddress: originAddress,
        destinationAddress: destinationAddress,
        distanceMeters: 0,
        durationSeconds: 0
      };
    }
    return {
      key: key,
      label: label,
      originAddress: originAddress,
      destinationAddress: destinationAddress,
      distanceMeters: Number(route.distanceMeters) || 0,
      durationSeconds: Number(route.durationSeconds) || 0,
      routeId: String(route.routeId || "") || null,
      routeStrategy: route.routeStrategy || null,
      encodedPolyline: String(route.encodedPolyline || "")
    };
  }

  function resolveRouteDisplayLabel(route, index){
    if(global.PreFixedFareRoutePresentation && typeof global.PreFixedFareRoutePresentation.getRouteDisplayLabel === "function"){
      return global.PreFixedFareRoutePresentation.getRouteDisplayLabel(route, index);
    }
    return String(route?.routeLabel || "");
  }

  function resolveRouteDisplayDescription(route){
    if(global.PreFixedFareRoutePresentation && typeof global.PreFixedFareRoutePresentation.getRouteDisplayDescription === "function"){
      return global.PreFixedFareRoutePresentation.getRouteDisplayDescription(route);
    }
    return String(route?.routeDescription || "");
  }

  function buildSelectableSegmentBreakdown(route){
    return {
      routeId: String(route.routeId || "") || null,
      routeStrategy: route.routeStrategy || null,
      routeLabel: resolveRouteDisplayLabel(route, 0),
      routeDescription: resolveRouteDisplayDescription(route),
      routeType: route.routeType || route.routeStrategy || null,
      strategy: route.routeStrategy || null,
      distanceMeters: Number(route.distanceMeters) || 0,
      durationSeconds: Number(route.durationSeconds) || 0,
      usesToll: routeUsesToll(route),
      encodedPolyline: String(route.encodedPolyline || "")
    };
  }

  function buildOverallRouteCandidate(outboundRoute, returnCommonRoute, selectableRoute, index){
    const outboundMeters = Number(outboundRoute?.distanceMeters) || 0;
    const outboundSeconds = Number(outboundRoute?.durationSeconds) || 0;
    const commonMeters = Number(returnCommonRoute?.distanceMeters) || 0;
    const commonSeconds = Number(returnCommonRoute?.durationSeconds) || 0;
    const selectableMeters = Number(selectableRoute?.distanceMeters) || 0;
    const selectableSeconds = Number(selectableRoute?.durationSeconds) || 0;
    const usesToll = routeUsesToll(selectableRoute);
    const routeLabel = resolveRouteDisplayLabel(selectableRoute, index);
    const routeDescription = resolveRouteDisplayDescription(selectableRoute);
    return {
      routeId: "overall_" + index,
      routeLabel: routeLabel,
      routeDescription: routeDescription,
      routeType: selectableRoute?.routeType || selectableRoute?.routeStrategy || null,
      strategy: selectableRoute?.routeStrategy || null,
      usesToll: usesToll,
      totalDistanceMeters: outboundMeters + commonMeters + selectableMeters,
      totalDurationSeconds: outboundSeconds + commonSeconds + selectableSeconds,
      segmentBreakdown: {
        outbound: {
          routeId: String(outboundRoute?.routeId || "") || null,
          routeStrategy: outboundRoute?.routeStrategy || null,
          distanceMeters: outboundMeters,
          durationSeconds: outboundSeconds
        },
        returnCommon: {
          distanceMeters: commonMeters,
          durationSeconds: commonSeconds
        },
        returnSelectable: buildSelectableSegmentBreakdown(selectableRoute)
      },
      encodedPolyline: String(selectableRoute?.encodedPolyline || ""),
      routeLegs: []
    };
  }

  function dedupeOverallRouteCandidates(candidates){
    const deduped = [];
    (candidates || []).forEach(function(candidate){
      const selectable = candidate?.segmentBreakdown?.returnSelectable || null;
      const duplicate = deduped.some(function(existing){
        const existingSelectable = existing?.segmentBreakdown?.returnSelectable || null;
        if(!selectable || !existingSelectable){
          return false;
        }
        return isDuplicateRoute(
          Object.assign({}, selectable, { encodedPolyline: selectable.encodedPolyline || "" }),
          Object.assign({}, existingSelectable, { encodedPolyline: existingSelectable.encodedPolyline || "" })
        );
      });
      if(!duplicate){
        deduped.push(candidate);
      }
    });
    return deduped.map(function(candidate, index){
      return Object.assign({}, candidate, {
        routeId: "overall_" + index
      });
    });
  }

  function buildReturnLegRouteLegs(returnCommonRoute, selectableRoute){
    const leg0 = Array.isArray(returnCommonRoute?.routeLegs) && returnCommonRoute.routeLegs.length
      ? Object.assign({}, returnCommonRoute.routeLegs[0], { legIndex: 0 })
      : {
        legIndex: 0,
        distanceMeters: Number(returnCommonRoute?.distanceMeters) || 0,
        durationSeconds: Number(returnCommonRoute?.durationSeconds) || 0,
        encodedPolyline: String(returnCommonRoute?.encodedPolyline || "")
      };
    const leg1 = Array.isArray(selectableRoute?.routeLegs) && selectableRoute.routeLegs.length
      ? Object.assign({}, selectableRoute.routeLegs[0], { legIndex: 1 })
      : {
        legIndex: 1,
        distanceMeters: Number(selectableRoute?.distanceMeters) || 0,
        durationSeconds: Number(selectableRoute?.durationSeconds) || 0,
        encodedPolyline: String(selectableRoute?.encodedPolyline || "")
      };
    return [leg0, leg1];
  }

  function synthesizeReturnLegRoute(returnCommonRoute, selectableRoute, stopAddress){
    const routeLegs = buildReturnLegRouteLegs(returnCommonRoute, selectableRoute);
    const totalDistanceMeters = routeLegs.reduce(function(sum, leg){
      return sum + (Number(leg.distanceMeters) || 0);
    }, 0);
    const totalDurationSeconds = routeLegs.reduce(function(sum, leg){
      return sum + (Number(leg.durationSeconds) || 0);
    }, 0);
    const distanceKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;
    const durationMinutes = totalDurationSeconds > 0 ? Math.max(1, Math.round(totalDurationSeconds / 60)) : 0;
    const waypointInfo = {
      waypointLabel: stopAddress,
      waypointAddress: stopAddress
    };
    const endLatLng = routeLegs[0]?.endLatLng || routeLegs[1]?.startLatLng || null;
    if(endLatLng){
      waypointInfo.waypointLatLng = {
        latitude: endLatLng.lat,
        longitude: endLatLng.lng
      };
    }
    return applyRoutePresentation(Object.assign({}, selectableRoute, {
      routeId: String(selectableRoute?.routeId || ""),
      distanceMeters: totalDistanceMeters,
      durationSeconds: totalDurationSeconds,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      encodedPolyline: String(selectableRoute?.encodedPolyline || ""),
      routeLegs: routeLegs,
      intermediateWaypoint: Object.assign({}, selectableRoute?.intermediateWaypoint || {}, waypointInfo)
    }), selectableRoute?.routeStrategy || "recommended");
  }

  function buildSynthesizedReturnLegApiResult(returnCommonRoute, selectableRoute, stopAddress, allSelectableCandidates){
    const candidates = Array.isArray(allSelectableCandidates) && allSelectableCandidates.length
      ? allSelectableCandidates
      : (selectableRoute ? [selectableRoute] : []);
    const synthesizedRoutes = candidates.map(function(candidate){
      return synthesizeReturnLegRoute(returnCommonRoute, candidate, stopAddress);
    });
    if(!synthesizedRoutes.length){
      return {
        distanceKm: 0,
        durationMinutes: 0,
        distanceMeters: 0,
        durationSeconds: 0,
        selectedRouteId: "",
        routes: [],
        routeCandidates: [],
        routeCandidateCount: 0,
        distinctRouteCount: 0,
        alternativeRouteCount: 0,
        multipleRoutesAvailable: false,
        preFixedFareConfirmable: false,
        routeDedupedCount: 0,
        routeGenerationStrategies: [],
        rawRouteCount: 0,
        fallbackReason: "only_one_distinct_route"
      };
    }
    const primaryId = String(selectableRoute?.routeId || "");
    const primary = synthesizedRoutes.find(function(route){
      return primaryId && String(route?.routeId || "") === primaryId;
    }) || synthesizedRoutes[0];
    const confirmable = synthesizedRoutes.length >= MIN_ROUTE_CANDIDATES;
    return {
      distanceKm: primary.distanceKm,
      durationMinutes: primary.durationMinutes,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      selectedRouteId: primary.routeId,
      routes: synthesizedRoutes,
      routeCandidates: synthesizedRoutes,
      routeCandidateCount: synthesizedRoutes.length,
      distinctRouteCount: synthesizedRoutes.length,
      alternativeRouteCount: synthesizedRoutes.length,
      multipleRoutesAvailable: confirmable,
      preFixedFareConfirmable: confirmable,
      routeDedupedCount: synthesizedRoutes.length,
      routeGenerationStrategies: DISPLAY_STRATEGY_ORDER.slice(),
      rawRouteCount: candidates.length,
      fallbackReason: confirmable ? null : "only_one_distinct_route"
    };
  }

  async function computeSegmentRouteCandidates(options){
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

    const routeGenerationStrategies = DISPLAY_STRATEGY_ORDER.concat([
      "recommended"
    ]);

    const timePriorityRoute = await fetchTimePriorityRoute(options, userAvoidTolls);
    const generalRoadPriorityRoute = await fetchGeneralRoadPriorityRoute(options);
    const recommendedPool = await fetchRecommendedPool(options, userAvoidTolls);
    if(!recommendedPool.length && !timePriorityRoute && !generalRoadPriorityRoute){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }

    const recommendedRoute = recommendedPool.length
      ? applyRoutePresentation(recommendedPool[0], "recommended")
      : null;
    let shorterDistanceRoute = recommendedRoute
      ? pickShorterDistanceRoute(recommendedPool, recommendedRoute)
      : null;
    const tollAllowedRoute = recommendedRoute
      ? await fetchTollAllowedRoute(options, recommendedRoute)
      : await fetchTollAllowedRoute(options, timePriorityRoute);

    const provisionalRoutes = [
      timePriorityRoute,
      generalRoadPriorityRoute,
      shorterDistanceRoute,
      tollAllowedRoute
    ].filter(Boolean);
    if(!shorterDistanceRoute || isDuplicateOfAny(shorterDistanceRoute, provisionalRoutes.filter(function(route){
      return route !== shorterDistanceRoute;
    }))){
      shorterDistanceRoute = await fetchDistancePriorityRoute(options, userAvoidTolls, provisionalRoutes);
    }

    let slots = assembleStrategySlotRoutes({
      time_priority: timePriorityRoute,
      general_road_priority: generalRoadPriorityRoute,
      shorter_distance: shorterDistanceRoute,
      toll_allowed: tollAllowedRoute
    });
    slots = await fillMissingStrategySlots(slots, options, userAvoidTolls);

    const orderedRoutes = slotsToOrderedRoutes(slots);
    const ensured = await ensureMinimumRouteCandidates(orderedRoutes, options);
    const finalRoutes = ensured.routes;
    const preFixedFareConfirmable = ensured.preFixedFareConfirmable === true;
    const primary = finalRoutes[0] || timePriorityRoute || generalRoadPriorityRoute || recommendedRoute;

    return {
      distanceKm: primary.distanceKm,
      durationMinutes: primary.durationMinutes,
      distanceMeters: primary.distanceMeters,
      durationSeconds: primary.durationSeconds,
      selectedRouteId: primary.routeId,
      routes: finalRoutes,
      routeCandidates: finalRoutes,
      routeCandidateCount: finalRoutes.length,
      distinctRouteCount: ensured.distinctRouteCount,
      alternativeRouteCount: finalRoutes.length,
      multipleRoutesAvailable: preFixedFareConfirmable,
      preFixedFareConfirmable: preFixedFareConfirmable,
      routeDedupedCount: orderedRoutes.length,
      routeGenerationStrategies: routeGenerationStrategies,
      rawRouteCount: recommendedPool.length,
      fallbackReason: ensured.fallbackReason
    };
  }

  function assembleOverallRouteSelection(options){
    const homeAddress = String(options?.homeAddress || "").trim();
    const goalAddress = String(options?.goalAddress || "").trim();
    const stopAddress = String(options?.stopAddress || "").trim();
    const outboundRoute = options?.outboundRoute || null;
    const outboundRouteCandidates = Array.isArray(options?.outboundRouteCandidates)
      ? options.outboundRouteCandidates
      : (outboundRoute ? [outboundRoute] : []);
    const returnCommonRoute = options?.returnCommonRoute || null;
    const selectableCandidates = Array.isArray(options?.selectableCandidates)
      ? options.selectableCandidates
      : [];

    if(!homeAddress || !goalAddress || !stopAddress || !outboundRoute || !returnCommonRoute || !selectableCandidates.length){
      return null;
    }

    const outboundLabel = String(homeAddress) + " → " + String(goalAddress);
    const returnCommonLabel = String(goalAddress) + " → " + String(stopAddress);
    const selectableLabel = String(stopAddress) + " → " + String(homeAddress);
    const assembledOverall = selectableCandidates.map(function(selectableRoute, index){
      return buildOverallRouteCandidate(outboundRoute, returnCommonRoute, selectableRoute, index);
    });
    const overallRouteCandidates = dedupeOverallRouteCandidates(assembledOverall).slice(0, MAX_ROUTE_CANDIDATES);
    const overallConfirmable = overallRouteCandidates.length >= 2;
    const outboundNeedsSelection = outboundRouteCandidates.length >= 2;
    const selectionPhase = String(options?.selectionPhase || "").trim()
      || (outboundNeedsSelection ? "outbound" : "overall");

    return {
      routePlanType: "return_with_stop",
      selectionPhase: selectionPhase,
      fixedOutboundRouteId: String(outboundRoute?.routeId || "") || null,
      commonSegments: [
        buildSegmentSnapshot("outbound", outboundLabel, homeAddress, goalAddress, outboundRoute),
        buildSegmentSnapshot("return_common", returnCommonLabel, goalAddress, stopAddress, returnCommonRoute)
      ],
      selectableSegment: {
        key: "return_selectable",
        label: selectableLabel,
        originAddress: stopAddress,
        destinationAddress: homeAddress
      },
      overallRouteCandidates: overallRouteCandidates,
      selectedOverallRouteId: options?.selectedOverallRouteId || null,
      preFixedFareConfirmable: overallConfirmable,
      fallbackReason: overallConfirmable ? null : "only_one_distinct_route"
    };
  }

  async function computeReturnWithStopOverallRouteSelection(options){
    const apiKey = String(options?.apiKey || "").trim();
    const homeAddress = String(options?.homeAddress || "").trim();
    const goalAddress = String(options?.goalAddress || "").trim();
    const stopAddress = String(options?.stopAddress || "").trim();
    const outboundRoute = options?.outboundRoute || null;
    const outboundRouteCandidates = Array.isArray(options?.outboundRouteCandidates)
      ? options.outboundRouteCandidates
      : (outboundRoute ? [outboundRoute] : []);
    const userAvoidTolls = options?.roadType === "general";

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!homeAddress || !goalAddress || !stopAddress){
      throw new Error("出発地・目的地・立ち寄り先を入力してください。");
    }
    if(!outboundRoute){
      throw new Error("往路ルートが見つかりませんでした。");
    }

    const returnCommonRaw = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      origin: goalAddress,
      destination: stopAddress,
      computeAlternativeRoutes: false,
      avoidTolls: userAvoidTolls,
      avoidHighways: userAvoidTolls
    }));
    if(!returnCommonRaw.length){
      throw new Error("復路共通区間（目的地 → 立ち寄り先）のルートが見つかりませんでした。");
    }
    const returnCommonRoute = applyRoutePresentation(normalizeRawRoute(returnCommonRaw[0], {
      routeStrategy: "recommended",
      avoidTolls: userAvoidTolls,
      avoidHighways: userAvoidTolls,
      roadType: userAvoidTolls ? "general" : "toll",
      rawRouteIndex: 0
    }), "recommended");

    const selectableResult = await computeSegmentRouteCandidates(Object.assign({}, options, {
      origin: stopAddress,
      destination: homeAddress
    }));
    const selectableCandidates = Array.isArray(selectableResult?.routeCandidates)
      ? selectableResult.routeCandidates
      : [];
    if(!selectableCandidates.length){
      throw new Error("選択区間（立ち寄り先 → 出発地）のルートが見つかりませんでした。");
    }

    const outboundNeedsSelection = outboundRouteCandidates.length >= 2;
    const overallRouteSelection = assembleOverallRouteSelection({
      homeAddress: homeAddress,
      goalAddress: goalAddress,
      stopAddress: stopAddress,
      outboundRoute: outboundRoute,
      outboundRouteCandidates: outboundRouteCandidates,
      returnCommonRoute: returnCommonRoute,
      selectableCandidates: selectableCandidates,
      selectionPhase: outboundNeedsSelection ? "outbound" : "overall"
    });
    const primarySelectable = selectableCandidates.find(function(route){
      const primaryId = String(selectableResult?.selectedRouteId || "");
      return primaryId && String(route?.routeId || "") === primaryId;
    }) || selectableCandidates[0] || null;

    return {
      overallRouteSelection: overallRouteSelection,
      returnLegApiResult: buildSynthesizedReturnLegApiResult(returnCommonRoute, primarySelectable, stopAddress, selectableCandidates),
      returnCommonRoute: returnCommonRoute,
      selectableResult: selectableResult
    };
  }

  async function computePreFixedFareRouteCandidates(options){
    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    return computeSegmentRouteCandidates(options);
  }

  function normalizeRoute(route, index, context){
    const distanceMeters = Number(route?.distanceMeters) || 0;
    const durationSeconds = parseDurationSeconds(route?.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0;
    const routeLegs = normalizeRouteLegs(route);
    const intermediateWaypoint = context?.intermediateWaypoint
      || buildIntermediateWaypointFromLegs(routeLegs, context?.intermediateAddress);
    return {
      routeId: "route_" + index,
      distanceMeters: distanceMeters,
      durationSeconds: durationSeconds,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      encodedPolyline: String(route?.polyline?.encodedPolyline || ""),
      routeLabels: Array.isArray(route?.routeLabels) ? route.routeLabels.slice() : [],
      routeToken: String(route?.routeToken || ""),
      tollInfo: route?.travelAdvisory?.tollInfo || null,
      routeLegs: routeLegs,
      intermediateWaypoint: intermediateWaypoint
    };
  }

  async function computeRouteDistance(options){
    if(options?.requestPreFixedFareCandidates === true){
      return computePreFixedFareRouteCandidates(options);
    }

    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();
    const intermediateAddress = String(options?.intermediateAddress || "").trim();
    const requestAlternativeRoutes = options?.requestAlternativeRoutes === true;

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
      origin: origin,
      destination: destination,
      computeAlternativeRoutes: requestAlternativeRoutes && !intermediateAddress,
      avoidTolls: options?.roadType === "general",
      avoidHighways: options?.roadType === "general",
      intermediateAddress: intermediateAddress
    }));

    if(!rawRoutes.length){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }
    const routes = rawRoutes.map(function(route, index){
      return normalizeRoute(route, index, {
        intermediateAddress: intermediateAddress
      });
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
    computeReturnWithStopOverallRouteSelection: computeReturnWithStopOverallRouteSelection,
    assembleOverallRouteSelection: assembleOverallRouteSelection,
    assembleStrategySlotRoutes: assembleStrategySlotRoutes,
    ensureMinimumRouteCandidates: ensureMinimumRouteCandidates,
    DISPLAY_STRATEGY_ORDER: DISPLAY_STRATEGY_ORDER.slice(),
    isDuplicateRoute: isDuplicateRoute,
    isSameEncodedPath: isSameEncodedPath,
    geocodeAddress: geocodeAddress
  };
})(typeof window !== "undefined" ? window : globalThis);
