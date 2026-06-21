(function(){
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

  function setAuthStatus(message, type){
    const box = document.getElementById("estimateAuthResult");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function getStoreIdInput(){
    return document.getElementById("estimateStoreId")?.value.trim() || "default";
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

  function renderEditor(){
    const root = document.getElementById("estimateSettingsEditor");
    if(!root || !estimateDraft) return;

    const dp = estimateDraft.distancePricing || {};
    const patternA = dp.patternA || {};
    const patternB = dp.patternB || {};
    const bodyOpt = estimateDraft.options?.bodyAssist || {};

    root.innerHTML = `
      <div class="row"><label><input type="checkbox" id="estimateEnabledToggle" ${estimateDraft.enabled !== false ? "checked" : ""}> 概算見積ページを公開する</label></div>

      <h3>見積履歴</h3>
      <div class="row">
        <label><input type="checkbox" id="estimateSaveHistoryToggle" ${estimateDraft.historySettings?.saveHistory === true ? "checked" : ""}> 見積履歴を Firestore に保存する（ON）</label>
      </div>
      <p class="note">OFF の場合、見積番号は発行されますが履歴は保存しません。ON の場合、日次連番（EST-YYYYMMDD-0001）で履歴を保存します。</p>

      <h3>ページ設定</h3>
      <div class="row"><label>タイトル</label><input type="text" id="estimatePageTitle" value="${escapeAttr(estimateDraft.page?.title || "")}"></div>
      <div class="row"><label>説明文</label><textarea id="estimatePageDescription" rows="3">${escapeHtml(estimateDraft.page?.description || "")}</textarea></div>
      <div class="row"><label>注意事項</label><textarea id="estimatePageDisclaimer" rows="5">${escapeHtml(estimateDraft.page?.disclaimer || "")}</textarea></div>

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

      <h3>車両料金（移動方法）</h3>
      <div id="estimateMobilityItems">${renderCategoryItems("mobility")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="mobility">移動方法を追加</button>

      <h3>介助料金</h3>
      <div id="estimateAssistanceItems">${renderCategoryItems("assistance")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="assistance">介助項目を追加</button>

      <h3>追加オプション：身体介助</h3>
      <div class="grid2">
        <div class="row"><label>表示名</label><input type="text" id="estimateBodyAssistLabel" value="${escapeAttr(bodyOpt.label || "身体介助")}"></div>
        <div class="row"><label>紐付け介助ID</label><input type="text" id="estimateBodyAssistId" value="${escapeAttr(bodyOpt.assistanceId || "body-assist")}"></div>
      </div>
      <div class="row"><label>説明文</label><textarea id="estimateBodyAssistDescription" rows="3">${escapeHtml(bodyOpt.description || "")}</textarea></div>
      <label><input type="checkbox" id="estimateBodyAssistVisible" ${bodyOpt.visible !== false ? "checked" : ""}> 表示する</label>

      <h3>階段介助</h3>
      <div id="estimateStairItems">${renderCategoryItems("stairAssist")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="stairAssist">階段介助項目を追加</button>

      <h3>送迎方法</h3>
      <div id="estimateTripItems">${renderCategoryItems("tripType")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="tripType">送迎方法を追加</button>

      <h3>待機・付き添い料金</h3>
      ${renderFeeEditor("待機30分料金", estimateDraft.waitingFees?.waiting30min, "waitingFees.waiting30min")}
      ${renderFeeEditor("付き添い30分料金", estimateDraft.waitingFees?.escort30min, "waitingFees.escort30min")}

      <h3>移動方法 → 介助内容 自動選択</h3>
      <div id="estimateMappingsEditor"></div>
    `;

    renderMappingsEditor();
    toggleDistanceModeFields();
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
    draft.historySettings = {
      saveHistory: document.getElementById("estimateSaveHistoryToggle")?.checked === true
    };
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

    draft.storeId = getStoreIdInput();

    if(Array.isArray(draft.categories?.tripType?.items)){
      draft.categories.tripType.items.forEach(function(item){
        if(!(Number(item.distanceMultiplier) > 0)){
          item.distanceMultiplier = 1;
        }
        item.waitingFeeRef = String(item.waitingFeeRef || "").trim();
        item.escortFeeRef = String(item.escortFeeRef || "").trim();
      });
    }

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
    renderEditor();
  }

  function removeCategoryItem(categoryKey, index){
    const items = estimateDraft.categories[categoryKey]?.items;
    if(!Array.isArray(items)) return;
    if(!confirm("この項目を削除しますか？")) return;
    items.splice(index, 1);
    items.forEach(function(item, idx){ item.order = idx + 1; });
    renderEditor();
  }

  async function loadEstimateSettings(){
    if(!window.EstimateStore?.isEnabled()){
      setEstimateStatus("Firebase が未設定です。shared/firebase-config.js を設定してください。", "error");
      return;
    }
    try{
      setEstimateStatus("Firestore から読み込み中...", "warn");
      estimateDraft = await window.EstimateStore.loadEstimateConfig(getStoreIdInput());
      renderEditor();
      setEstimateStatus("読み込みに成功しました。", "success");
    }catch(error){
      setEstimateStatus("読み込み失敗: " + error.message, "error");
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
      setEstimateStatus("Firestore に保存中...", "warn");
      estimateDraft = await window.EstimateStore.saveEstimateConfig(draft, getStoreIdInput());
      setEstimateStatus("保存に成功しました。", "success");
    }catch(error){
      setEstimateStatus("保存失敗: " + error.message, "error");
    }
  }

  async function seedDefaultSettings(){
    if(!window.EstimateDefaults?.createDefaultEstimateConfig){
      setEstimateStatus("初期データ生成モジュールが見つかりません。", "error");
      return;
    }
    if(!confirm("初期データで Firestore を上書き保存します。よろしいですか？")) return;
    try{
      estimateDraft = window.EstimateDefaults.createDefaultEstimateConfig(getStoreIdInput());
      renderEditor();
      await saveEstimateSettings();
      setEstimateStatus("初期データの投入に成功しました。", "success");
    }catch(error){
      setEstimateStatus("初期データ投入失敗: " + error.message, "error");
    }
  }

  async function duplicateSettings(){
    const fromStoreId = document.getElementById("estimateCopyFromStoreId")?.value.trim();
    const toStoreId = document.getElementById("estimateCopyToStoreId")?.value.trim();
    if(!fromStoreId || !toStoreId){
      setEstimateStatus("複製元・複製先の店舗IDを入力してください。", "error");
      return;
    }
    if(fromStoreId === toStoreId){
      setEstimateStatus("複製元と複製先が同じです。", "error");
      return;
    }
    if(!confirm('「' + fromStoreId + '」の設定を「' + toStoreId + '」へ複製します。よろしいですか？')) return;
    try{
      setEstimateStatus("設定を複製中...", "warn");
      await window.EstimateStore.copyEstimateConfig(fromStoreId, toStoreId);
      document.getElementById("estimateStoreId").value = toStoreId;
      await loadEstimateSettings();
      setEstimateStatus("「" + toStoreId + "」へ複製しました。", "success");
    }catch(error){
      setEstimateStatus("複製失敗: " + error.message, "error");
    }
  }

  function exportSettingsJson(){
    try{
      const draft = collectDraftFromForm();
      if(!draft) throw new Error("エクスポートするデータがありません。");
      const storeId = getStoreIdInput();
      const filename = "estimate-simulator-" + storeId + ".json";
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

  function validateDraftConfig(draft){
    if(!window.EstimateValidate || typeof window.EstimateValidate.validateEstimateConfig !== "function"){
      return { ok: true, errors: [] };
    }
    return window.EstimateValidate.validateEstimateConfig(draft);
  }

  function importSettingsJson(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(){
      try{
        const parsed = JSON.parse(String(reader.result || ""));
        if(!parsed || typeof parsed !== "object"){
          throw new Error("JSON の形式が不正です。");
        }
        parsed.storeId = getStoreIdInput();
        const validation = validateDraftConfig(parsed);
        if(!validation.ok){
          throw new Error("スキーマ検証エラー: " + validation.errors.join(" / "));
        }
        estimateDraft = parsed;
        renderEditor();
        setEstimateStatus("JSON を読み込みました。内容を確認して「Firestore に保存」してください。", "success");
      }catch(error){
        setEstimateStatus("インポート失敗: " + error.message, "error");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function openPreview(){
    const storeId = getStoreIdInput();
    const previewPath = "./estimate/?store=" + encodeURIComponent(storeId);
    window.open(previewPath, "_blank", "noopener,noreferrer");
  }

  async function signIn(){
    const email = document.getElementById("estimateAuthEmail")?.value.trim();
    const password = document.getElementById("estimateAuthPassword")?.value;
    if(!email || !password){
      setAuthStatus("メールアドレスとパスワードを入力してください。", "error");
      return;
    }
    try{
      await window.EstimateStore.signInAdmin(email, password);
      setAuthStatus("ログインしました。", "success");
    }catch(error){
      setAuthStatus("ログイン失敗: " + error.message, "error");
    }
  }

  async function signOut(){
    await window.EstimateStore.signOutAdmin();
    setAuthStatus("ログアウトしました。", "warn");
  }

  function bindEvents(){
    document.getElementById("estimateReloadBtn")?.addEventListener("click", loadEstimateSettings);
    document.getElementById("estimateSaveBtn")?.addEventListener("click", saveEstimateSettings);
    document.getElementById("estimateSeedBtn")?.addEventListener("click", seedDefaultSettings);
    document.getElementById("estimateDuplicateBtn")?.addEventListener("click", duplicateSettings);
    document.getElementById("estimateExportBtn")?.addEventListener("click", exportSettingsJson);
    document.getElementById("estimatePreviewBtn")?.addEventListener("click", openPreview);
    document.getElementById("estimateImportFile")?.addEventListener("change", function(event){
      const file = event.target.files && event.target.files[0];
      importSettingsJson(file);
      event.target.value = "";
    });
    document.getElementById("estimateAuthSignInBtn")?.addEventListener("click", signIn);
    document.getElementById("estimateAuthSignOutBtn")?.addEventListener("click", signOut);

    document.getElementById("estimateSettingsEditor")?.addEventListener("click", function(event){
      const btn = event.target.closest("[data-action]");
      if(!btn) return;
      const action = btn.getAttribute("data-action");
      const category = btn.getAttribute("data-category");
      const index = Number(btn.getAttribute("data-index"));
      if(action === "add-item") addCategoryItem(category);
      if(action === "move-up") moveCategoryItem(category, index, -1);
      if(action === "move-down") moveCategoryItem(category, index, 1);
      if(action === "remove-item") removeCategoryItem(category, index);
    });

    document.getElementById("estimateSettingsEditor")?.addEventListener("change", function(event){
      if(event.target && event.target.id === "estimateDistanceMode"){
        toggleDistanceModeFields();
      }
    });

    if(window.EstimateStore?.isEnabled() && window.EstimateStore?.onAuthStateChanged){
      window.EstimateStore.onAuthStateChanged(function(user){
        const label = document.getElementById("estimateAuthUserLabel");
        if(label){
          label.textContent = user ? ("ログイン中: " + user.email) : "未ログイン";
        }
      });
    }
  }

  function initEstimateAdmin(){
    bindEvents();
    if(window.EstimateStore?.isEnabled()){
      loadEstimateSettings();
    }else{
      setEstimateStatus("Firebase 未設定のため、shared/firebase-config.js を設定後に再読込してください。", "warn");
      estimateDraft = window.EstimateDefaults?.createDefaultEstimateConfig("default");
      renderEditor();
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initEstimateAdmin);
  }else{
    initEstimateAdmin();
  }
})();
