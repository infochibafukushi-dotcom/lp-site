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

  function isDuplicateRoute(left, right){
    if(!left || !right){
      return false;
    }
    if(getRouteRoutingFingerprint(left) !== getRouteRoutingFingerprint(right)){
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

  function buildConfirmationFallbackRoute(primaryRoute){
    const primary = applyRoutePresentation(Object.assign({}, primaryRoute, {
      routeStrategy: "time_priority",
      generationReason: primaryRoute?.generationReason || "time_priority_route"
    }), "time_priority");
    const fallback = applyRoutePresentation(Object.assign({}, primary, {
      routeStrategy: "confirmation_fallback",
      generationReason: "confirmation_fallback_route",
      isConfirmationFallback: true,
      routeLabel: "確認対応ルート",
      routeDescription: "予約受付後に、道路状況を確認して最適なルートをご案内します。",
      routeSummary: "確認対応ルート"
    }), "confirmation_fallback");
    return fallback;
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
      routes: assignRouteIds([primary, buildConfirmationFallbackRoute(primary)]),
      distinctRouteCount: 1,
      preFixedFareConfirmable: false,
      fallbackReason: "only_one_distinct_route"
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
      routingPreference: "TRAFFIC_AWARE",
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
      usesToll: routeUsesToll(route) || route.usesToll === true,
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
    const usesToll = routeUsesToll(selectableRoute) || selectableRoute?.usesToll === true;
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

  function buildSynthesizedReturnLegApiResult(returnCommonRoute, selectableRoute, stopAddress){
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
    const synthesizedRoute = applyRoutePresentation(Object.assign({}, selectableRoute, {
      routeId: String(selectableRoute?.routeId || "route_0"),
      distanceMeters: totalDistanceMeters,
      durationSeconds: totalDurationSeconds,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      encodedPolyline: String(selectableRoute?.encodedPolyline || ""),
      routeLegs: routeLegs,
      intermediateWaypoint: Object.assign({}, selectableRoute?.intermediateWaypoint || {}, waypointInfo)
    }), selectableRoute?.routeStrategy || "recommended");

    return {
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      distanceMeters: totalDistanceMeters,
      durationSeconds: totalDurationSeconds,
      selectedRouteId: synthesizedRoute.routeId,
      routes: [synthesizedRoute],
      routeCandidates: [synthesizedRoute],
      routeCandidateCount: 1,
      distinctRouteCount: 1,
      alternativeRouteCount: 1,
      multipleRoutesAvailable: false,
      preFixedFareConfirmable: false,
      routeDedupedCount: 1,
      routeGenerationStrategies: ["recommended"],
      rawRouteCount: 1,
      fallbackReason: "only_one_distinct_route"
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

    const routeGenerationStrategies = [
      "time_priority",
      "general_road_priority",
      "recommended",
      "shorter_distance",
      "arterial_road",
      "toll_allowed"
    ];

    const timePriorityRoute = await fetchTimePriorityRoute(options, userAvoidTolls);
    const generalRoadPriorityRoute = await fetchGeneralRoadPriorityRoute(options);
    const recommendedPool = await fetchRecommendedPool(options, userAvoidTolls);
    if(!recommendedPool.length && !timePriorityRoute && !generalRoadPriorityRoute){
      throw new Error("ルートが見つかりませんでした。住所を確認してください。");
    }

    const recommendedRoute = recommendedPool.length
      ? applyRoutePresentation(recommendedPool[0], "recommended")
      : null;
    const shorterDistanceRoute = recommendedRoute
      ? pickShorterDistanceRoute(recommendedPool, recommendedRoute)
      : null;
    const arterialRoute = await fetchArterialRoute(options, userAvoidTolls);
    const tollAllowedRoute = recommendedRoute
      ? await fetchTollAllowedRoute(options, recommendedRoute)
      : await fetchTollAllowedRoute(options, timePriorityRoute);

    const assembled = [
      timePriorityRoute,
      generalRoadPriorityRoute,
      recommendedRoute,
      shorterDistanceRoute,
      arterialRoute,
      tollAllowedRoute
    ].filter(Boolean);

    const deduped = assignRouteIds(dedupeRoutes(assembled)).slice(0, MAX_ROUTE_CANDIDATES);
    const ensured = await ensureMinimumRouteCandidates(deduped, options);
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
      routeDedupedCount: deduped.length,
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
      returnLegApiResult: buildSynthesizedReturnLegApiResult(returnCommonRoute, primarySelectable, stopAddress),
      returnCommonRoute: returnCommonRoute,
      selectableResult: selectableResult
    };
  }

  async function computePreFixedFareRouteCandidates(options){
    const apiKey = String(options?.apiKey || "").trim();
    const origin = String(options?.origin || "").trim();
    const destination = String(options?.destination || "").trim();
    const intermediateAddress = String(options?.intermediateAddress || "").trim();
    const userAvoidTolls = options?.roadType === "general";

    if(!apiKey){
      throw new Error("Google Maps APIキーが設定されていません。");
    }
    if(!origin || !destination){
      throw new Error("出発地と目的地を入力してください。");
    }

    if(intermediateAddress){
      const rawRoutes = await fetchRoutesRequest(options, buildRoutesRequestBody(options, {
        origin: origin,
        destination: destination,
        computeAlternativeRoutes: false,
        avoidTolls: userAvoidTolls,
        avoidHighways: userAvoidTolls,
        intermediateAddress: intermediateAddress
      }));
      if(!rawRoutes.length){
        throw new Error("ルートが見つかりませんでした。住所を確認してください。");
      }
      const route = applyRoutePresentation(normalizeRawRoute(rawRoutes[0], {
        routeStrategy: "time_priority",
        avoidTolls: userAvoidTolls,
        avoidHighways: userAvoidTolls,
        roadType: userAvoidTolls ? "general" : "toll",
        intermediateAddress: intermediateAddress,
        rawRouteIndex: 0
      }), "time_priority");
      const ensured = await ensureMinimumRouteCandidates([route], options);
      const finalRoutes = ensured.routes;
      const preFixedFareConfirmable = ensured.preFixedFareConfirmable === true;
      const primary = finalRoutes[0];
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
        routeDedupedCount: 1,
        routeGenerationStrategies: ["time_priority"],
        rawRouteCount: rawRoutes.length,
        fallbackReason: ensured.fallbackReason
      };
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
    ensureMinimumRouteCandidates: ensureMinimumRouteCandidates,
    geocodeAddress: geocodeAddress
  };
})(typeof window !== "undefined" ? window : globalThis);
