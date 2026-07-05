(function(global){
  const SCENARIO = "pre-fixed-fare-demo";
  const STORAGE_KEY = "preFixedFareReviewReservations";
  const BANNER_TEXT = "審査用デモモード：本番予約・本番カレンダーには反映されません";

  const DEMO_DEFAULTS = {
    reservationIdPrefix: "PF-REVIEW-",
    customerName: "審査用デモ",
    origin: "千葉市中央区中央港1-1",
    destination: "千葉大学医学部附属病院",
    preFixedFareYen: 7800,
    assistanceFeeYen: 1100,
    waitingFeeYen: 800,
    totalYen: 9700,
    consentAtLabel: "令和8年9月1日 10:00"
  };

  const CALENDAR_SLOTS = [
    { id: "slot-20260901-1000", label: "令和8年9月1日 10:00", iso: "2026-09-01T10:00:00+09:00" },
    { id: "slot-20260901-1300", label: "令和8年9月1日 13:00", iso: "2026-09-01T13:00:00+09:00" },
    { id: "slot-20260902-1000", label: "令和8年9月2日 10:00", iso: "2026-09-02T10:00:00+09:00" },
    { id: "slot-20260902-1400", label: "令和8年9月2日 14:00", iso: "2026-09-02T14:00:00+09:00" }
  ];

  const CONSENT_NOTICE =
    "走行予定ルート・事前確定運賃額・ルート変更時の取扱いを確認のうえ、審査用デモ予約として保存します。本操作は本番予約・本番カレンダー・通知・売上集計には反映されません。";

  function isReviewDemoMode(search){
    try{
      const params = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
      return params.get("scenario") === SCENARIO;
    }catch(error){
      return false;
    }
  }

  function shouldSkipProductionIntegrations(){
    return isReviewDemoMode();
  }

  function formatYen(amount){
    return Number(amount || 0).toLocaleString("ja-JP") + "円";
  }

  function readStorageList(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }catch(error){
      return [];
    }
  }

  function writeStorageList(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function nextReservationId(){
    const list = readStorageList();
    const next = list.length + 1;
    return DEMO_DEFAULTS.reservationIdPrefix + String(next).padStart(3, "0");
  }

  function findCalendarSlot(slotId){
    return CALENDAR_SLOTS.find(function(slot){
      return slot.id === slotId;
    }) || null;
  }

  function extractFeeBreakdown(result){
    const snapshot = result?.quoteSnapshot || {};
    const serviceFees = Array.isArray(snapshot.serviceFees) ? snapshot.serviceFees : [];
    let assistanceFeeYen = 0;
    let waitingFeeYen = 0;
    serviceFees.forEach(function(row){
      const key = String(row?.key || row?.label || "").toLowerCase();
      const amount = Math.round(Number(row?.amount) || 0);
      if(!amount){
        return;
      }
      if(key.includes("assist") || String(row?.label || "").includes("介助")){
        assistanceFeeYen += amount;
      }else if(key.includes("wait") || String(row?.label || "").includes("待機")){
        waitingFeeYen += amount;
      }
    });
    const totalYen = Math.round(Number(result?.total) || 0);
    let preFixedFareYen = Math.round(Number(snapshot.fixedFareTotal) || 0);
    if(!preFixedFareYen && totalYen > 0){
      preFixedFareYen = Math.max(totalYen - assistanceFeeYen - waitingFeeYen, 0);
    }
    if(!preFixedFareYen){
      preFixedFareYen = DEMO_DEFAULTS.preFixedFareYen;
    }
    if(!assistanceFeeYen){
      assistanceFeeYen = DEMO_DEFAULTS.assistanceFeeYen;
    }
    if(!waitingFeeYen){
      waitingFeeYen = DEMO_DEFAULTS.waitingFeeYen;
    }
    const resolvedTotal = totalYen > 0 ? totalYen : (preFixedFareYen + assistanceFeeYen + waitingFeeYen);
    return {
      preFixedFareYen: preFixedFareYen,
      assistanceFeeYen: assistanceFeeYen,
      waitingFeeYen: waitingFeeYen,
      totalYen: resolvedTotal > 0 ? resolvedTotal : DEMO_DEFAULTS.totalYen
    };
  }

  function buildReservationRecord(options){
    options = options || {};
    const slot = findCalendarSlot(options.slotId) || CALENDAR_SLOTS[0];
    const fees = extractFeeBreakdown(options.result || {});
    const reservationId = options.reservationId || nextReservationId();
    return {
      reservationId: reservationId,
      scenario: SCENARIO,
      storageScope: STORAGE_KEY,
      customerName: DEMO_DEFAULTS.customerName,
      origin: String(options.origin || DEMO_DEFAULTS.origin).trim() || DEMO_DEFAULTS.origin,
      destination: String(options.destination || DEMO_DEFAULTS.destination).trim() || DEMO_DEFAULTS.destination,
      reservationAtLabel: slot.label,
      reservationAtIso: slot.iso,
      preFixedFareLabel: formatYen(fees.preFixedFareYen),
      assistanceFeeLabel: formatYen(fees.assistanceFeeYen),
      waitingFeeLabel: formatYen(fees.waitingFeeYen),
      totalLabel: formatYen(fees.totalYen),
      preFixedFareYen: fees.preFixedFareYen,
      assistanceFeeYen: fees.assistanceFeeYen,
      waitingFeeYen: fees.waitingFeeYen,
      totalYen: fees.totalYen,
      consentAtLabel: slot.label,
      estimateNumber: String(options.estimateNumber || "").trim(),
      savedAt: new Date().toISOString(),
      isReviewDemo: true,
      productionIntegration: "none"
    };
  }

  function saveReservation(record){
    const list = readStorageList();
    list.unshift(record);
    writeStorageList(list.slice(0, 20));
    return record;
  }

  function listReservations(){
    return readStorageList();
  }

  function renderBanner(escapeHtml){
    const esc = typeof escapeHtml === "function" ? escapeHtml : function(v){ return String(v ?? ""); };
    return (
      '<div class="estimate-review-demo-banner" role="status">' +
      esc(BANNER_TEXT) +
      "</div>"
    );
  }

  function renderReservationPanel(options){
    options = options || {};
    const esc = typeof options.escapeHtml === "function" ? options.escapeHtml : function(v){ return String(v ?? ""); };
    const escAttr = typeof options.escapeAttr === "function" ? options.escapeAttr : esc;
    const result = options.result || null;
    const ui = options.ui || {};
    const savedRecord = ui.savedRecord || null;
    const selectedSlotId = String(ui.selectedSlotId || CALENDAR_SLOTS[0].id);
    const consentChecked = ui.consentChecked === true;
    const errorMessage = String(ui.errorMessage || "").trim();
    const fees = extractFeeBreakdown(result || {});
    const origin = String(options.origin || DEMO_DEFAULTS.origin).trim() || DEMO_DEFAULTS.origin;
    const destination = String(options.destination || DEMO_DEFAULTS.destination).trim() || DEMO_DEFAULTS.destination;
    const selectedSlot = findCalendarSlot(selectedSlotId) || CALENDAR_SLOTS[0];

    if(savedRecord){
      return (
        '<section class="estimate-review-demo-reservation estimate-review-demo-reservation--complete" id="reviewDemoReservation" data-review-demo-panel="1">' +
        '<h3 class="estimate-review-demo-title">審査用デモ予約を保存しました</h3>' +
        '<p class="estimate-review-demo-complete-lead">この予約は本番予約・本番カレンダー・通知には反映されません。</p>' +
        '<table class="estimate-review-demo-summary-table">' +
        "<tbody>" +
        summaryRow(esc, "予約ID", savedRecord.reservationId) +
        summaryRow(esc, "利用者名", savedRecord.customerName) +
        summaryRow(esc, "乗車地", savedRecord.origin) +
        summaryRow(esc, "目的地", savedRecord.destination) +
        summaryRow(esc, "予約日時", savedRecord.reservationAtLabel) +
        summaryRow(esc, "事前確定運賃", savedRecord.preFixedFareLabel) +
        summaryRow(esc, "介助料金", savedRecord.assistanceFeeLabel) +
        summaryRow(esc, "待機料金", savedRecord.waitingFeeLabel) +
        summaryRow(esc, "合計", savedRecord.totalLabel) +
        "</tbody></table>" +
        "</section>"
      );
    }

    const slotButtons = CALENDAR_SLOTS.map(function(slot){
      const selected = slot.id === selectedSlotId ? " is-selected" : "";
      return (
        '<button type="button" class="estimate-review-demo-slot' + selected + '" data-review-demo-slot="' + escAttr(slot.id) + '">' +
        esc(slot.label) +
        "</button>"
      );
    }).join("");

    return (
      '<section class="estimate-review-demo-reservation" id="reviewDemoReservation" data-review-demo-panel="1">' +
      '<h3 class="estimate-review-demo-title">審査用デモ予約</h3>' +
      '<p class="estimate-review-demo-lead">予約日時・同意・保存まで、本番に近い操作をデモ環境で確認できます。</p>' +
      '<div class="estimate-review-demo-block">' +
      '<h4 class="estimate-review-demo-subtitle">1. 予約日時を選択</h4>' +
      '<div class="estimate-review-demo-slots" role="list">' + slotButtons + "</div>" +
      '<p class="estimate-review-demo-note">デモ用の固定空き枠です。本番予約カレンダーはブロックしません。</p>' +
      "</div>" +
      '<div class="estimate-review-demo-block">' +
      '<h4 class="estimate-review-demo-subtitle">2. 注意事項を確認</h4>' +
      '<div class="estimate-review-demo-notice">' + esc(CONSENT_NOTICE) + "</div>" +
      '<label class="estimate-review-demo-consent">' +
      '<input type="checkbox" id="reviewDemoConsentCheck"' + (consentChecked ? " checked" : "") + " data-review-demo-consent=\"1\">" +
      "<span>上記の注意事項と選択した予約日時（" + esc(selectedSlot.label) + "）に同意します。</span>" +
      "</label>" +
      "</div>" +
      '<div class="estimate-review-demo-block">' +
      '<h4 class="estimate-review-demo-subtitle">3. 予約内容を確認</h4>' +
      '<table class="estimate-review-demo-summary-table">' +
      "<tbody>" +
      summaryRow(esc, "乗車地", origin) +
      summaryRow(esc, "目的地", destination) +
      summaryRow(esc, "予約日時", selectedSlot.label) +
      summaryRow(esc, "事前確定運賃", formatYen(fees.preFixedFareYen)) +
      summaryRow(esc, "介助料金", formatYen(fees.assistanceFeeYen)) +
      summaryRow(esc, "待機料金", formatYen(fees.waitingFeeYen)) +
      summaryRow(esc, "合計", formatYen(fees.totalYen)) +
      "</tbody></table>" +
      "</div>" +
      (errorMessage ? '<p class="estimate-review-demo-error" role="alert">' + esc(errorMessage) + "</p>" : "") +
      '<button type="button" class="estimate-review-demo-save-btn" id="reviewDemoSaveBtn" data-review-demo-save="1"' +
      (consentChecked ? "" : " disabled") +
      ">審査用デモ予約を保存</button>" +
      "</section>"
    );
  }

  function summaryRow(escapeHtml, label, value){
    return (
      "<tr><th>" + escapeHtml(label) + "</th><td>" + escapeHtml(value) + "</td></tr>"
    );
  }

  global.PreFixedFareReviewDemo = {
    SCENARIO: SCENARIO,
    STORAGE_KEY: STORAGE_KEY,
    BANNER_TEXT: BANNER_TEXT,
    DEMO_DEFAULTS: DEMO_DEFAULTS,
    CALENDAR_SLOTS: CALENDAR_SLOTS,
    CONSENT_NOTICE: CONSENT_NOTICE,
    isReviewDemoMode: isReviewDemoMode,
    shouldSkipProductionIntegrations: shouldSkipProductionIntegrations,
    findCalendarSlot: findCalendarSlot,
    extractFeeBreakdown: extractFeeBreakdown,
    buildReservationRecord: buildReservationRecord,
    saveReservation: saveReservation,
    listReservations: listReservations,
    renderBanner: renderBanner,
    renderReservationPanel: renderReservationPanel
  };
})(typeof window !== "undefined" ? window : globalThis);
