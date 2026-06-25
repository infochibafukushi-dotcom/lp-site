(function(global){
  const ROUTE_COLORS = {
    outbound: "#1565C0",
    stop: "#2E7D32",
    return: "#C62828"
  };

  const ROUTE_COLOR_HEX = {
    outbound: "0x1565C0FF",
    stop: "0x2E7D32FF",
    return: "0xC62828FF"
  };

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

  function getLegPath(leg){
    const route = getLegPrimaryRoute(leg);
    return decodePolyline(route?.encodedPolyline || leg?.encodedPolyline || "");
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

  function findClosestPathIndex(path, lat, lng){
    let bestIndex = 0;
    let bestDistance = Infinity;
    for(let i = 0; i < path.length; i++){
      const distance = haversineMeters(path[i], { lat: lat, lng: lng });
      if(distance < bestDistance){
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
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
      return { before: path, after: null };
    }
    const index = findClosestPathIndex(path, latLng.lat, latLng.lng);
    if(index <= 0 || index >= path.length - 1){
      return { before: path, after: null };
    }
    return {
      before: path.slice(0, index + 1),
      after: path.slice(index)
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
            const waypoint = waypointLatLng || normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint);
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
      const waypoint = waypointLatLng || normalizeLatLng(returnLeg.waypoint || returnLeg.intermediateWaypoint);
      const stopSegment = segments.find(function(segment){
        return segment.key === "stop";
      });
      const stopPosition = waypoint || (stopSegment?.path?.length ? stopSegment.path[stopSegment.path.length - 1] : null);
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
    return Array.isArray(segments) && segments.some(function(segment){
      return segment.key === "return" || segment.key === "stop";
    });
  }

  function buildLegendHtml(){
    return (
      '<div class="estimate-route-map-legend" aria-label="ルート凡例">' +
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--outbound" aria-hidden="true"></span>' +
          "<span>往路</span>" +
        "</div>" +
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--stop" aria-hidden="true"></span>' +
          "<span>立ち寄り</span>" +
        "</div>" +
        '<div class="estimate-route-map-legend-item">' +
          '<span class="estimate-route-map-legend-swatch estimate-route-map-legend-swatch--return" aria-hidden="true"></span>' +
          "<span>復路</span>" +
        "</div>" +
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

  function getWaypointAddress(routePlan){
    const returnLeg = routePlan?.returnRoutePlan;
    if(!returnLeg){
      return "";
    }
    return String(
      returnLeg.waypoint?.waypointAddress
      || returnLeg.waypoint?.waypointLabel
      || returnLeg.intermediateWaypoint?.waypointAddress
      || returnLeg.intermediateWaypoint?.waypointLabel
      || ""
    ).trim();
  }

  async function resolveWaypointLatLng(routePlan, geocodeFn){
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
    const address = getWaypointAddress(routePlan);
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
    return buildRouteMapSegments(routePlan).some(function(segment){
      return Array.isArray(segment.path) && segment.path.length >= 2;
    });
  }

  global.EstimateRouteMapDisplay = {
    ROUTE_COLORS: ROUTE_COLORS,
    ROUTE_COLOR_HEX: ROUTE_COLOR_HEX,
    decodePolyline: decodePolyline,
    getLegPrimaryRoute: getLegPrimaryRoute,
    getLegPath: getLegPath,
    normalizeLatLng: normalizeLatLng,
    buildRouteMapSegments: buildRouteMapSegments,
    buildRouteMapMarkers: buildRouteMapMarkers,
    shouldShowLegend: shouldShowLegend,
    buildLegendHtml: buildLegendHtml,
    getAllPathPoints: getAllPathPoints,
    pathToStaticMapParam: pathToStaticMapParam,
    getWaypointAddress: getWaypointAddress,
    resolveWaypointLatLng: resolveWaypointLatLng,
    hasRenderableRouteMap: hasRenderableRouteMap
  };
})(typeof window !== "undefined" ? window : globalThis);
