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

  function buildReservationHandoffUrl(url, estimateNumber, testMode){
    const base = String(url || "").trim();
    if(!base || base === "#" || !estimateNumber) return base;
    try{
      const u = new URL(base, window.location.origin);
      u.searchParams.set("source", "estimate");
      u.searchParams.set("estimateNo", estimateNumber);
      if(testMode && testMode.active && testMode.key){
        u.searchParams.set("test", "1");
        u.searchParams.set("key", testMode.key);
      }
      return u.toString();
    }catch(error){
      const sep = base.includes("?") ? "&" : "?";
      let next = base + sep + "source=estimate&estimateNo=" + encodeURIComponent(estimateNumber);
      if(testMode && testMode.active && testMode.key){
        next += "&test=1&key=" + encodeURIComponent(testMode.key);
      }
      return next;
    }
  }

  function clearHandoffRecord(){
    try{
      sessionStorage.removeItem("lp_estimate_handoff");
    }catch(error){}
  }

  global.EstimateHandoff = {
    saveHandoffRecord: saveHandoffRecord,
    getHandoffRecord: getHandoffRecord,
    appendEstimateNoToUrl: appendEstimateNoToUrl,
    buildReservationHandoffUrl: buildReservationHandoffUrl,
    clearHandoffRecord: clearHandoffRecord
  };
})(typeof window !== "undefined" ? window : globalThis);
