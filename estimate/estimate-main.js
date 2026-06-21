(function(){
  const state = {
    config: null,
    ctaUrls: {},
    mobilityId: "",
    bodyAssist: false,
    stairId: "",
    tripTypeId: "",
    distanceKm: 0,
    estimateNumber: "",
    estimateCreatedAt: "",
    selectionFingerprint: ""
  };

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeAttr(text){
    return escapeHtml(text);
  }

  function formatYen(amount){
    const n = Number(amount) || 0;
    return "¥" + n.toLocaleString("ja-JP");
  }

  function getRoot(){
    return document.getElementById("estimateApp");
  }

  function showMessage(type, message){
    const root = getRoot();
    if(!root) return;
    root.innerHTML = `<div class="estimate-${type}">${escapeHtml(message)}</div>`;
  }

  function getSelectionFingerprint(){
    return [
      state.mobilityId,
      state.stairId,
      state.tripTypeId,
      state.bodyAssist ? "1" : "0",
      String(state.distanceKm)
    ].join("|");
  }

  function invalidateEstimateNumberIfChanged(){
    const fp = getSelectionFingerprint();
    if(state.selectionFingerprint && state.selectionFingerprint !== fp){
      state.estimateNumber = "";
      state.estimateCreatedAt = "";
    }
    state.selectionFingerprint = fp;
  }

  async function loadCtaUrls(){
    if(window.CarechanCtaDefaults && typeof window.CarechanCtaDefaults.fetchConfigUrls === "function"){
      try{
        state.ctaUrls = await window.CarechanCtaDefaults.fetchConfigUrls();
        return;
      }catch(error){}
    }
    state.ctaUrls = { phone: "", line: "", reservation: "", contact: "" };
  }

  function getVisibleItems(categoryKey){
    const category = state.config?.categories?.[categoryKey];
    return window.EstimateCalc.visibleItems(category?.items || []);
  }

  function ensureDefaults(){
    const mobilityItems = getVisibleItems("mobility");
    const stairItems = getVisibleItems("stairAssist");
    const tripItems = getVisibleItems("tripType");

    if(!state.mobilityId && mobilityItems[0]){
      state.mobilityId = mobilityItems[0].id;
    }
    if(!state.stairId && stairItems[0]){
      state.stairId = stairItems[0].id;
    }
    if(!state.tripTypeId && tripItems[0]){
      state.tripTypeId = tripItems[0].id;
    }
  }

  function getAutoAssistance(){
    const autoId = state.config?.mappings?.mobilityToAssistance?.[state.mobilityId];
    return window.EstimateCalc.findItem(state.config?.categories?.assistance?.items, autoId);
  }

  function getBreakdownRows(result){
    const labels = state.config.resultLabels || {};
    return [
      ["baseFare", labels.baseFare || "基本運賃"],
      ["reservationFee", labels.reservationFee || "予約料金"],
      ["pickupFee", labels.pickupFee || "迎車料金"],
      ["distanceFare", labels.distanceFare || "距離運賃"],
      ["wheelchairFee", labels.wheelchairFee || "車いす料金"],
      ["assistanceFee", labels.assistanceFee || "介助料金"],
      ["stairFee", labels.stairFee || "階段介助料金"],
      ["waitingFee", labels.waitingFee || "待機料金"],
      ["escortFee", labels.escortFee || "付き添い料金"]
    ].map(function(row){
      return {
        label: row[1],
        amount: Number(result.breakdown[row[0]]) || 0
      };
    });
  }

  function renderSelectStep(stepNum, title, categoryKey, fieldName, currentValue){
    const items = getVisibleItems(categoryKey);
    const options = items.map(function(item){
      const selected = item.id === currentValue ? " selected" : "";
      return `<option value="${escapeAttr(item.id)}"${selected}>${escapeHtml(item.label)}</option>`;
    }).join("");

    return `
      <section class="estimate-step">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="estimate-field-row">
          <select class="estimate-select" id="${escapeAttr(fieldName)}" aria-label="${escapeAttr(title)}">
            ${options}
          </select>
        </div>
      </section>
    `;
  }

  function renderStep2(){
    const autoAssist = getAutoAssistance();
    const bodyOption = state.config.options?.bodyAssist || {};
    const showBodyOption = bodyOption.visible !== false;
    const bodyAssistItem = window.EstimateCalc.findItem(
      state.config.categories.assistance.items,
      bodyOption.assistanceId || "body-assist"
    );

    const autoHtml = autoAssist ? `
      <div class="estimate-auto-assist">
        <span>${escapeHtml(autoAssist.label)}（自動選択）</span>
        ${window.EstimateHelp.createHelpButton(autoAssist.label, autoAssist.description)}
      </div>
    ` : "";

    const bodyHtml = showBodyOption ? `
      <label class="estimate-checkbox-row">
        <input type="checkbox" id="bodyAssistCheck" ${state.bodyAssist ? "checked" : ""}>
        <span>${escapeHtml(bodyOption.label || bodyAssistItem?.label || "身体介助")}</span>
        ${window.EstimateHelp.createHelpButton(
          bodyOption.label || bodyAssistItem?.label || "身体介助",
          bodyOption.description || bodyAssistItem?.description || ""
        )}
      </label>
    ` : "";

    return `
      <section class="estimate-step">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP2</div>
            <h2 class="estimate-step-title">${escapeHtml(state.config.categories.assistance.label || "介助内容")}</h2>
          </div>
        </div>
        ${autoHtml}
        ${bodyHtml}
      </section>
    `;
  }

  function renderStep5(){
    return `
      <section class="estimate-step">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP5</div>
            <h2 class="estimate-step-title">距離入力</h2>
          </div>
        </div>
        <label for="distanceKmInput" style="display:block;font-size:14px;font-weight:600;margin-bottom:8px;">距離（km）</label>
        <input type="number" class="estimate-input" id="distanceKmInput" min="0" step="0.1" inputmode="decimal" placeholder="例: 5.5" value="${state.distanceKm > 0 ? escapeAttr(state.distanceKm) : ""}">
        <p style="margin:10px 0 0;font-size:13px;color:#888;">地図検索による距離取得は Phase 2 で提供予定です。</p>
      </section>
    `;
  }

  function renderBreakdown(result){
    return getBreakdownRows(result).map(function(row){
      const zeroClass = row.amount === 0 ? " amount-zero" : "";
      return `<li><span>${escapeHtml(row.label)}</span><span class="${zeroClass.trim()}">${formatYen(row.amount)}</span></li>`;
    }).join("");
  }

  function renderUsageSummary(result){
    const title = state.config.resultLabels?.usageSummary || "ご利用内容";
    const items = Array.isArray(result.usageSummary) ? result.usageSummary : [];
    if(!items.length){
      return "";
    }
    return `
      <div class="estimate-usage">
        <div class="estimate-usage-title">${escapeHtml(title)}</div>
        <ul class="estimate-usage-list">
          ${items.map(function(line){
            return `<li><span class="usage-label">${escapeHtml(line.label)}</span><span class="usage-value">${escapeHtml(line.value)}</span></li>`;
          }).join("")}
        </ul>
      </div>
    `;
  }

  function renderEstimateNumberBox(){
    if(!state.estimateNumber){
      return "";
    }
    const createdLabel = state.estimateCreatedAt && window.EstimatePdf
      ? window.EstimatePdf.formatDateTime(state.estimateCreatedAt)
      : "";
    return `
      <div class="estimate-number-box">
        <div><span class="estimate-number-label">見積番号</span> <strong>${escapeHtml(state.estimateNumber)}</strong></div>
        ${createdLabel ? `<div class="estimate-number-date">見積日時: ${escapeHtml(createdLabel)}</div>` : ""}
      </div>
    `;
  }

  function getReservationUrl(){
    const base = state.ctaUrls.reservation || "#";
    if(window.EstimateHandoff && state.estimateNumber){
      return window.EstimateHandoff.appendEstimateNoToUrl(base, state.estimateNumber);
    }
    return base;
  }

  function persistHandoff(result){
    if(!window.EstimateHandoff || !state.estimateNumber) return;
    window.EstimateHandoff.saveHandoffRecord({
      estimateNumber: state.estimateNumber,
      createdAt: state.estimateCreatedAt,
      total: result.total,
      distanceKm: state.distanceKm,
      usageSummary: result.usageSummary,
      breakdown: result.breakdown,
      selections: {
        mobilityId: state.mobilityId,
        stairId: state.stairId,
        tripTypeId: state.tripTypeId,
        bodyAssist: state.bodyAssist
      }
    });
  }

  function renderResult(result){
    const totalLabel = state.config.resultLabels?.total || "概算料金";
    const reservationUrl = getReservationUrl();
    const lineUrl = state.ctaUrls.line || "#";
    const phoneUrl = state.ctaUrls.phone || "#";

    return `
      <section class="estimate-result" aria-live="polite" aria-atomic="true">
        <h3>見積結果</h3>
        ${renderEstimateNumberBox()}
        ${renderUsageSummary(result)}
        <ul class="estimate-breakdown">
          ${renderBreakdown(result)}
        </ul>
        <div class="estimate-total-box">
          <div class="estimate-total-label">${escapeHtml(totalLabel)}</div>
          <div class="estimate-total-amount">${formatYen(result.total)}</div>
        </div>
        <button type="button" class="estimate-pdf-btn" id="estimatePdfBtn">見積書PDFを保存</button>
        <div class="estimate-pdf-feedback" id="estimatePdfFeedback" aria-live="polite"></div>
        <button type="button" class="estimate-copy-url-btn" id="estimateCopyUrlBtn">見積URLをコピー</button>
        <div class="estimate-copy-url-feedback" id="estimateCopyUrlFeedback" aria-live="polite"></div>
      </section>
      <div class="estimate-cta-group">
        <a class="estimate-cta-primary" href="${escapeAttr(reservationUrl)}" target="_blank" rel="noopener noreferrer">この内容で予約する</a>
        <div class="estimate-cta-secondary-row">
          <a class="estimate-cta-secondary" href="${escapeAttr(lineUrl)}" target="_blank" rel="noopener noreferrer">LINEで相談する</a>
          <a class="estimate-cta-secondary" href="${escapeAttr(phoneUrl)}">電話で問い合わせる</a>
        </div>
      </div>
      <div class="estimate-disclaimer">${escapeHtml(state.config.page?.disclaimer || "")}</div>
    `;
  }

  function renderPage(){
    const root = getRoot();
    if(!root || !state.config) return;

    ensureDefaults();
    invalidateEstimateNumberIfChanged();
    const result = window.EstimateCalc.computeEstimate(state.config, state);

    root.innerHTML = `
      <div class="estimate-wrap">
        <h1 class="estimate-title">${escapeHtml(state.config.page?.title || "概算見積シミュレーター")}</h1>
        <p class="estimate-lead">${escapeHtml(state.config.page?.description || "")}</p>
        ${renderSelectStep(1, state.config.categories.mobility.label || "移動方法", "mobility", "mobilitySelect", state.mobilityId)}
        ${renderStep2()}
        ${renderSelectStep(3, state.config.categories.stairAssist.label || "階段介助", "stairAssist", "stairSelect", state.stairId)}
        ${renderSelectStep(4, state.config.categories.tripType.label || "送迎方法", "tripType", "tripSelect", state.tripTypeId)}
        ${renderStep5()}
        ${renderResult(result)}
      </div>
    `;

    bindEvents();
    window.EstimateHelp.bindHelpButtons(root);
    bindCopyUrlButton();
    bindPdfButton(result);

    addSelectHelpButtons("mobilitySelect", "mobility");
    addSelectHelpButtons("tripSelect", "tripType");
    addSelectHelpButtons("stairSelect", "stairAssist");
  }

  function addSelectHelpButtons(selectId, categoryKey){
    const select = document.getElementById(selectId);
    if(!select || !select.parentElement) return;
    const row = select.parentElement;

    function updateHelp(){
      const item = window.EstimateCalc.findItem(
        state.config.categories[categoryKey].items,
        select.value
      );
      let btn = row.querySelector(".estimate-select-help");
      if(!item || !String(item.description || "").trim()){
        if(btn) btn.remove();
        return;
      }
      if(!btn){
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "estimate-help-btn estimate-select-help";
        row.appendChild(btn);
      }
      btn.setAttribute("aria-label", item.label + "の説明を見る");
      btn.textContent = "?";
      btn.onclick = function(){
        window.EstimateHelp.openHelp(item.label, item.description);
      };
    }

    select.addEventListener("change", updateHelp);
    updateHelp();
  }

  async function ensureEstimateNumber(result){
    if(state.estimateNumber){
      return state.estimateNumber;
    }

    if(!window.EstimateNumber){
      throw new Error("見積番号モジュールが読み込まれていません。");
    }

    state.estimateNumber = window.EstimateNumber.issueLocalEstimateNumber();
    state.estimateCreatedAt = new Date().toISOString();
    persistHandoff(result);
    return state.estimateNumber;
  }

  async function saveEstimatePdf(result){
    const feedback = document.getElementById("estimatePdfFeedback");
    const btn = document.getElementById("estimatePdfBtn");
    if(btn) btn.disabled = true;
    if(feedback) feedback.textContent = "PDF を作成しています...";

    try{
      await ensureEstimateNumber(result);
      if(!window.EstimatePdf){
        throw new Error("PDF モジュールが読み込まれていません。");
      }
      await window.EstimatePdf.savePdf({
        estimateNumber: state.estimateNumber,
        createdAt: state.estimateCreatedAt,
        usageSummary: result.usageSummary,
        breakdownRows: getBreakdownRows(result),
        total: result.total,
        disclaimer: state.config.page?.disclaimer || "",
        pageTitle: state.config.page?.title || ""
      });
      if(feedback) feedback.textContent = "PDF を保存しました（" + state.estimateNumber + "）";
      refreshResultSection(result);
    }catch(error){
      if(feedback) feedback.textContent = "PDF 保存に失敗しました: " + error.message;
    }finally{
      if(btn) btn.disabled = false;
    }
  }

  function bindPdfButton(result){
    const btn = document.getElementById("estimatePdfBtn");
    if(!btn) return;
    btn.addEventListener("click", function(){
      saveEstimatePdf(result);
    });
  }

  function refreshResultSection(result){
    const resultSection = document.querySelector(".estimate-result");
    const ctaGroup = document.querySelector(".estimate-cta-group");
    const disclaimer = document.querySelector(".estimate-disclaimer");
    if(!resultSection) return;

    const temp = document.createElement("div");
    temp.innerHTML = renderResult(result);
    const newResult = temp.querySelector(".estimate-result");
    const newCta = temp.querySelector(".estimate-cta-group");
    const newDisclaimer = temp.querySelector(".estimate-disclaimer");

    if(newResult) resultSection.replaceWith(newResult);
    if(newCta && ctaGroup) ctaGroup.replaceWith(newCta);
    if(newDisclaimer && disclaimer) disclaimer.replaceWith(newDisclaimer);
    bindCopyUrlButton();
    bindPdfButton(result);
  }

  function buildShareUrl(){
    if(!window.EstimateUrl || typeof window.EstimateUrl.buildShareUrl !== "function"){
      return window.location.href;
    }
    return window.EstimateUrl.buildShareUrl({
      mobilityId: state.mobilityId,
      stairId: state.stairId,
      tripTypeId: state.tripTypeId,
      distanceKm: state.distanceKm,
      bodyAssist: state.bodyAssist,
      estimateNumber: state.estimateNumber
    });
  }

  async function copyShareUrl(){
    const url = buildShareUrl();
    const feedback = document.getElementById("estimateCopyUrlFeedback");
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(url);
      }else{
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      if(feedback) feedback.textContent = "見積URLをコピーしました";
    }catch(error){
      if(feedback) feedback.textContent = "コピーに失敗しました。URL: " + url;
    }
  }

  function bindCopyUrlButton(){
    const btn = document.getElementById("estimateCopyUrlBtn");
    if(!btn) return;
    btn.addEventListener("click", copyShareUrl);
  }

  function bindEvents(){
    const mobilitySelect = document.getElementById("mobilitySelect");
    const stairSelect = document.getElementById("stairSelect");
    const tripSelect = document.getElementById("tripSelect");
    const bodyAssistCheck = document.getElementById("bodyAssistCheck");
    const distanceInput = document.getElementById("distanceKmInput");

    if(mobilitySelect){
      mobilitySelect.addEventListener("change", function(){
        state.mobilityId = mobilitySelect.value;
        renderPage();
      });
    }
    if(stairSelect){
      stairSelect.addEventListener("change", function(){
        state.stairId = stairSelect.value;
        updateResultOnly();
      });
    }
    if(tripSelect){
      tripSelect.addEventListener("change", function(){
        state.tripTypeId = tripSelect.value;
        updateResultOnly();
      });
    }
    if(bodyAssistCheck){
      bodyAssistCheck.addEventListener("change", function(){
        state.bodyAssist = bodyAssistCheck.checked;
        updateResultOnly();
      });
    }
    if(distanceInput){
      distanceInput.addEventListener("input", function(){
        state.distanceKm = Number(distanceInput.value) || 0;
        updateResultOnly();
      });
    }
  }

  function updateResultOnly(){
    invalidateEstimateNumberIfChanged();
    const result = window.EstimateCalc.computeEstimate(state.config, state);
    refreshResultSection(result);
  }

  async function init(){
    showMessage("loading", "設定を読み込んでいます...");
    try{
      if(!window.EstimateConfigLoader || typeof window.EstimateConfigLoader.loadEstimateConfig !== "function"){
        throw new Error("設定の読み込み機能が利用できません。");
      }
      await loadCtaUrls();

      const urlState = window.EstimateUrl?.parseUrlState?.() || {};
      state.config = await window.EstimateConfigLoader.loadEstimateConfig();

      if(window.EstimateUrl?.applyUrlStateToFormState){
        window.EstimateUrl.applyUrlStateToFormState(state, urlState, state.config);
      }
      if(urlState.estimateNumber){
        state.estimateNumber = urlState.estimateNumber;
      }

      renderPage();
    }catch(error){
      showMessage("error", error.message || "読み込みに失敗しました。");
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();

