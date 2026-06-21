(function(){
  const ESTIMATE_CONFIG_PATH = "data/estimate-config.json";
  let estimateDraft = null;

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

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function setEstimateStatus(message, type){
    const box = document.getElementById("estimateSaveResult");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function markEstimateDirty(){
    if(typeof window.markEstimateConfigDirty === "function"){
      window.markEstimateConfigDirty();
    }
  }

  function clearEstimateDirty(){
    if(typeof window.clearEstimateConfigDirty === "function"){
      window.clearEstimateConfigDirty();
    }
  }

  function renderFeeEditor(label, obj, path){
    obj = obj || { label: label, amount: 0, description: "", visible: true, order: 1 };
    return `
      <div class="estimate-admin-fee">
        <div class="grid2">
          <div class="row"><label>名称</label><input type="text" data-estimate-path="${escapeAttr(path)}.label" value="${escapeAttr(obj.label || label)}"></div>
          <div class="row"><label>金額（円）</label><input type="number" min="0" step="1" data-estimate-path="${escapeAttr(path)}.amount" value="${escapeAttr(obj.amount ?? 0)}"></div>
        </div>
        <div class="row"><label>説明文</label><textarea rows="2" data-estimate-path="${escapeAttr(path)}.description">${escapeHtml(obj.description || "")}</textarea></div>
        <label><input type="checkbox" data-estimate-path="${escapeAttr(path)}.visible" ${obj.visible !== false ? "checked" : ""}> 表示する</label>
      </div>
    `;
  }

  function renderTripBehaviorFields(categoryKey, item, index){
    if(categoryKey !== "tripType") return "";
    const waitingKeys = Object.keys(estimateDraft.waitingFees || {});
    const waitingOptions = ['<option value="">なし</option>'].concat(waitingKeys.map(function(key){
      const selected = item.waitingFeeRef === key ? " selected" : "";
      return `<option value="${escapeAttr(key)}"${selected}>${escapeHtml(key)}</option>`;
    })).join("");
    const escortOptions = ['<option value="">なし</option>'].concat(waitingKeys.map(function(key){
      const selected = item.escortFeeRef === key ? " selected" : "";
      return `<option value="${escapeAttr(key)}"${selected}>${escapeHtml(key)}</option>`;
    })).join("");
    return `
      <div class="grid2">
        <div class="row"><label>距離運賃倍率</label><input type="number" min="0.1" step="0.1" data-item-field="distanceMultiplier" data-category="${escapeAttr(categoryKey)}" data-index="${index}" value="${escapeAttr(item.distanceMultiplier ?? 1)}"></div>
        <div class="row"><label>待機料金（waitingFees キー）</label><select data-item-field="waitingFeeRef" data-category="${escapeAttr(categoryKey)}" data-index="${index}">${waitingOptions}</select></div>
        <div class="row"><label>付き添い料金（waitingFees キー）</label><select data-item-field="escortFeeRef" data-category="${escapeAttr(categoryKey)}" data-index="${index}">${escortOptions}</select></div>
      </div>
    `;
  }

  function renderCategoryItems(categoryKey){
    const category = estimateDraft.categories[categoryKey];
    const items = Array.isArray(category?.items) ? category.items.slice().sort(function(a,b){ return (a.order||0)-(b.order||0); }) : [];

    return items.map(function(item, index){
      return `
        <div class="estimate-admin-item" data-category="${escapeAttr(categoryKey)}" data-index="${index}">
          <div class="estimate-admin-item-head">
            <strong>${escapeHtml(item.label || item.id || ("項目" + (index + 1)))}</strong>
            <div class="actions">
              <button type="button" class="secondary" data-action="move-up" data-category="${escapeAttr(categoryKey)}" data-index="${index}">↑</button>
              <button type="button" class="secondary" data-action="move-down" data-category="${escapeAttr(categoryKey)}" data-index="${index}">↓</button>
              <button type="button" class="secondary" data-action="remove-item" data-category="${escapeAttr(categoryKey)}" data-index="${index}">削除</button>
            </div>
          </div>
          <div class="grid2">
            <div class="row"><label>ID</label><input type="text" data-item-field="id" data-category="${escapeAttr(categoryKey)}" data-index="${index}" value="${escapeAttr(item.id || "")}"></div>
            <div class="row"><label>表示名</label><input type="text" data-item-field="label" data-category="${escapeAttr(categoryKey)}" data-index="${index}" value="${escapeAttr(item.label || "")}"></div>
            <div class="row"><label>金額（円）</label><input type="number" min="0" step="1" data-item-field="amount" data-category="${escapeAttr(categoryKey)}" data-index="${index}" value="${escapeAttr(item.amount ?? 0)}"></div>
            <div class="row"><label>並び順</label><input type="number" min="0" step="1" data-item-field="order" data-category="${escapeAttr(categoryKey)}" data-index="${index}" value="${escapeAttr(item.order ?? (index + 1))}"></div>
          </div>
          ${renderTripBehaviorFields(categoryKey, item, index)}
          <div class="row"><label>説明文（必須推奨）</label><textarea rows="3" data-item-field="description" data-category="${escapeAttr(categoryKey)}" data-index="${index}">${escapeHtml(item.description || "")}</textarea></div>
          <label><input type="checkbox" data-item-field="visible" data-category="${escapeAttr(categoryKey)}" data-index="${index}" ${item.visible !== false ? "checked" : ""}> 表示する</label>
        </div>
      `;
    }).join("");
  }

  function renderMappingsEditor(){
    const root = document.getElementById("estimateMappingsEditor");
    if(!root || !estimateDraft) return;
    const mobilityItems = estimateDraft.categories?.mobility?.items || [];
    const assistanceItems = estimateDraft.categories?.assistance?.items || [];
    const mappings = estimateDraft.mappings?.mobilityToAssistance || {};

    root.innerHTML = mobilityItems.map(function(mobility){
      const options = assistanceItems.map(function(assist){
        const selected = mappings[mobility.id] === assist.id ? " selected" : "";
        return `<option value="${escapeAttr(assist.id)}"${selected}>${escapeHtml(assist.label || assist.id)}</option>`;
      }).join("");
      return `
        <div class="row">
          <label>${escapeHtml(mobility.label || mobility.id)}</label>
          <select data-mapping-mobility="${escapeAttr(mobility.id)}">${options}</select>
        </div>
      `;
    }).join("");
  }

  function renderEditor(){
    const root = document.getElementById("estimateSettingsEditor");
    if(!root || !estimateDraft) return;

    const dp = estimateDraft.distancePricing || {};
    const patternA = dp.patternA || {};
    const patternB = dp.patternB || {};
    const bodyOpt = estimateDraft.options?.bodyAssist || {};

    root.innerHTML = `
      <div class="row"><label><input type="checkbox" id="estimateEnabledToggle" ${estimateDraft.enabled !== false ? "checked" : ""}> 概算見積ページを公開する</label></div>

      <h3>ページ設定</h3>
      <div class="row"><label>タイトル</label><input type="text" id="estimatePageTitle" value="${escapeAttr(estimateDraft.page?.title || "")}"></div>
      <div class="row"><label>説明文</label><textarea id="estimatePageDescription" rows="3">${escapeHtml(estimateDraft.page?.description || "")}</textarea></div>

      <h3>基本料金</h3>
      ${renderFeeEditor("基本運賃", estimateDraft.basicFees?.baseFare, "basicFees.baseFare")}
      ${renderFeeEditor("予約料金", estimateDraft.basicFees?.reservationFee, "basicFees.reservationFee")}
      ${renderFeeEditor("迎車料金", estimateDraft.basicFees?.pickupFee, "basicFees.pickupFee")}

      <h3>距離料金</h3>
      <div class="row">
        <label>計算パターン</label>
        <select id="estimateDistanceMode">
          <option value="patternA" ${dp.mode === "patternA" ? "selected" : ""}>パターンA（初乗＋加算）</option>
          <option value="patternB" ${dp.mode === "patternB" ? "selected" : ""}>パターンB（1km単価）</option>
        </select>
      </div>
      <div id="estimatePatternAFields">
        <div class="grid2">
          <div class="row"><label>初乗距離（km）</label><input type="number" min="0" step="0.001" id="estimateInitialDistanceKm" value="${escapeAttr(patternA.initialDistanceKm ?? 0)}"></div>
          <div class="row"><label>初乗運賃（円）</label><input type="number" min="0" step="1" id="estimateInitialFare" value="${escapeAttr(patternA.initialFare ?? 0)}"></div>
          <div class="row"><label>加算距離（km）</label><input type="number" min="0" step="0.001" id="estimateIncrementDistanceKm" value="${escapeAttr(patternA.incrementDistanceKm ?? 0)}"></div>
          <div class="row"><label>加算運賃（円）</label><input type="number" min="0" step="1" id="estimateIncrementFare" value="${escapeAttr(patternA.incrementFare ?? 0)}"></div>
        </div>
      </div>
      <div id="estimatePatternBFields">
        <div class="row"><label>1km単価（円）</label><input type="number" min="0" step="1" id="estimatePerKmRate" value="${escapeAttr(patternB.perKmRate ?? 0)}"></div>
      </div>

      <h3>車いす料金（移動方法）</h3>
      <div id="estimateMobilityItems">${renderCategoryItems("mobility")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="mobility">移動方法を追加</button>

      <h3>介助料金</h3>
      <div id="estimateAssistanceItems">${renderCategoryItems("assistance")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="assistance">介助項目を追加</button>

      <h3>階段介助料金</h3>
      <div id="estimateStairItems">${renderCategoryItems("stairAssist")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="stairAssist">階段介助項目を追加</button>

      <h3>待機料金</h3>
      ${renderFeeEditor("待機30分料金", estimateDraft.waitingFees?.waiting30min, "waitingFees.waiting30min")}
      ${renderFeeEditor("付き添い30分料金", estimateDraft.waitingFees?.escort30min, "waitingFees.escort30min")}

      <h3>送迎方法</h3>
      <div id="estimateTripItems">${renderCategoryItems("tripType")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="tripType">送迎方法を追加</button>

      <h3>追加オプション：身体介助</h3>
      <div class="grid2">
        <div class="row"><label>表示名</label><input type="text" id="estimateBodyAssistLabel" value="${escapeAttr(bodyOpt.label || "身体介助")}"></div>
        <div class="row"><label>紐付け介助ID</label><input type="text" id="estimateBodyAssistId" value="${escapeAttr(bodyOpt.assistanceId || "body-assist")}"></div>
      </div>
      <div class="row"><label>説明文</label><textarea id="estimateBodyAssistDescription" rows="3">${escapeHtml(bodyOpt.description || "")}</textarea></div>
      <label><input type="checkbox" id="estimateBodyAssistVisible" ${bodyOpt.visible !== false ? "checked" : ""}> 表示する</label>

      <h3>移動方法 → 介助内容 自動選択</h3>
      <div id="estimateMappingsEditor"></div>

      <h3>注意事項</h3>
      <div class="row"><label>概算見積ページに表示する注意事項</label><textarea id="estimatePageDisclaimer" rows="5">${escapeHtml(estimateDraft.page?.disclaimer || "")}</textarea></div>
    `;

    renderMappingsEditor();
    toggleDistanceModeFields();
  }

  function toggleDistanceModeFields(){
    const mode = document.getElementById("estimateDistanceMode")?.value || "patternA";
    const a = document.getElementById("estimatePatternAFields");
    const b = document.getElementById("estimatePatternBFields");
    if(a) a.style.display = mode === "patternA" ? "block" : "none";
    if(b) b.style.display = mode === "patternB" ? "block" : "none";
  }

  function setByPath(obj, path, value){
    const parts = path.split(".");
    let cur = obj;
    for(let i = 0; i < parts.length - 1; i++){
      if(!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function collectDraftFromForm(){
    if(!estimateDraft) return null;
    const draft = deepClone(estimateDraft);

    draft.enabled = document.getElementById("estimateEnabledToggle")?.checked !== false;
    draft.page = {
      title: document.getElementById("estimatePageTitle")?.value.trim() || "",
      description: document.getElementById("estimatePageDescription")?.value || "",
      disclaimer: document.getElementById("estimatePageDisclaimer")?.value || ""
    };

    document.querySelectorAll("[data-estimate-path]").forEach(function(el){
      const path = el.getAttribute("data-estimate-path");
      if(!path) return;
      let value;
      if(el.type === "checkbox"){
        value = el.checked;
      }else if(el.type === "number"){
        value = Number(el.value);
      }else{
        value = el.value;
      }
      setByPath(draft, path, value);
    });

    draft.distancePricing = draft.distancePricing || {};
    draft.distancePricing.mode = document.getElementById("estimateDistanceMode")?.value || "patternA";
    draft.distancePricing.patternA = {
      initialDistanceKm: Number(document.getElementById("estimateInitialDistanceKm")?.value) || 0,
      initialFare: Number(document.getElementById("estimateInitialFare")?.value) || 0,
      incrementDistanceKm: Number(document.getElementById("estimateIncrementDistanceKm")?.value) || 0,
      incrementFare: Number(document.getElementById("estimateIncrementFare")?.value) || 0
    };
    draft.distancePricing.patternB = {
      perKmRate: Number(document.getElementById("estimatePerKmRate")?.value) || 0
    };

    document.querySelectorAll("[data-item-field]").forEach(function(el){
      const category = el.getAttribute("data-category");
      const index = Number(el.getAttribute("data-index"));
      const field = el.getAttribute("data-item-field");
      if(!category || Number.isNaN(index) || !field) return;
      const item = draft.categories[category].items[index];
      if(!item) return;
      if(el.type === "checkbox"){
        item[field] = el.checked;
      }else if(el.type === "number"){
        item[field] = Number(el.value);
      }else if(el.tagName === "SELECT"){
        item[field] = el.value;
      }else{
        item[field] = el.value;
      }
    });

    draft.options = draft.options || {};
    draft.options.bodyAssist = {
      id: "body-assist-option",
      label: document.getElementById("estimateBodyAssistLabel")?.value.trim() || "身体介助",
      description: document.getElementById("estimateBodyAssistDescription")?.value || "",
      assistanceId: document.getElementById("estimateBodyAssistId")?.value.trim() || "body-assist",
      visible: document.getElementById("estimateBodyAssistVisible")?.checked !== false
    };

    draft.mappings = draft.mappings || { mobilityToAssistance: {} };
    document.querySelectorAll("[data-mapping-mobility]").forEach(function(el){
      const mobilityId = el.getAttribute("data-mapping-mobility");
      if(mobilityId){
        draft.mappings.mobilityToAssistance[mobilityId] = el.value;
      }
    });

    if(Array.isArray(draft.categories?.tripType?.items)){
      draft.categories.tripType.items.forEach(function(item){
        if(!(Number(item.distanceMultiplier) > 0)){
          item.distanceMultiplier = 1;
        }
        item.waitingFeeRef = String(item.waitingFeeRef || "").trim();
        item.escortFeeRef = String(item.escortFeeRef || "").trim();
      });
    }

    draft.version = typeof draft.version === "number" ? draft.version : 1;
    draft.updatedAt = new Date().toISOString();
    return draft;
  }

  function normalizeEstimateConfig(data){
    const draft = deepClone(data || {});
    if(typeof draft.enabled !== "boolean") draft.enabled = true;
    if(typeof draft.version !== "number") draft.version = 1;
    return draft;
  }

  function addCategoryItem(categoryKey){
    if(!estimateDraft.categories[categoryKey]) estimateDraft.categories[categoryKey] = { label: categoryKey, items: [] };
    const items = estimateDraft.categories[categoryKey].items;
    const nextOrder = items.length + 1;
    const id = categoryKey + "-" + Date.now();
    const newItem = {
      id: id,
      label: "新規項目",
      description: "",
      amount: 0,
      visible: true,
      order: nextOrder
    };
    if(categoryKey === "tripType"){
      newItem.distanceMultiplier = 1;
      newItem.waitingFeeRef = "";
      newItem.escortFeeRef = "";
    }
    items.push(newItem);
    markEstimateDirty();
    renderEditor();
  }

  function moveCategoryItem(categoryKey, index, direction){
    const items = estimateDraft.categories[categoryKey]?.items;
    if(!Array.isArray(items)) return;
    const target = index + direction;
    if(target < 0 || target >= items.length) return;
    const tmp = items[index];
    items[index] = items[target];
    items[target] = tmp;
    items.forEach(function(item, idx){ item.order = idx + 1; });
    markEstimateDirty();
    renderEditor();
  }

  function removeCategoryItem(categoryKey, index){
    const items = estimateDraft.categories[categoryKey]?.items;
    if(!Array.isArray(items)) return;
    if(!confirm("この項目を削除しますか？")) return;
    items.splice(index, 1);
    items.forEach(function(item, idx){ item.order = idx + 1; });
    markEstimateDirty();
    renderEditor();
  }

  function validateDraftConfig(draft){
    if(!window.EstimateValidate || typeof window.EstimateValidate.validateEstimateConfig !== "function"){
      return { ok: true, errors: [] };
    }
    return window.EstimateValidate.validateEstimateConfig(draft);
  }

  async function loadEstimateSettings(){
    try{
      setEstimateStatus("estimate-config.json を読み込み中...", "warn");
      const res = await fetch("./" + ESTIMATE_CONFIG_PATH + "?" + Date.now(), { cache: "no-store" });
      if(!res.ok){
        throw new Error("HTTP " + res.status);
      }
      estimateDraft = normalizeEstimateConfig(await res.json());
      renderEditor();
      clearEstimateDirty();
      setEstimateStatus("読み込みに成功しました。", "success");
    }catch(error){
      if(window.EstimateDefaults?.createDefaultEstimateConfig){
        estimateDraft = window.EstimateDefaults.createDefaultEstimateConfig();
        renderEditor();
        markEstimateDirty();
        setEstimateStatus("estimate-config.json が見つかりません。初期値を表示しています。保存してください。", "warn");
      }else{
        setEstimateStatus("読み込み失敗: " + error.message, "error");
      }
    }
  }

  async function saveEstimateSettings(){
    try{
      const draft = collectDraftFromForm();
      if(!draft) throw new Error("編集データがありません。");
      const validation = validateDraftConfig(draft);
      if(!validation.ok){
        throw new Error("保存前検証エラー: " + validation.errors.join(" / "));
      }
      estimateDraft = draft;
      if(typeof window.saveEstimateConfigToGitHub === "function"){
        await window.saveEstimateConfigToGitHub(false);
      }else{
        throw new Error("GitHub 保存機能が利用できません。");
      }
    }catch(error){
      setEstimateStatus("保存失敗: " + error.message, "error");
    }
  }

  function resetToDefaultSettings(){
    if(!window.EstimateDefaults?.createDefaultEstimateConfig){
      setEstimateStatus("初期データ生成モジュールが見つかりません。", "error");
      return;
    }
    if(!confirm("編集内容を初期値に戻します。よろしいですか？")) return;
    estimateDraft = window.EstimateDefaults.createDefaultEstimateConfig();
    markEstimateDirty();
    renderEditor();
    setEstimateStatus("初期値を表示しました。「estimate-config.json を保存」で反映してください。", "success");
  }

  function exportSettingsJson(){
    try{
      const draft = collectDraftFromForm();
      if(!draft) throw new Error("エクスポートするデータがありません。");
      const filename = "estimate-config.json";
      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setEstimateStatus("JSON をエクスポートしました（" + filename + "）。", "success");
    }catch(error){
      setEstimateStatus("エクスポート失敗: " + error.message, "error");
    }
  }

  function importSettingsJson(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(){
      try{
        const parsed = normalizeEstimateConfig(JSON.parse(String(reader.result || "")));
        const validation = validateDraftConfig(parsed);
        if(!validation.ok){
          throw new Error("スキーマ検証エラー: " + validation.errors.join(" / "));
        }
        estimateDraft = parsed;
        markEstimateDirty();
        renderEditor();
        setEstimateStatus("JSON を読み込みました。内容を確認して保存してください。", "success");
      }catch(error){
        setEstimateStatus("インポート失敗: " + error.message, "error");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function openPreview(){
    window.open("./estimate/", "_blank", "noopener,noreferrer");
  }

  function handleCategoryItemAction(btn){
    const action = btn.getAttribute("data-action");
    const category = btn.getAttribute("data-category");
    const index = Number(btn.getAttribute("data-index"));
    if(action === "add-item") addCategoryItem(category);
    if(action === "move-up") moveCategoryItem(category, index, -1);
    if(action === "move-down") moveCategoryItem(category, index, 1);
    if(action === "remove-item") removeCategoryItem(category, index);
  }

  function handleEstimateEditorChange(event){
    if(event.target && event.target.id === "estimateDistanceMode"){
      toggleDistanceModeFields();
    }
    markEstimateDirty();
  }

  function bindEvents(){
    document.getElementById("estimateReloadBtn")?.addEventListener("click", loadEstimateSettings);
    document.getElementById("estimateSaveBtn")?.addEventListener("click", saveEstimateSettings);
    document.getElementById("estimateSeedBtn")?.addEventListener("click", resetToDefaultSettings);
    document.getElementById("estimateExportBtn")?.addEventListener("click", exportSettingsJson);
    document.getElementById("estimatePreviewBtn")?.addEventListener("click", openPreview);
    document.getElementById("estimateImportFile")?.addEventListener("change", function(event){
      const file = event.target.files && event.target.files[0];
      importSettingsJson(file);
      event.target.value = "";
    });

    document.getElementById("estimateSettingsEditor")?.addEventListener("click", function(event){
      const btn = event.target.closest("[data-action]");
      if(!btn) return;
      handleCategoryItemAction(btn);
    });

    document.getElementById("estimateSettingsEditor")?.addEventListener("input", handleEstimateEditorChange);
    document.getElementById("estimateSettingsEditor")?.addEventListener("change", handleEstimateEditorChange);
  }

  function getEstimateDraftForSave(){
    const draft = collectDraftFromForm();
    if(!draft) throw new Error("概算見積設定がありません。");
    const validation = validateDraftConfig(draft);
    if(!validation.ok){
      throw new Error("概算見積設定の検証エラー: " + validation.errors.join(" / "));
    }
    return draft;
  }

  function initEstimateAdmin(){
    bindEvents();
    loadEstimateSettings();
  }

  window.getEstimateDraftForSave = getEstimateDraftForSave;
  window.loadEstimateSettings = loadEstimateSettings;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initEstimateAdmin);
  }else{
    initEstimateAdmin();
  }
})();
