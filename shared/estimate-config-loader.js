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
    }
    if(data.page && defaults.page?.resultNotes && typeof data.page.resultNotes !== "string"){
      data.page.resultNotes = defaults.page.resultNotes;
    }
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
