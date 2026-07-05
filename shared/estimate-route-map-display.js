(function(global){
  const ROUTE_COLORS = {
    outbound: "#1565C0",
    stop: "#2E7D32",
    return: "#C62828",
    routeA: "#C62828",
    routeB: "#1565C0",
    routeC: "#F9A825",
    routeD: "#212121"
  };

  const ROUTE_COLOR_HEX = {
    outbound: "0x1565C0FF",
    stop: "0x2E7D32FF",
    return: "0xC62828FF",
    routeA: "0xC62828FF",
    routeB: "0x1565C0FF",
    routeC: "0xF9A825FF",
    routeD: "0x212121FF"
  };

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
      oneWayLabel: "D 高速道路ルート",
      roundTripLabel: "D 高速道路の往復ルート",
      legendLabel: "D 黒線：高速道路ルート",
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

  function pathFromRoute(route){
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
      appendCandidateSegmentsForLeg(segments, outboundLeg, {
        isRoundTrip: hasReturnLeg,
        legRole: "outbound"
      });
    }
    if(returnLeg){
      appendCandidateSegmentsForLeg(segments, returnLeg, {
        isRoundTrip: true,
        legRole: "return"
      });
    }
    if(!outboundLeg && !returnLeg){
      appendCandidateSegmentsForLeg(segments, routePlan, {
        isRoundTrip: false,
        legRole: "outbound"
      });
    }
    return segments;
  }

  function hasAbRouteMapSegments(routePlan){
    const outboundLeg = routePlan?.outboundRoutePlan || routePlan;
    if(!outboundLeg){
      return false;
    }
    return Boolean(findCandidateByStrategy(outboundLeg, "time_priority"))
      && Boolean(findCandidateByStrategy(outboundLeg, "general_road_priority"));
  }

  function hasReturnAbRouteMapSegments(routePlan){
    const returnLeg = routePlan?.returnRoutePlan;
    if(!returnLeg){
      return false;
    }
    return Boolean(findCandidateByStrategy(returnLeg, "time_priority"))
      && Boolean(findCandidateByStrategy(returnLeg, "general_road_priority"));
  }

  function filterSegmentsByKeys(segments, keys){
    const allowed = new Set(keys || []);
    return (segments || []).filter(function(segment){
      return allowed.has(segment.key);
    });
  }

  function filterAbSegmentsByLegRole(segments, legRole){
    return (segments || []).filter(function(segment){
      return segment.legRole === legRole;
    });
  }

  function buildDisplayRouteMapSegments(routePlan, waypointLatLng){
    const returnPlanType = String(routePlan?.returnPlanType || "");
    const standardSegments = buildRouteMapSegments(routePlan, waypointLatLng);
    const abSegments = buildAbRouteMapSegments(routePlan);
    const useAbOnOutbound = hasAbRouteMapSegments(routePlan);
    const useAbOnReturn = hasReturnAbRouteMapSegments(routePlan);

    if(returnPlanType === "return_with_stop" && routePlan?.returnRoutePlan){
      const returnSegments = filterSegmentsByKeys(standardSegments, ["stop", "return"]);
      if(returnSegments.length){
        const outboundSegments = useAbOnOutbound
          ? filterAbSegmentsByLegRole(abSegments, "outbound")
          : filterSegmentsByKeys(standardSegments, ["outbound"]);
        if(outboundSegments.length){
          return outboundSegments.concat(returnSegments);
        }
      }
    }

    if(useAbOnOutbound || useAbOnReturn){
      if(abSegments.length){
        return abSegments;
      }
    }
    return standardSegments;
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
    const segments = [];
    if(!routePlan){
      return segments;
    }

    const outboundLeg = routePlan.outboundRoutePlan;
    const returnLeg = routePlan.returnRoutePlan;
    const returnPlanType = String(routePlan.returnPlanType || "");

    if(outboundLeg){
      const outboundPath = getLegPath(outboundLeg);
      if(outboundPath.length >= 2){
        segments.push({
          key: "outbound",
          color: ROUTE_COLORS.outbound,
          path: outboundPath,
          label: "往路"
        });
      }

      if(returnLeg){
        const returnPath = getLegPath(returnLeg);
        if(returnPath.length >= 2){
          if(returnPlanType === "return_with_stop"){
            const primaryRoute = getLegPrimaryRoute(returnLeg);
            const legPaths = buildStopReturnPathsFromRouteLegs(primaryRoute, returnPath);
            if(legPaths){
              segments.push({
                key: "stop",
                color: ROUTE_COLORS.stop,
                path: legPaths.stopPath,
                label: "立ち寄り"
              });
              segments.push({
                key: "return",
                color: ROUTE_COLORS.return,
                path: legPaths.returnPath,
                label: "復路"
              });
            }else{
              const waypoint = waypointLatLng
                || normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint)
                || normalizeLatLng(primaryRoute?.intermediateWaypoint);
              if(waypoint){
                const split = splitPathAtClosest(returnPath, waypoint);
                if(split.after && split.before.length >= 2 && split.after.length >= 2){
                  segments.push({
                    key: "stop",
                    color: ROUTE_COLORS.stop,
                    path: split.before,
                    label: "立ち寄り"
                  });
                  segments.push({
                    key: "return",
                    color: ROUTE_COLORS.return,
                    path: split.after,
                    label: "復路"
                  });
                }else{
                  segments.push({
                    key: "return",
                    color: ROUTE_COLORS.return,
                    path: returnPath,
                    label: "復路"
                  });
                }
              }else{
                segments.push({
                  key: "return",
                  color: ROUTE_COLORS.return,
                  path: returnPath,
                  label: "復路"
                });
              }
            }
          }else{
            segments.push({
              key: "return",
              color: ROUTE_COLORS.return,
              path: returnPath,
              label: "復路"
            });
          }
        }
      }
      return segments;
    }

    const path = getLegPath(routePlan);
    if(path.length >= 2){
      segments.push({
        key: "outbound",
        color: ROUTE_COLORS.outbound,
        path: path,
        label: "往路"
      });
    }
    return segments;
  }

  function buildRouteMapMarkers(routePlan, segments, waypointLatLng){
    const markers = [];
    if(!routePlan || !segments.length){
      return markers;
    }

    const outboundLeg = routePlan.outboundRoutePlan;
    const returnLeg = routePlan.returnRoutePlan;
    const returnPlanType = String(routePlan.returnPlanType || "");
    const outboundSegment = segments.find(function(segment){
      return segment.key === "outbound";
    });
    const outboundPath = outboundSegment?.path || (outboundLeg ? getLegPath(outboundLeg) : segments[0].path);

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
      const stopSegment = segments.find(function(segment){
        return segment.key === "stop";
      });
      const stopPosition = stopSegment?.path?.length
        ? stopSegment.path[stopSegment.path.length - 1]
        : (waypointLatLng || normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint));
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

  function buildLegendHtml(segments){
    const keys = segmentKeysPresent(segments);
    const lineItems = [];
    const isAbLegend = keys.has("routeA") || keys.has("routeB");
    if(isAbLegend){
      const legendOrder = ["routeA", "routeB", "routeC", "routeD"];
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
        const swatchClass = "estimate-route-map-legend-swatch estimate-route-map-legend-swatch--" +
          (key === "routeA" ? "route-a"
            : key === "routeB" ? "route-b estimate-route-map-legend-swatch--dashed"
            : key === "routeC" ? "route-c"
            : "route-d");
        const label = segment?.legendLabel || meta?.legendLabel || segment?.label || key;
        lineItems.push(
          '<div class="estimate-route-map-legend-item">' +
            '<span class="' + swatchClass + '" aria-hidden="true"></span>' +
            "<span>" + label + "</span>" +
          "</div>"
        );
      });
    }
    if(keys.has("outbound")){
      lineItems.push(
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--outbound" aria-hidden="true"></span>' +
          "<span>往路</span>" +
        "</div>"
      );
    }
    if(keys.has("stop")){
      lineItems.push(
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--stop" aria-hidden="true"></span>' +
          "<span>立ち寄り</span>" +
        "</div>"
      );
    }
    if(keys.has("return")){
      lineItems.push(
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--return" aria-hidden="true"></span>' +
          "<span>復路</span>" +
        "</div>"
      );
    }
    if(isAbLegend){
      if(keys.has("stop") || keys.has("return") || keys.has("outbound")){
        if(keys.has("outbound")){
          lineItems.push(
            '<div class="estimate-route-map-legend-item">' +
              '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--outbound" aria-hidden="true"></span>' +
              "<span>往路</span>" +
            "</div>"
          );
        }
        if(keys.has("stop")){
          lineItems.push(
            '<div class="estimate-route-map-legend-item">' +
              '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--stop" aria-hidden="true"></span>' +
              "<span>立ち寄り</span>" +
            "</div>"
          );
        }
        if(keys.has("return")){
          lineItems.push(
            '<div class="estimate-route-map-legend-item">' +
              '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--return" aria-hidden="true"></span>' +
              "<span>復路</span>" +
            "</div>"
          );
        }
      }
      const markerItems = [
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--origin" aria-hidden="true">発</span>' +
          "<span>出発地</span>" +
        "</div>",
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--destination" aria-hidden="true">着</span>' +
          "<span>目的地</span>" +
        "</div>"
      ];
      if(keys.has("stop")){
        markerItems.push(
          '<div class="estimate-route-map-legend-item">' +
            '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--waypoint" aria-hidden="true">寄</span>' +
            "<span>立ち寄り地点</span>" +
          "</div>"
        );
      }
      const showMarkerSection = keys.has("stop") || keys.has("return") || keys.has("outbound");
      return (
        '<div class="estimate-route-map-legend estimate-route-map-legend--ab" aria-label="ルート凡例">' +
          '<div class="estimate-route-map-legend-section">' +
            lineItems.join("") +
          "</div>" +
          (showMarkerSection
            ? (
              '<div class="estimate-route-map-legend-divider" aria-hidden="true"></div>' +
              '<div class="estimate-route-map-legend-section">' +
                '<div class="estimate-route-map-legend-heading">マーカー</div>' +
                markerItems.join("") +
              "</div>"
            )
            : "") +
        "</div>"
      );
    }

    const markerItems = [
      '<div class="estimate-route-map-legend-item">' +
        '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--origin" aria-hidden="true">発</span>' +
        "<span>出発地</span>" +
      "</div>",
      '<div class="estimate-route-map-legend-item">' +
        '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--destination" aria-hidden="true">着</span>' +
        "<span>目的地</span>" +
      "</div>"
    ];
    if(keys.has("stop")){
      markerItems.push(
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-marker estimate-route-map-legend-marker--waypoint" aria-hidden="true">寄</span>' +
          "<span>立ち寄り地点</span>" +
        "</div>"
      );
    }
    return (
      '<div class="estimate-route-map-legend" aria-label="ルート凡例">' +
        '<div class="estimate-route-map-legend-section">' +
          '<div class="estimate-route-map-legend-heading">線</div>' +
          lineItems.join("") +
        "</div>" +
        '<div class="estimate-route-map-legend-divider" aria-hidden="true"></div>' +
        '<div class="estimate-route-map-legend-section">' +
          '<div class="estimate-route-map-legend-heading">マーカー</div>' +
          markerItems.join("") +
        "</div>" +
      "</div>"
    );
  }

  function buildLegendPdfHtml(segments){
    const keys = segmentKeysPresent(segments);
    const rowStyle = "display:flex;align-items:center;gap:6px;";
    const swatch = function(color){
      return '<span style="width:14px;height:4px;border-radius:2px;background:' + color + ';"></span>';
    };
    const marker = function(label, bg, fg){
      return '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:' + bg + ";color:" + fg + ';font-size:8px;font-weight:700;line-height:1;">' + label + "</span>";
    };
    const lineRows = [];
    if(keys.has("outbound")){
      lineRows.push('<div style="' + rowStyle + '">' + swatch("#1565C0") + "往路</div>");
    }
    if(keys.has("stop")){
      lineRows.push('<div style="' + rowStyle + '">' + swatch("#2E7D32") + "立ち寄り</div>");
    }
    if(keys.has("return")){
      lineRows.push('<div style="' + rowStyle + '">' + swatch("#C62828") + "復路</div>");
    }
    const markerRows = [
      '<div style="' + rowStyle + '">' + marker("発", "#2E7D32", "#fff") + "出発地</div>",
      '<div style="' + rowStyle + '">' + marker("着", "#C62828", "#fff") + "目的地</div>"
    ];
    if(keys.has("stop")){
      markerRows.push('<div style="' + rowStyle + '">' + marker("寄", "#F9A825", "#fff") + "立ち寄り地点</div>");
    }
    return (
      "<div style=\"position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:5px;" +
      "padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.08);" +
      "font-size:9px;line-height:1.3;color:#333;\">" +
        "<div style=\"font-size:8px;font-weight:700;color:#666;\">線</div>" +
        lineRows.join("") +
        "<div style=\"height:1px;background:rgba(0,0,0,0.1);margin:2px 0;\"></div>" +
        "<div style=\"font-size:8px;font-weight:700;color:#666;\">マーカー</div>" +
        markerRows.join("") +
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
    const color = ROUTE_COLOR_HEX[segment.key] || ROUTE_COLOR_HEX.outbound;
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
    decodePolyline: decodePolyline,
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
