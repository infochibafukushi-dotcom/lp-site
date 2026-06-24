(function(global){
  const DETECTION_METHOD = {
    GEOCODING: "auto_geocoding",
    ADDRESS: "auto_address",
    FALLBACK: "fallback_config"
  };

  function normalizeMunicipality(value){
    return String(value || "").trim().replace(/\s+/g, "");
  }

  function extractMunicipalityFromGeocoding(geocoding){
    const components = Array.isArray(geocoding?.addressComponents)
      ? geocoding.addressComponents
      : Array.isArray(geocoding?.address_components)
        ? geocoding.address_components
        : [];
    if(!components.length){
      return "";
    }

    let city = "";
    let ward = "";

    components.forEach(function(component){
      const types = Array.isArray(component?.types) ? component.types : [];
      const name = normalizeMunicipality(component?.long_name || component?.short_name || "");
      if(!name){
        return;
      }

      if(types.includes("administrative_area_level_2") && /(市|町|村)$/.test(name)){
        city = name;
        return;
      }
      if(types.includes("locality")){
        if(name.endsWith("市") || name.endsWith("町") || name.endsWith("村")){
          city = name;
        }else if(name.endsWith("区")){
          ward = name;
        }
      }
      if(types.includes("sublocality_level_1") && name.endsWith("区")){
        ward = name;
      }
    });

    if(city && ward){
      return city + ward;
    }
    return city || ward || "";
  }

  function extractMunicipalityFromAddress(address){
    const text = normalizeMunicipality(address);
    if(!text){
      return "";
    }

    const designatedCityWard = text.match(/^(.+?市)(.+?区)/);
    if(designatedCityWard){
      return designatedCityWard[1] + designatedCityWard[2];
    }

    const municipality = text.match(/^(.+?(?:市|町|村))/);
    if(municipality){
      return municipality[1];
    }

    const anywhereDesignated = text.match(/(.+?市)(.+?区)/);
    if(anywhereDesignated){
      return anywhereDesignated[1] + anywhereDesignated[2];
    }

    const anywhereMunicipality = text.match(/(.+?(?:市|町|村))/);
    if(anywhereMunicipality){
      return anywhereMunicipality[1];
    }

    return "";
  }

  function municipalityMatchesTarget(detected, target){
    const detectedName = normalizeMunicipality(detected);
    const targetName = normalizeMunicipality(target);
    if(!detectedName || !targetName){
      return false;
    }
    if(detectedName === targetName){
      return true;
    }
    if(detectedName.startsWith(targetName)){
      return true;
    }
    if(targetName.endsWith("市") && detectedName.startsWith(targetName)){
      return true;
    }
    return false;
  }

  function getZoneMunicipalities(zone){
    const raw = zone?.municipalities;
    if(Array.isArray(raw)){
      return raw.map(normalizeMunicipality).filter(Boolean);
    }
    if(typeof raw === "string"){
      return raw.split(/[\n,、，]/).map(normalizeMunicipality).filter(Boolean);
    }
    return [];
  }

  function findTrafficZoneByMunicipality(config, municipality){
    const detected = normalizeMunicipality(municipality);
    if(!detected){
      return null;
    }
    const zones = Array.isArray(config?.trafficZones?.items) ? config.trafficZones.items : [];
    const sorted = zones.slice().sort(function(a, b){
      return (Number(a?.order) || 0) - (Number(b?.order) || 0);
    });

    for(let i = 0; i < sorted.length; i += 1){
      const zone = sorted[i];
      const municipalities = getZoneMunicipalities(zone);
      for(let j = 0; j < municipalities.length; j += 1){
        if(municipalityMatchesTarget(detected, municipalities[j])){
          return zone;
        }
      }
    }
    return null;
  }

  function findItem(items, id){
    const target = String(id || "").trim();
    if(!target || !Array.isArray(items)){
      return null;
    }
    return items.find(function(item){
      return String(item?.id || "") === target;
    }) || null;
  }

  function buildFallbackDetection(config){
    const zoneId = String(config?.preFixedFare?.trafficZoneId || "").trim();
    const zone = findItem(config?.trafficZones?.items, zoneId);
    return {
      detectedMunicipality: null,
      selectedTrafficZoneId: zone?.id || zoneId || null,
      selectedTrafficZoneLabel: zone?.label || null,
      trafficZoneCoefficient: zone ? Number(zone.coefficient) || null : null,
      trafficZoneDetectionMethod: DETECTION_METHOD.FALLBACK,
      trafficZoneDetectionSource: "origin_address"
    };
  }

  function detectTrafficZone(config, options){
    const opts = options || {};
    const originAddress = String(
      opts.originAddress
      || opts.address
      || ""
    ).trim();
    const geocoding = opts.geocoding || null;

    let detectedMunicipality = "";
    let detectionMethod = "";

    const fromGeocoding = extractMunicipalityFromGeocoding(geocoding);
    if(fromGeocoding){
      detectedMunicipality = fromGeocoding;
      detectionMethod = DETECTION_METHOD.GEOCODING;
    }else{
      const fromAddress = extractMunicipalityFromAddress(originAddress);
      if(fromAddress){
        detectedMunicipality = fromAddress;
        detectionMethod = DETECTION_METHOD.ADDRESS;
      }
    }

    const matchedZone = findTrafficZoneByMunicipality(config, detectedMunicipality);
    if(matchedZone){
      const coefficient = Number(matchedZone.coefficient);
      return {
        detectedMunicipality: detectedMunicipality,
        selectedTrafficZoneId: String(matchedZone.id || ""),
        selectedTrafficZoneLabel: String(matchedZone.label || ""),
        trafficZoneCoefficient: coefficient > 0 ? coefficient : null,
        trafficZoneDetectionMethod: detectionMethod,
        trafficZoneDetectionSource: "origin_address"
      };
    }

    return buildFallbackDetection(config);
  }

  function formatTrafficZoneCoefficient(value){
    const n = Number(value);
    if(!(n > 0)){
      return "-";
    }
    return n.toFixed(2);
  }

  function getTrafficZoneDetectionMethodLabel(method){
    if(method === DETECTION_METHOD.GEOCODING || method === DETECTION_METHOD.ADDRESS){
      return "自動判定";
    }
    if(method === DETECTION_METHOD.FALLBACK){
      return "初期設定";
    }
    return "-";
  }

  global.EstimateTrafficZone = {
    DETECTION_METHOD: DETECTION_METHOD,
    extractMunicipalityFromGeocoding: extractMunicipalityFromGeocoding,
    extractMunicipalityFromAddress: extractMunicipalityFromAddress,
    municipalityMatchesTarget: municipalityMatchesTarget,
    findTrafficZoneByMunicipality: findTrafficZoneByMunicipality,
    detectTrafficZone: detectTrafficZone,
    formatTrafficZoneCoefficient: formatTrafficZoneCoefficient,
    getTrafficZoneDetectionMethodLabel: getTrafficZoneDetectionMethodLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
