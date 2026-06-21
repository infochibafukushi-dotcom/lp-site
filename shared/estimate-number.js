(function(global){
  function pad4(n){
    return String(n).padStart(4, "0");
  }

  function formatDateKey(date){
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return "" + y + m + day;
  }

  function formatEstimateNumber(dateKey, seq){
    return "EST-" + dateKey + "-" + pad4(seq);
  }

  function issueLocalEstimateNumber(){
    const dateKey = formatDateKey(new Date());
    const suffix = pad4(Math.floor(Math.random() * 10000));
    return formatEstimateNumber(dateKey, suffix);
  }

  function buildHistoryRecord(payload){
    return {
      estimateNumber: payload.estimateNumber,
      createdAt: payload.createdAt || new Date().toISOString(),
      usageSummary: payload.usageSummary || [],
      breakdown: payload.breakdown || {},
      total: Number(payload.total) || 0,
      distanceKm: Number(payload.distanceKm) || 0,
      selections: payload.selections || {},
      disclaimer: String(payload.disclaimer || ""),
      pageTitle: String(payload.pageTitle || "")
    };
  }

  global.EstimateNumber = {
    formatDateKey: formatDateKey,
    formatEstimateNumber: formatEstimateNumber,
    issueLocalEstimateNumber: issueLocalEstimateNumber,
    buildHistoryRecord: buildHistoryRecord
  };
})(typeof window !== "undefined" ? window : globalThis);
