(function(global){
  const WAYPOINTS = [
    {
      waypointId: "kenoh-wangan-chiba",
      waypointLabel: "県央・湾岸幹線（千葉市中央付近）",
      waypointLatLng: { latitude: 35.6074, longitude: 140.1063 },
      waypointReason: "国道14号・京葉道路方面の主要幹線付近"
    },
    {
      waypointId: "keiyo-road-funabashi",
      waypointLabel: "京葉道路（船橋・習志野付近）",
      waypointLatLng: { latitude: 35.6947, longitude: 140.0236 },
      waypointReason: "京葉道路・国道14号バイパス付近"
    },
    {
      waypointId: "r16-funabashi",
      waypointLabel: "国道16号（船橋付近）",
      waypointLatLng: { latitude: 35.6942, longitude: 139.9826 },
      waypointReason: "国道16号環状線の主要区間"
    },
    {
      waypointId: "higashi-kanto-chiba-kita",
      waypointLabel: "東関東自動車道（千葉北IC付近）",
      waypointLatLng: { latitude: 35.6528, longitude: 140.1436 },
      waypointReason: "東関東自動車道・千葉北IC付近"
    },
    {
      waypointId: "chiba-kanjo-yotsukaido",
      waypointLabel: "千葉外環状道路（四街道付近）",
      waypointLatLng: { latitude: 35.6698, longitude: 140.1683 },
      waypointReason: "千葉外環状道路の主要区間"
    },
    {
      waypointId: "kenoh-matsudo",
      waypointLabel: "国道6号（松戸付近）",
      waypointLatLng: { latitude: 35.7874, longitude: 139.9018 },
      waypointReason: "国道6号・常磐自動車道方面の幹線"
    },
    {
      waypointId: "tateyama-kisarazu",
      waypointLabel: "館山自動車道（木更津付近）",
      waypointLatLng: { latitude: 35.3813, longitude: 139.9248 },
      waypointReason: "館山自動車道・木更津IC付近"
    },
    {
      waypointId: "kennan-tateyama",
      waypointLabel: "国道127号（館山付近）",
      waypointLatLng: { latitude: 34.9966, longitude: 139.8700 },
      waypointReason: "南房総方面の国道127号幹線"
    },
    {
      waypointId: "kennan-kamogawa",
      waypointLabel: "国道128号（鴨川付近）",
      waypointLatLng: { latitude: 35.1138, longitude: 140.0986 },
      waypointReason: "南房総方面の国道128号幹線"
    },
    {
      waypointId: "r297-kimitsu",
      waypointLabel: "国道297号（君津付近）",
      waypointLatLng: { latitude: 35.3302, longitude: 139.9025 },
      waypointReason: "国道297号・内房幹線道路付近"
    }
  ];

  const EARTH_RADIUS_M = 6371000;

  function toRad(deg){
    return deg * Math.PI / 180;
  }

  function normalizeLatLng(point){
    if(!point){
      return null;
    }
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.longitude);
    if(!Number.isFinite(lat) || !Number.isFinite(lng)){
      return null;
    }
    return { lat: lat, lng: lng };
  }

  function haversineMeters(left, right){
    const a = normalizeLatLng(left);
    const b = normalizeLatLng(right);
    if(!a || !b){
      return Infinity;
    }
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(origin, point){
    const a = normalizeLatLng(origin);
    const b = normalizeLatLng(point);
    if(!a || !b){
      return 0;
    }
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function angleDiff(left, right){
    const diff = Math.abs(left - right) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  function crossTrackMeters(origin, destination, point){
    const originPoint = normalizeLatLng(origin);
    const destPoint = normalizeLatLng(destination);
    const waypoint = normalizeLatLng(point);
    if(!originPoint || !destPoint || !waypoint){
      return Infinity;
    }
    const routeDistance = haversineMeters(originPoint, destPoint);
    if(routeDistance < 1000){
      return Infinity;
    }
    const originDistance = haversineMeters(originPoint, waypoint);
    const bearingRoute = bearingDegrees(originPoint, destPoint);
    const bearingPoint = bearingDegrees(originPoint, waypoint);
    const cross = Math.asin(
      Math.sin(originDistance / EARTH_RADIUS_M)
      * Math.sin(toRad(bearingPoint - bearingRoute))
    ) * EARTH_RADIUS_M;
    return Math.abs(cross);
  }

  function isWaypointOnCorridor(origin, destination, waypoint, options){
    const originPoint = normalizeLatLng(origin);
    const destPoint = normalizeLatLng(destination);
    const waypointPoint = normalizeLatLng(waypoint?.waypointLatLng || waypoint);
    if(!originPoint || !destPoint || !waypointPoint){
      return false;
    }

    const routeDistance = haversineMeters(originPoint, destPoint);
    if(routeDistance < 3000){
      return false;
    }

    const originDistance = haversineMeters(originPoint, waypointPoint);
    const destDistance = haversineMeters(waypointPoint, destPoint);
    const maxDetourRatio = Number(options?.maxDetourRatio) || 1.32;
    const minLegRatio = Number(options?.minLegRatio) || 0.08;
    const maxCrossTrackRatio = Number(options?.maxCrossTrackRatio) || 0.22;

    if(originDistance + destDistance > routeDistance * maxDetourRatio){
      return false;
    }
    if(originDistance < routeDistance * minLegRatio || destDistance < routeDistance * minLegRatio){
      return false;
    }

    const crossTrack = crossTrackMeters(originPoint, destPoint, waypointPoint);
    if(crossTrack > routeDistance * maxCrossTrackRatio){
      return false;
    }

    const routeBearing = bearingDegrees(originPoint, destPoint);
    const originBearing = bearingDegrees(originPoint, waypointPoint);
    const destBearing = bearingDegrees(waypointPoint, destPoint);
    if(angleDiff(routeBearing, originBearing) > 55){
      return false;
    }
    if(angleDiff(routeBearing, destBearing) > 55){
      return false;
    }

    return true;
  }

  function selectArterialWaypoint(origin, destination, options){
    const originPoint = normalizeLatLng(origin);
    const destPoint = normalizeLatLng(destination);
    if(!originPoint || !destPoint){
      return null;
    }

    const matches = WAYPOINTS
      .filter(function(waypoint){
        return isWaypointOnCorridor(originPoint, destPoint, waypoint, options);
      })
      .map(function(waypoint){
        return {
          waypoint: waypoint,
          crossTrack: crossTrackMeters(originPoint, destPoint, waypoint.waypointLatLng)
        };
      })
      .sort(function(left, right){
        return left.crossTrack - right.crossTrack;
      });

    if(!matches.length){
      return null;
    }

    const selected = matches[0].waypoint;
    return {
      waypointId: selected.waypointId,
      waypointLabel: selected.waypointLabel,
      waypointLatLng: {
        latitude: selected.waypointLatLng.latitude,
        longitude: selected.waypointLatLng.longitude
      },
      waypointReason: selected.waypointReason
    };
  }

  global.PreFixedFareRouteWaypoints = {
    getWaypoints: function(){
      return WAYPOINTS.map(function(waypoint){
        return Object.assign({}, waypoint, {
          waypointLatLng: Object.assign({}, waypoint.waypointLatLng)
        });
      });
    },
    selectArterialWaypoint: selectArterialWaypoint,
    isWaypointOnCorridor: isWaypointOnCorridor
  };
})(typeof window !== "undefined" ? window : globalThis);
