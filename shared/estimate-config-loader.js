(function(global){
  const PATHS = [
    "./data/estimate-config.json",
    "data/estimate-config.json",
    "../data/estimate-config.json"
  ];

  async function fetchJsonWithFallback(urls){
    let lastError = null;

    for(const rawUrl of urls){
      try{
        const url = rawUrl + (rawUrl.includes("?") ? "&" : "?") + "_ts=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        if(!res.ok){
          throw new Error("HTTP " + res.status + " " + rawUrl);
        }
        const text = await res.text();
        if(!text || !text.trim()){
          throw new Error("empty response: " + rawUrl);
        }
        return JSON.parse(text);
      }catch(error){
        lastError = error;
      }
    }

    throw lastError || new Error("estimate-config.json の読み込みに失敗しました。");
  }

  function normalizeConfig(data){
    if(!data || typeof data !== "object"){
      throw new Error("estimate-config.json の形式が不正です。");
    }
    if(data.enabled === false){
      throw new Error("料金シミュレーターは現在停止中です。");
    }
    const defaults = global.EstimateDefaults?.createDefaultEstimateConfig?.() || {};
    if(defaults.pdfFooter){
      data.pdfFooter = Object.assign({}, defaults.pdfFooter, data.pdfFooter || {});
      if(!data.pdfFooter.homepageUrl && data.pdfFooter.qrCodeUrl){
        data.pdfFooter.homepageUrl = String(data.pdfFooter.qrCodeUrl || "");
      }
      if(!data.pdfFooter.homepageQrLabel && data.pdfFooter.qrCodeLabel){
        data.pdfFooter.homepageQrLabel = String(data.pdfFooter.qrCodeLabel || "");
      }
      delete data.pdfFooter.qrCodeUrl;
      delete data.pdfFooter.qrCodeLabel;
    }
    if(data.page && defaults.page?.resultNotes && typeof data.page.resultNotes !== "string"){
      data.page.resultNotes = defaults.page.resultNotes;
    }
    if(data.page && defaults.page?.preFixedFareNotice && typeof data.page.preFixedFareNotice !== "string"){
      data.page.preFixedFareNotice = defaults.page.preFixedFareNotice;
    }
    if(data.page && defaults.page?.tollRoadNote && typeof data.page.tollRoadNote !== "string"){
      data.page.tollRoadNote = defaults.page.tollRoadNote;
    }
    if(defaults.resultLabels){
      data.resultLabels = Object.assign({}, defaults.resultLabels, data.resultLabels || {});
    }
    if(defaults.basicFees){
      data.basicFees = Object.assign({}, defaults.basicFees, data.basicFees || {});
      Object.keys(defaults.basicFees).forEach(function(key){
        data.basicFees[key] = Object.assign({}, defaults.basicFees[key], data.basicFees[key] || {});
      });
    }
    if(Array.isArray(defaults.fareModeOptions)){
      const options = Array.isArray(data.fareModeOptions) ? data.fareModeOptions : [];
      const map = {};
      options.forEach(function(item){
        if(item?.id) map[item.id] = item;
      });
      data.fareModeOptions = defaults.fareModeOptions.map(function(item){
        return Object.assign({}, item, map[item.id] || {});
      });
    }
    if(defaults.fareComponents){
      data.fareComponents = Object.assign({}, defaults.fareComponents, data.fareComponents || {});
    }
    if(defaults.preFixedFare){
      data.preFixedFare = Object.assign({}, defaults.preFixedFare, data.preFixedFare || {});
    }
    if(defaults.trafficZones){
      const defaultItems = Array.isArray(defaults.trafficZones.items) ? defaults.trafficZones.items : [];
      const currentItems = Array.isArray(data.trafficZones?.items) ? data.trafficZones.items : [];
      const map = {};
      currentItems.forEach(function(item){
        if(item?.id) map[item.id] = item;
      });
      data.trafficZones = {
        items: defaultItems.map(function(item){
          const current = map[item.id] || {};
          const merged = Object.assign({}, item, current);
          if(!Array.isArray(merged.municipalities) || !merged.municipalities.length){
            merged.municipalities = Array.isArray(item.municipalities) ? item.municipalities.slice() : [];
          }
          return merged;
        })
      };
    }
    const modes = ["time", "distance", "distance_time", "pre_fixed_fare"];
    const modeExists = modes.includes(String(data.fareMode || ""));
    data.fareMode = modeExists ? String(data.fareMode) : String(defaults.fareMode || "time");
    return data;
  }

  async function loadEstimateConfig(){
    const raw = await fetchJsonWithFallback(PATHS);
    return normalizeConfig(raw);
  }

  global.EstimateConfigLoader = {
    loadEstimateConfig: loadEstimateConfig
  };
})(typeof window !== "undefined" ? window : globalThis);
