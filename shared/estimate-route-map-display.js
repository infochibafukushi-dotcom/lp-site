(function(global){
  const ROUTE_COLORS = {
    routeA: "#C62828",
    routeB: "#1565C0",
    routeC: "#F9A825",
    routeD: "#212121"
  };

  const ROUTE_COLOR_HEX = {
    routeA: "0xC62828FF",
    routeB: "0x1565C0FF",
    routeC: "0xF9A825FF",
    routeD: "0x212121FF"
  };

  const ROUTE_OPTION_KEYS = ["routeA", "routeB", "routeC", "routeD"];

  const CANDIDATE_ROUTE_META = {
    time_priority: {
      key: "routeA",
      abLabel: "A",
      oneWayLabel: "A 時間優先ルート",
      roundTripLabel: "A 時間優先の往復ルート",
      legendLabel: "A 赤線：時間優先ルート",
      color: ROUTE_COLORS.routeA,
      lineStyle: "solid",
      drawOrder: 0
    },
    general_road_priority: {
      key: "routeB",
      abLabel: "B",
      oneWayLabel: "B 一般道優先ルート",
      roundTripLabel: "B 一般道優先の往復ルート",
      legendLabel: "B 青点線：一般道優先ルート",
      color: ROUTE_COLORS.routeB,
      lineStyle: "dashed",
      drawOrder: 3
    },
    shorter_distance: {
      key: "routeC",
      abLabel: "C",
      oneWayLabel: "C 距離優先ルート",
      roundTripLabel: "C 距離優先の往復ルート",
      legendLabel: "C 黄線：距離優先ルート",
      color: ROUTE_COLORS.routeC,
      lineStyle: "solid",
      drawOrder: 1
    },
    toll_allowed: {
      key: "routeD",
      abLabel: "D",
      oneWayLabel: "D 有料道路優先ルート",
      roundTripLabel: "D 有料道路優先の往復ルート",
      legendLabel: "D 黒線：有料道路優先ルート",
      color: ROUTE_COLORS.routeD,
      lineStyle: "solid",
      drawOrder: 2
    }
  };

  const CANDIDATE_STRATEGY_ORDER = [
    "time_priority",
    "general_road_priority",
    "shorter_distance",
    "toll_allowed"
  ];
  const MIN_DISPLAY_ROUTE_CANDIDATES = 2;
  const MAX_DISPLAY_ROUTE_CANDIDATES = 4;
  const MAP_RENDER_STRATEGIES = CANDIDATE_STRATEGY_ORDER.slice();

  // 後方互換
  const AB_ROUTE_META = CANDIDATE_ROUTE_META;

  function decodePolyline(encoded){
    const poly = String(encoded || "");
    if(!poly) return [];
    let index = 0;
    const len = poly.length;
    let lat = 0;
    let lng = 0;
    const points = [];

    while(index < len){
      let b;
      let shift = 0;
      let result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
  }

  function getLegPrimaryRoute(leg){
    if(!leg){
      return null;
    }
    if(Array.isArray(leg.routes) && leg.routes.length){
      const selectedId = String(leg.selectedRouteId || "");
      const selected = leg.routes.find(function(route){
        return String(route?.routeId || "") === selectedId;
      });
      return selected || leg.routes[0];
    }
    return {
      encodedPolyline: String(leg.encodedPolyline || ""),
      distanceMeters: Number(leg.distanceMeters) || 0,
      durationSeconds: Number(leg.durationSeconds) || 0
    };
  }

  function concatLegPaths(paths){
    if(!Array.isArray(paths) || !paths.length){
      return [];
    }
    const combined = paths[0].slice();
    for(let i = 1; i < paths.length; i++){
      const nextPath = paths[i];
      if(!Array.isArray(nextPath) || nextPath.length < 2){
        continue;
      }
      const startIndex = combined.length
        && combined[combined.length - 1].lat === nextPath[0].lat
        && combined[combined.length - 1].lng === nextPath[0].lng
        ? 1
        : 0;
      combined.push.apply(combined, nextPath.slice(startIndex));
    }
    return combined.length >= 2 ? combined : [];
  }

  function getLegPath(leg){
    const route = getLegPrimaryRoute(leg);
    const routeLegs = Array.isArray(route?.routeLegs) ? route.routeLegs : [];
    if(routeLegs.length >= 2){
      const legPaths = routeLegs.map(function(routeLeg){
        return decodePolyline(routeLeg?.encodedPolyline || "");
      }).filter(function(path){
        return path.length >= 2;
      });
      const combined = concatLegPaths(legPaths);
      if(combined.length >= 2){
        return combined;
      }
    }
    return decodePolyline(route?.encodedPolyline || leg?.encodedPolyline || "");
  }

  function getRouteStrategyKey(route){
    return String(route?.routeStrategy || route?.routeType || route?.strategy || "").trim();
  }

  function getLegRouteCandidates(legOrPlan){
    if(!legOrPlan){
      return [];
    }
    if(Array.isArray(legOrPlan.routeCandidates) && legOrPlan.routeCandidates.length){
      return legOrPlan.routeCandidates;
    }
    if(Array.isArray(legOrPlan.routes) && legOrPlan.routes.length){
      return legOrPlan.routes;
    }
    return [];
  }

  function findCandidateByStrategy(legOrPlan, strategy){
    const target = String(strategy || "").trim();
    if(!target){
      return null;
    }
    return getLegRouteCandidates(legOrPlan).find(function(route){
      return getRouteStrategyKey(route) === target;
    }) || null;
  }

  function getDisplayRouteCandidates(legOrPlan){
    const all = getLegRouteCandidates(legOrPlan);
    if(!all.length){
      return [];
    }
    const ordered = [];
    MAP_RENDER_STRATEGIES.forEach(function(strategy){
      const route = findCandidateByStrategy(legOrPlan, strategy);
      if(route){
        ordered.push(route);
      }
    });
    if(ordered.length){
      return ordered.slice(0, MAX_DISPLAY_ROUTE_CANDIDATES);
    }
    return all.slice(0, MAX_DISPLAY_ROUTE_CANDIDATES);
  }

  function pathFromRoute(route){
    const routeLegs = Array.isArray(route?.routeLegs) ? route.routeLegs : [];
    if(routeLegs.length >= 2){
      const legPaths = routeLegs.map(function(routeLeg){
        return decodePolyline(routeLeg?.encodedPolyline || "");
      }).filter(function(path){
        return path.length >= 2;
      });
      const combined = concatLegPaths(legPaths);
      if(combined.length >= 2){
        return combined;
      }
    }
    if(routeLegs.length === 1){
      const singlePath = decodePolyline(routeLegs[0]?.encodedPolyline || "");
      if(singlePath.length >= 2){
        return singlePath;
      }
    }
    return decodePolyline(route?.encodedPolyline || "");
  }

  function pushAbSegment(segments, meta, route, options){
    const opts = options || {};
    const path = pathFromRoute(route);
    if(path.length < 2){
      return false;
    }
    segments.push({
      key: meta.key,
      abLabel: meta.abLabel,
      color: meta.color,
      lineStyle: meta.lineStyle || "solid",
      drawOrder: Number(meta.drawOrder) || 0,
      legendLabel: meta.legendLabel || meta.oneWayLabel,
      path: path,
      label: opts.isRoundTrip ? meta.roundTripLabel : meta.oneWayLabel,
      isAbRoute: true,
      legRole: opts.legRole || "outbound"
    });
    return true;
  }

  function appendCandidateSegmentsForLeg(segments, leg, options){
    const opts = options || {};
    const legRole = opts.legRole || "outbound";
    const isRoundTrip = opts.isRoundTrip === true;
    if(!leg){
      return;
    }
    CANDIDATE_STRATEGY_ORDER.forEach(function(strategy){
      const meta = CANDIDATE_ROUTE_META[strategy];
      const route = findCandidateByStrategy(leg, strategy);
      if(!meta || !route){
        return;
      }
      pushAbSegment(segments, meta, route, {
        isRoundTrip: isRoundTrip,
        legRole: legRole
      });
    });
  }

  function buildAbRouteMapSegments(routePlan){
    const segments = [];
    if(!routePlan){
      return segments;
    }

    const outboundLeg = routePlan.outboundRoutePlan;
    const returnLeg = routePlan.returnRoutePlan;
    const hasReturnLeg = Boolean(returnLeg);

    if(outboundLeg){
      appendLegDisplaySegments(segments, outboundLeg, {
        isRoundTrip: hasReturnLeg,
        legRole: "outbound"
      });
    }
    if(returnLeg){
      appendLegDisplaySegments(segments, returnLeg, {
        isRoundTrip: true,
        legRole: "return"
      });
    }
    if(!outboundLeg && !returnLeg){
      appendLegDisplaySegments(segments, routePlan, {
        isRoundTrip: false,
        legRole: "outbound"
      });
    }
    return segments;
  }

  function legHasRouteCandidates(leg){
    if(!leg){
      return false;
    }
    return CANDIDATE_STRATEGY_ORDER.some(function(strategy){
      return Boolean(findCandidateByStrategy(leg, strategy));
    });
  }

  function hasAbRouteMapSegments(routePlan){
    const outboundLeg = routePlan?.outboundRoutePlan || routePlan;
    return legHasRouteCandidates(outboundLeg);
  }

  function hasReturnAbRouteMapSegments(routePlan){
    return legHasRouteCandidates(routePlan?.returnRoutePlan);
  }

  function mergeSegmentsByStrategyKey(segments){
    const orderedKeys = ROUTE_OPTION_KEYS;
    const byKey = {};
    (segments || []).forEach(function(segment){
      if(!segment?.key || !segment.isAbRoute){
        return;
      }
      if(!byKey[segment.key]){
        byKey[segment.key] = Object.assign({}, segment, {
          path: Array.isArray(segment.path) ? segment.path.slice() : []
        });
        return;
      }
      byKey[segment.key].path = concatLegPaths([byKey[segment.key].path, segment.path]);
    });
    return orderedKeys.map(function(key){
      return byKey[key] || null;
    }).filter(function(segment){
      return segment && Array.isArray(segment.path) && segment.path.length >= 2;
    });
  }

  function finalizeDisplaySegments(segments){
    const abOnly = (segments || []).filter(function(segment){
      return segment.isAbRoute && ROUTE_OPTION_KEYS.indexOf(segment.key) >= 0;
    });
    if(abOnly.length){
      return mergeSegmentsByStrategyKey(abOnly);
    }
    return [];
  }

  function getStrategyMetaForRoute(route){
    const strategy = getRouteStrategyKey(route);
    if(CANDIDATE_ROUTE_META[strategy]){
      return CANDIDATE_ROUTE_META[strategy];
    }
    return CANDIDATE_ROUTE_META.time_priority;
  }

  function appendSelectedLegSegment(segments, leg, options){
    const opts = options || {};
    const route = getLegPrimaryRoute(leg);
    if(!route){
      return false;
    }
    const meta = getStrategyMetaForRoute(route);
    const path = getLegPath(leg);
    if(path.length < 2){
      return false;
    }
    segments.push({
      key: meta.key,
      abLabel: meta.abLabel,
      color: meta.color,
      lineStyle: meta.lineStyle || "solid",
      drawOrder: Number(meta.drawOrder) || 0,
      legendLabel: meta.legendLabel || meta.oneWayLabel,
      path: path,
      label: opts.isRoundTrip ? meta.roundTripLabel : meta.oneWayLabel,
      isAbRoute: true,
      legRole: opts.legRole || "outbound"
    });
    return true;
  }

  function appendLegDisplaySegments(segments, leg, options){
    const beforeLen = segments.length;
    appendCandidateSegmentsForLeg(segments, leg, options);
    if(segments.length === beforeLen){
      appendSelectedLegSegment(segments, leg, options);
    }
  }

  function buildStrategyFallbackSegments(routePlan){
    const segments = [];
    const outboundLeg = routePlan?.outboundRoutePlan;
    const returnLeg = routePlan?.returnRoutePlan;
    if(outboundLeg){
      appendLegDisplaySegments(segments, outboundLeg, {
        isRoundTrip: Boolean(returnLeg),
        legRole: "outbound"
      });
    }
    if(returnLeg){
      appendLegDisplaySegments(segments, returnLeg, {
        isRoundTrip: true,
        legRole: "return"
      });
    }
    if(!outboundLeg && !returnLeg){
      appendLegDisplaySegments(segments, routePlan, {
        isRoundTrip: false,
        legRole: "outbound"
      });
    }
    return segments;
  }

  function getStrategyMapKey(strategy){
    const meta = CANDIDATE_ROUTE_META[String(strategy || "").trim()];
    return meta?.key || "";
  }

  function filterSegmentsByActiveStrategy(segments, activeStrategy){
    const key = getStrategyMapKey(activeStrategy);
    if(!key){
      return segments;
    }
    const filtered = (segments || []).filter(function(segment){
      return segment?.key === key;
    });
    return filtered.length ? filtered : segments;
  }

  function buildDisplayRouteMapSegments(routePlan, waypointLatLng, options){
    if(!routePlan){
      return [];
    }
    let rawSegments = buildAbRouteMapSegments(routePlan);
    if(!rawSegments.some(function(segment){
      return segment.isAbRoute;
    })){
      rawSegments = buildStrategyFallbackSegments(routePlan);
    }
    const segments = finalizeDisplaySegments(rawSegments);
    const activeStrategy = String(options?.activeStrategy || "").trim();
    if(activeStrategy){
      return filterSegmentsByActiveStrategy(segments, activeStrategy);
    }
    return segments;
  }

  function haversineMeters(a, b){
    const toRad = function(value){
      return value * Math.PI / 180;
    };
    const earthRadius = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.asin(Math.sqrt(h));
  }

  function projectPointOnSegment(start, end, point){
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const lengthSquared = dx * dx + dy * dy;
    if(lengthSquared === 0){
      return start;
    }
    let t = ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    return {
      lat: start.lat + t * dy,
      lng: start.lng + t * dx
    };
  }

  function findBestSplitIndex(path, lat, lng){
    if(!Array.isArray(path) || path.length < 3){
      return -1;
    }
    const target = { lat: lat, lng: lng };
    let bestIndex = 1;
    let bestDistance = Infinity;
    for(let i = 0; i < path.length - 1; i++){
      const projected = projectPointOnSegment(path[i], path[i + 1], target);
      const distance = haversineMeters(projected, target);
      if(distance < bestDistance){
        bestDistance = distance;
        bestIndex = i + 1;
      }
    }
    if(bestIndex <= 0){
      bestIndex = 1;
    }
    if(bestIndex >= path.length - 1){
      bestIndex = path.length - 2;
    }
    return bestIndex;
  }

  function findInteriorSplitIndex(path, lat, lng){
    return findBestSplitIndex(path, lat, lng);
  }

  function buildStopReturnPathsFromRouteLegs(primaryRoute, fullPath){
    const routeLegs = Array.isArray(primaryRoute?.routeLegs) ? primaryRoute.routeLegs : [];
    if(routeLegs.length < 2){
      return null;
    }
    const stopPathFromLeg = decodePolyline(routeLegs[0].encodedPolyline || "");
    const returnPathFromLeg = decodePolyline(routeLegs[1].encodedPolyline || "");
    if(stopPathFromLeg.length >= 2 && returnPathFromLeg.length >= 2){
      return {
        stopPath: stopPathFromLeg,
        returnPath: returnPathFromLeg,
        waypointLatLng: routeLegs[0].endLatLng || routeLegs[1].startLatLng || null
      };
    }
    const path = Array.isArray(fullPath) && fullPath.length >= 2
      ? fullPath
      : decodePolyline(primaryRoute?.encodedPolyline || "");
    const waypointLatLng = routeLegs[0].endLatLng || routeLegs[1].startLatLng || null;
    if(path.length >= 2 && waypointLatLng){
      const split = splitPathAtClosest(path, waypointLatLng);
      if(split.after && split.before.length >= 2 && split.after.length >= 2){
        return {
          stopPath: split.before,
          returnPath: split.after,
          waypointLatLng: waypointLatLng
        };
      }
    }
    return null;
  }

  function normalizeLatLng(point){
    if(!point){
      return null;
    }
    if(point.lat != null && point.lng != null){
      const lat = Number(point.lat);
      const lng = Number(point.lng);
      if(Number.isFinite(lat) && Number.isFinite(lng)){
        return { lat: lat, lng: lng };
      }
    }
    if(point.latitude != null && point.longitude != null){
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);
      if(Number.isFinite(lat) && Number.isFinite(lng)){
        return { lat: lat, lng: lng };
      }
    }
    if(point.waypointLatLng){
      return normalizeLatLng(point.waypointLatLng);
    }
    return null;
  }

  function splitPathAtClosest(path, latLng){
    if(!Array.isArray(path) || path.length < 2 || !latLng){
      return { before: path, after: null, splitPoint: null };
    }
    const index = findInteriorSplitIndex(path, latLng.lat, latLng.lng);
    if(index < 0){
      return { before: path, after: null, splitPoint: null };
    }
    return {
      before: path.slice(0, index + 1),
      after: path.slice(index),
      splitPoint: path[index]
    };
  }

  function buildRouteMapSegments(routePlan, waypointLatLng){
    return buildDisplayRouteMapSegments(routePlan, waypointLatLng);
  }

  function buildRouteMapMarkers(routePlan, segments, waypointLatLng){
    const markers = [];
    if(!routePlan || !segments.length){
      return markers;
    }

    const outboundLeg = routePlan.outboundRoutePlan;
    const returnLeg = routePlan.returnRoutePlan;
    const returnPlanType = String(routePlan.returnPlanType || "");
    const primarySegment = (segments || []).find(function(segment){
      return segment.isAbRoute && Array.isArray(segment.path) && segment.path.length >= 2;
    });
    const outboundPath = primarySegment?.path
      || (outboundLeg ? getLegPath(outboundLeg) : segments[0]?.path);

    if(outboundPath.length >= 2){
      markers.push({
        position: outboundPath[0],
        title: "出発地",
        label: "発",
        color: "0x2E7D32"
      });
      markers.push({
        position: outboundPath[outboundPath.length - 1],
        title: "目的地",
        label: "着",
        color: "0xC62828"
      });
    }

    if(returnLeg && returnPlanType === "return_with_stop"){
      const stopPosition = waypointLatLng
        || normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint)
        || (function(){
          const returnSegment = segments.find(function(segment){
            return segment.isAbRoute;
          });
          const returnPath = returnSegment?.path || getLegPath(returnLeg);
          if(!Array.isArray(returnPath) || returnPath.length < 2){
            return null;
          }
          const waypoint = normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint);
          if(waypoint){
            return waypoint;
          }
          return returnPath.length >= 3 ? returnPath[Math.floor(returnPath.length / 2)] : null;
        }());
      if(stopPosition){
        markers.push({
          position: stopPosition,
          title: "立ち寄り地点",
          label: "寄",
          color: "0xF9A825"
        });
      }
    }

    return markers;
  }

  function shouldShowLegend(segments){
    return Array.isArray(segments) && segments.length > 0;
  }

  function segmentKeysPresent(segments){
    const keys = new Set((segments || []).map(function(segment){
      return segment.key;
    }));
    return keys;
  }

  function buildAbLegendLineItems(segments){
    const keys = segmentKeysPresent(segments);
    const legendOrder = ROUTE_OPTION_KEYS;
    const legendByKey = {};
    (segments || []).forEach(function(segment){
      if(!segment?.key || legendByKey[segment.key]){
        return;
      }
      legendByKey[segment.key] = segment;
    });
    const lineItems = [];
    legendOrder.forEach(function(key){
      if(!keys.has(key)){
        return;
      }
      const segment = legendByKey[key];
      const meta = Object.keys(CANDIDATE_ROUTE_META).map(function(strategy){
        return CANDIDATE_ROUTE_META[strategy];
      }).find(function(item){
        return item.key === key;
      });
      const swatchClass = "estimate-route-map-legend-swatch estimate-route-map-legend-swatch--" +
        (key === "routeA" ? "route-a"
          : key === "routeB" ? "route-b estimate-route-map-legend-swatch--dashed"
          : key === "routeC" ? "route-c"
          : "route-d");
      const label = meta?.legendLabel || segment?.legendLabel || segment?.label || key;
      lineItems.push(
        '<div class="estimate-route-map-legend-item">' +
          '<span class="' + swatchClass + '" aria-hidden="true"></span>' +
          "<span>" + label + "</span>" +
        "</div>"
      );
    });
    return lineItems;
  }

  function buildLegendHtml(segments){
    const lineItems = buildAbLegendLineItems(segments);
    if(!lineItems.length){
      return "";
    }
    return (
      '<div class="estimate-route-map-legend estimate-route-map-legend--ab" aria-label="ルート凡例">' +
        lineItems.join("") +
      "</div>"
    );
  }

  function buildLegendPdfHtml(segments){
    const keys = segmentKeysPresent(segments);
    const rowStyle = "display:flex;align-items:center;gap:6px;";
    const swatch = function(color){
      return '<span style="width:14px;height:4px;border-radius:2px;background:' + color + ';"></span>';
    };
    const dashedSwatch = function(color){
      return '<span style="width:14px;height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,' + color + ' 0,' + color + ' 4px,transparent 4px,transparent 7px);"></span>';
    };
    const lineRows = [];
    const legendOrder = ROUTE_OPTION_KEYS;
    const legendByKey = {};
    (segments || []).forEach(function(segment){
      if(!segment?.key || legendByKey[segment.key]){
        return;
      }
      legendByKey[segment.key] = segment;
    });
    legendOrder.forEach(function(key){
      if(!keys.has(key)){
        return;
      }
      const segment = legendByKey[key];
      const meta = Object.keys(CANDIDATE_ROUTE_META).map(function(strategy){
        return CANDIDATE_ROUTE_META[strategy];
      }).find(function(item){
        return item.key === key;
      });
      const label = meta?.legendLabel || segment?.legendLabel || segment?.label || key;
      const swatchHtml = key === "routeB"
        ? dashedSwatch(ROUTE_COLORS.routeB)
        : swatch(ROUTE_COLORS[key] || segment.color || "#666");
      lineRows.push('<div style="' + rowStyle + '">' + swatchHtml + label + "</div>");
    });
    if(!lineRows.length){
      return "";
    }
    return (
      "<div style=\"position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:5px;" +
      "padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.08);" +
      "font-size:9px;line-height:1.3;color:#333;\">" +
        lineRows.join("") +
      "</div>"
    );
  }

  function getAllPathPoints(segments){
    const points = [];
    (segments || []).forEach(function(segment){
      (segment.path || []).forEach(function(point){
        points.push(point);
      });
    });
    return points;
  }

  function simplifyPathForStaticMap(path, maxPoints){
    if(!Array.isArray(path) || path.length <= maxPoints){
      return path;
    }
    const step = Math.ceil(path.length / maxPoints);
    const simplified = [];
    for(let i = 0; i < path.length; i += step){
      simplified.push(path[i]);
    }
    const last = path[path.length - 1];
    if(simplified[simplified.length - 1] !== last){
      simplified.push(last);
    }
    return simplified;
  }

  function formatCoord(value){
    return Number(value).toFixed(6);
  }

  function pathToStaticMapParam(segment){
    const color = ROUTE_COLOR_HEX[segment.key] || ROUTE_COLOR_HEX.routeA;
    const simplified = simplifyPathForStaticMap(segment.path, 80);
    const coords = simplified.map(function(point){
      return formatCoord(point.lat) + "," + formatCoord(point.lng);
    }).join("|");
    return "color:" + color + "|weight:5|" + coords;
  }

  function getWaypointAddress(routePlan, fallbackAddress){
    const returnLeg = routePlan?.returnRoutePlan;
    if(!returnLeg){
      return String(fallbackAddress || "").trim();
    }
    return String(
      returnLeg.waypoint?.waypointAddress
      || returnLeg.waypoint?.waypointLabel
      || returnLeg.intermediateWaypoint?.waypointAddress
      || returnLeg.intermediateWaypoint?.waypointLabel
      || fallbackAddress
      || ""
    ).trim();
  }

  async function resolveWaypointLatLng(routePlan, geocodeFn, fallbackAddress){
    if(String(routePlan?.returnPlanType || "") !== "return_with_stop"){
      return null;
    }
    const returnLeg = routePlan?.returnRoutePlan;
    if(!returnLeg){
      return null;
    }
    const existing = normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint);
    if(existing){
      return existing;
    }
    const primaryRoute = getLegPrimaryRoute(returnLeg);
    const legPaths = buildStopReturnPathsFromRouteLegs(primaryRoute);
    if(legPaths?.waypointLatLng){
      return legPaths.waypointLatLng;
    }
    const fromRoute = normalizeLatLng(primaryRoute?.intermediateWaypoint);
    if(fromRoute){
      return fromRoute;
    }
    const address = getWaypointAddress(routePlan, fallbackAddress);
    if(!address || typeof geocodeFn !== "function"){
      return null;
    }
    try{
      const result = await geocodeFn(address);
      return normalizeLatLng(result);
    }catch(error){
      return null;
    }
  }

  function hasRenderableRouteMap(routePlan){
    if(hasAbRouteMapSegments(routePlan) || hasReturnAbRouteMapSegments(routePlan)){
      return true;
    }
    return buildDisplayRouteMapSegments(routePlan).some(function(segment){
      return Array.isArray(segment.path) && segment.path.length >= 2;
    });
  }

  global.EstimateRouteMapDisplay = {
    ROUTE_COLORS: ROUTE_COLORS,
    ROUTE_COLOR_HEX: ROUTE_COLOR_HEX,
    AB_ROUTE_META: AB_ROUTE_META,
    CANDIDATE_ROUTE_META: CANDIDATE_ROUTE_META,
    CANDIDATE_STRATEGY_ORDER: CANDIDATE_STRATEGY_ORDER,
    MIN_DISPLAY_ROUTE_CANDIDATES: MIN_DISPLAY_ROUTE_CANDIDATES,
    MAX_DISPLAY_ROUTE_CANDIDATES: MAX_DISPLAY_ROUTE_CANDIDATES,
    decodePolyline: decodePolyline,
    getLegRouteCandidates: getLegRouteCandidates,
    getDisplayRouteCandidates: getDisplayRouteCandidates,
    filterSegmentsByActiveStrategy: filterSegmentsByActiveStrategy,
    getStrategyMapKey: getStrategyMapKey,
    findCandidateByStrategy: findCandidateByStrategy,
    getLegPrimaryRoute: getLegPrimaryRoute,
    getLegPath: getLegPath,
    getRouteStrategyKey: getRouteStrategyKey,
    normalizeLatLng: normalizeLatLng,
    buildRouteMapSegments: buildRouteMapSegments,
    buildAbRouteMapSegments: buildAbRouteMapSegments,
    buildDisplayRouteMapSegments: buildDisplayRouteMapSegments,
    hasAbRouteMapSegments: hasAbRouteMapSegments,
    hasReturnAbRouteMapSegments: hasReturnAbRouteMapSegments,
    buildRouteMapMarkers: buildRouteMapMarkers,
    shouldShowLegend: shouldShowLegend,
    buildLegendHtml: buildLegendHtml,
    buildLegendPdfHtml: buildLegendPdfHtml,
    getAllPathPoints: getAllPathPoints,
    pathToStaticMapParam: pathToStaticMapParam,
    getWaypointAddress: getWaypointAddress,
    resolveWaypointLatLng: resolveWaypointLatLng,
    hasRenderableRouteMap: hasRenderableRouteMap
  };
})(typeof window !== "undefined" ? window : globalThis);
