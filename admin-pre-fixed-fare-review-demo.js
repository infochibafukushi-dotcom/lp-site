(function(global){
  const STORAGE_KEY = global.PreFixedFareReviewDemo?.STORAGE_KEY || "preFixedFareReviewReservations";
  const EMPTY_MESSAGE = "保存された審査用デモ予約はありません。先に「QR①デモ予約を開く」からデモ予約を保存してください。";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setStatus(message, type){
    const box = document.getElementById("preFixedFareReviewDemoStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function readList(){
    if(global.PreFixedFareReviewDemo && typeof global.PreFixedFareReviewDemo.listReservations === "function"){
      return global.PreFixedFareReviewDemo.listReservations();
    }
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }catch(error){
      return [];
    }
  }

  function formatSavedAtLabel(value){
    if(global.PreFixedFareReviewDemo && typeof global.PreFixedFareReviewDemo.formatSavedAtLabel === "function"){
      return global.PreFixedFareReviewDemo.formatSavedAtLabel(value);
    }
    return String(value || "");
  }

  function renderList(records){
    const list = Array.isArray(records) ? records : [];
    if(!list.length){
      return '<p class="note">' + escapeHtml(EMPTY_MESSAGE) + "</p>";
    }
    const rows = list.map(function(record){
      return (
        "<tr>" +
        "<td>" + escapeHtml(record.reservationId || "") + "</td>" +
        "<td>" + escapeHtml(record.reservationAtLabel || "") + "</td>" +
        "<td>" + escapeHtml(record.origin || "") + "</td>" +
        "<td>" + escapeHtml(record.destination || "") + "</td>" +
        "<td>" + escapeHtml(record.totalLabel || "") + "</td>" +
        "<td>" + escapeHtml(formatSavedAtLabel(record.savedAt || "")) + "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      '<div class="table-wrap">' +
      "<table>" +
      "<thead><tr>" +
      "<th>予約ID</th><th>予約日時</th><th>乗車地</th><th>目的地</th><th>合計</th><th>保存日時</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>"
    );
  }

  function renderLatestDetail(record){
    if(!record){
      return "";
    }
    return (
      '<div class="preview" style="margin-top:12px;">' +
      "<strong>最新の審査用デモ予約</strong><br>" +
      "予約ID：" + escapeHtml(record.reservationId || "") + "<br>" +
      "利用者名：" + escapeHtml(record.customerName || "") + "<br>" +
      "乗車地：" + escapeHtml(record.origin || "") + "<br>" +
      "目的地：" + escapeHtml(record.destination || "") + "<br>" +
      "予約日時：" + escapeHtml(record.reservationAtLabel || "") + "<br>" +
      "事前確定運賃：" + escapeHtml(record.preFixedFareLabel || "") + "<br>" +
      "合計：" + escapeHtml(record.totalLabel || "") + "<br>" +
      "保存日時：" + escapeHtml(formatSavedAtLabel(record.savedAt || "")) + "<br>" +
      "同意日時：" + escapeHtml(record.consentAtLabel || record.consentAt || record.reservationAtLabel || "") +
      "</div>"
    );
  }

  function deleteSaved(){
    const list = readList();
    if(!list.length){
      setStatus("削除する審査用デモ予約はありません。", "warn");
      return;
    }
    if(global.PreFixedFareReviewDemo && typeof global.PreFixedFareReviewDemo.clearReservations === "function"){
      global.PreFixedFareReviewDemo.clearReservations();
    }else{
      localStorage.removeItem(STORAGE_KEY);
    }
    refresh();
    setStatus("保存済みの審査用デモ予約を削除しました。再度確認する場合は「QR①デモ予約を開く」から新しく保存してください。", "success");
  }

  function refresh(){
    const listBox = document.getElementById("preFixedFareReviewDemoList");
    const detailBox = document.getElementById("preFixedFareReviewDemoLatest");
    if(!listBox){
      return;
    }
    const list = readList();
    listBox.innerHTML = renderList(list);
    if(detailBox){
      detailBox.innerHTML = renderLatestDetail(list[0] || null);
    }
    if(!list.length){
      setStatus(EMPTY_MESSAGE, "warn");
      return;
    }
    setStatus("保存済みデモ予約を " + list.length + " 件読み込みました。", "success");
  }

  function bind(){
    refresh();
    const refreshBtn = document.getElementById("preFixedFareReviewDemoRefreshBtn");
    if(refreshBtn){
      refreshBtn.addEventListener("click", refresh);
    }
    const deleteBtn = document.getElementById("preFixedFareReviewDemoDeleteBtn");
    if(deleteBtn){
      deleteBtn.addEventListener("click", deleteSaved);
    }
  }

  function bindOnce(){
    if(global.__preFixedFareReviewDemoAdminBound){
      return;
    }
    global.__preFixedFareReviewDemoAdminBound = true;
    bind();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindOnce);
  }else{
    bindOnce();
  }
  window.addEventListener("load", bindOnce);

  global.PreFixedFareReviewDemoAdmin = {
    readList: readList,
    refresh: refresh,
    deleteSaved: deleteSaved
  };
})(typeof window !== "undefined" ? window : globalThis);
