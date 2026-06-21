(function(global){
  function saveHandoffRecord(record){
    try{
      sessionStorage.setItem("lp_estimate_handoff", JSON.stringify(record));
    }catch(error){}
  }

  function getHandoffRecord(){
    try{
      const raw = sessionStorage.getItem("lp_estimate_handoff");
      return raw ? JSON.parse(raw) : null;
    }catch(error){
      return null;
    }
  }

  function appendEstimateNoToUrl(url, estimateNumber){
    const base = String(url || "").trim();
    if(!base || base === "#" || !estimateNumber) return base;
    try{
      const u = new URL(base, window.location.origin);
      u.searchParams.set("estimateNo", estimateNumber);
      return u.toString();
    }catch(error){
      const sep = base.includes("?") ? "&" : "?";
      return base + sep + "estimateNo=" + encodeURIComponent(estimateNumber);
    }
  }

  global.EstimateHandoff = {
    saveHandoffRecord: saveHandoffRecord,
    getHandoffRecord: getHandoffRecord,
    appendEstimateNoToUrl: appendEstimateNoToUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
