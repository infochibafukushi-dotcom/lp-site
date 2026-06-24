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

  function renderFeeEditor(label, obj, path, options){
    options = options || {};
    obj = obj || { label: label, amount: 0, description: "", visible: true, order: 1 };
    const enabledLabel = options.enabledLabel || "表示する";
    const noteHtml = options.note
      ? `<p class="note">${escapeHtml(options.note)}</p>`
      : "";
    return `
      <div class="estimate-admin-fee">
        ${noteHtml}
        <div class="grid2">
          <div class="row"><label>名称</label><input type="text" data-estimate-path="${escapeAttr(path)}.label" value="${escapeAttr(obj.label || label)}"></div>
          <div class="row"><label>金額（円）</label><input type="number" min="0" step="1" data-estimate-path="${escapeAttr(path)}.amount" value="${escapeAttr(obj.amount ?? 0)}"></div>
        </div>
        <div class="row"><label>説明文</label><textarea rows="2" data-estimate-path="${escapeAttr(path)}.description">${escapeHtml(obj.description || "")}</textarea></div>
        <label><input type="checkbox" data-estimate-path="${escapeAttr(path)}.visible" ${obj.visible !== false ? "checked" : ""}> ${escapeHtml(enabledLabel)}</label>
      </div>
    `;
  }

  function renderTripBehaviorFields(categoryKey, item, index){
    if(categoryKey !== "tripType" && categoryKey !== "roundTripAddon") return "";
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
          ${categoryKey === "tripType" ? `<label><input type="checkbox" data-item-field="showInSelector" data-category="${escapeAttr(categoryKey)}" data-index="${index}" ${item.showInSelector !== false ? "checked" : ""}> 送迎方法の選択肢に表示</label>` : ""}
          <div class="row"><label>説明文（必須推奨）</label><textarea rows="3" data-item-field="description" data-category="${escapeAttr(categoryKey)}" data-index="${index}">${escapeHtml(item.description || "")}</textarea></div>
          <label><input type="checkbox" data-item-field="visible" data-category="${escapeAttr(categoryKey)}" data-index="${index}" ${item.visible !== false ? "checked" : ""}> 表示する</label>
        </div>
      `;
    }).join("");
  }

  function renderPdfFooterEditor(){
    const footer = estimateDraft.pdfFooter || {};
    return `
      <h3>見積書フッター設定</h3>
      <p class="note">見積書PDFの最下部に表示する事業者情報です。営業・配布用PDFとして利用できます。</p>
      <div class="row"><label><input type="checkbox" id="estimatePdfFooterEnabled" ${footer.enabled !== false ? "checked" : ""}> 見積書PDFフッターを表示する</label></div>
      <div class="row"><label>事業者名</label><input type="text" id="estimatePdfFooterBusinessName" value="${escapeAttr(footer.businessName || "")}" placeholder="例：ちばケアタクシー"></div>
      <div class="row"><label>電話番号</label><input type="text" id="estimatePdfFooterPhone" value="${escapeAttr(footer.phone || "")}" placeholder="例：043-000-0000"></div>
      <div class="row"><label>ホームページURL</label><input type="url" id="estimatePdfFooterHomepageUrl" value="${escapeAttr(footer.homepageUrl || "")}" placeholder="https://example.com"></div>
      <div class="row"><label>ホームページQRラベル</label><input type="text" id="estimatePdfFooterHomepageQrLabel" value="${escapeAttr(footer.homepageQrLabel || "ホームページはこちら")}" placeholder="例：ホームページはこちら"></div>
      <div class="row"><label>LINE URL</label><input type="url" id="estimatePdfFooterLineUrl" value="${escapeAttr(footer.lineUrl || "")}" placeholder="https://line.me/xxxx"></div>
      <div class="row"><label>LINE QRラベル</label><input type="text" id="estimatePdfFooterLineQrLabel" value="${escapeAttr(footer.lineQrLabel || "LINEで相談")}" placeholder="例：LINEで相談"></div>
      <div class="row"><label>フッターメッセージ</label><textarea id="estimatePdfFooterMessage" rows="2">${escapeHtml(footer.message || "")}</textarea></div>
      <div id="estimatePdfFooterQrPreview" class="estimate-qr-preview" style="margin-top:12px;"></div>
    `;
  }

  function renderQrPreviewItem(dataUrl, label, displaySize){
    if(!dataUrl){
      return "";
    }
    return (
      "<div style=\"flex:1 1 0;min-width:0;max-width:160px;text-align:center;padding:12px;border:1px solid #ddd;border-radius:8px;background:#fafafa;\">" +
      "<img src=\"" + escapeAttr(dataUrl) + "\" alt=\"QRコードプレビュー\" width=\"" + displaySize + "\" height=\"" + displaySize + "\" style=\"display:block;margin:0 auto 8px;\">" +
      (label ? "<div style=\"font-size:13px;color:#444;line-height:1.35;\">" + escapeHtml(label) + "</div>" : "") +
      "</div>"
    );
  }

  async function updatePdfFooterQrPreview(){
    const preview = document.getElementById("estimatePdfFooterQrPreview");
    if(!preview) return;

    const homepageUrl = document.getElementById("estimatePdfFooterHomepageUrl")?.value.trim() || "";
    const lineUrl = document.getElementById("estimatePdfFooterLineUrl")?.value.trim() || "";
    const homepageLabel = document.getElementById("estimatePdfFooterHomepageQrLabel")?.value.trim() || "ホームページはこちら";
    const lineLabel = document.getElementById("estimatePdfFooterLineQrLabel")?.value.trim() || "LINEで相談";
    const displaySize = 56;

    if(!homepageUrl && !lineUrl){
      preview.innerHTML = "<p class=\"note\">ホームページURLまたはLINE URLを入力するとQRプレビューが表示されます。</p>";
      return;
    }
    if(!window.EstimateQr){
      preview.innerHTML = "<p class=\"note\">QRコードライブラリを読み込めません。</p>";
      return;
    }

    const [homepageQr, lineQr] = await Promise.all([
      homepageUrl ? window.EstimateQr.toDataUrl(homepageUrl, displaySize * 2) : "",
      lineUrl ? window.EstimateQr.toDataUrl(lineUrl, displaySize * 2) : ""
    ]);

    const items = [];
    if(homepageUrl){
      items.push(
        homepageQr
          ? renderQrPreviewItem(homepageQr, homepageLabel, displaySize)
          : "<div style=\"flex:1 1 0;min-width:0;max-width:160px;padding:12px;border:1px solid #f0d0d0;border-radius:8px;background:#fff5f5;color:#a33;font-size:13px;\">ホームページQRを生成できませんでした。</div>"
      );
    }
    if(lineUrl){
      items.push(
        lineQr
          ? renderQrPreviewItem(lineQr, lineLabel, displaySize)
          : "<div style=\"flex:1 1 0;min-width:0;max-width:160px;padding:12px;border:1px solid #f0d0d0;border-radius:8px;background:#fff5f5;color:#a33;font-size:13px;\">LINE QRを生成できませんでした。</div>"
      );
    }

    preview.innerHTML =
      "<div style=\"display:flex;justify-content:" + (items.length === 2 ? "space-around" : "center") + ";align-items:flex-start;gap:20px;max-width:360px;\">" +
      items.join("") +
      "</div>";
  }

  const FARE_MODE_DESCRIPTIONS = {
    distance: "出発地・目的地間の距離を基に算出します",
    time: "予定所要時間を基に算出します",
    distance_time: "距離運賃に加え、ルート予定時間に基づく概算加算を行います（認可メーターの低速走行加算とは異なります）",
    pre_fixed_fare: "認可距離制運賃に交通圏平準化係数を適用します。介助料・待機料・実費には係数を適用しません"
  };

  function findTimeBlockComponent(components, key){
    const list = Array.isArray(components) ? components : [];
    return list.find(function(component){
      return component && component.calculator === "time_block" && (!key || component.key === key);
    }) || null;
  }

  function getTimeBlockParamsFromDraft(draft, mode, componentKey){
    const components = draft?.fareComponents?.[mode] || [];
    const component = findTimeBlockComponent(components, componentKey);
    const params = component?.params || {};
    return {
      baseMinutes: params.baseMinutes ?? 0,
      baseAmount: params.baseAmount ?? 0,
      perBlockMinutes: params.perBlockMinutes ?? 0,
      perBlockAmount: params.perBlockAmount ?? 0
    };
  }

  function renderTimeBlockFields(idPrefix, params){
    return `
      <div class="grid2">
        <div class="row"><label>初回時間（分）</label><input type="number" min="0" step="1" id="${idPrefix}BaseMinutes" value="${escapeAttr(params.baseMinutes ?? 0)}"></div>
        <div class="row"><label>初回運賃（円）</label><input type="number" min="0" step="1" id="${idPrefix}BaseAmount" value="${escapeAttr(params.baseAmount ?? 0)}"></div>
        <div class="row"><label>超過時間（分）</label><input type="number" min="0" step="1" id="${idPrefix}PerBlockMinutes" value="${escapeAttr(params.perBlockMinutes ?? 0)}"></div>
        <div class="row"><label>超過運賃（円）</label><input type="number" min="0" step="1" id="${idPrefix}PerBlockAmount" value="${escapeAttr(params.perBlockAmount ?? 0)}"></div>
      </div>
    `;
  }

  function renderDistancePatternAFields(){
    const patternA = estimateDraft.distancePricing?.patternA || {};
    return `
      <div class="grid2">
        <div class="row"><label>初乗距離（km）</label><input type="number" min="0" step="0.001" id="estimateInitialDistanceKm" value="${escapeAttr(patternA.initialDistanceKm ?? 0)}"></div>
        <div class="row"><label>初乗運賃（円）</label><input type="number" min="0" step="1" id="estimateInitialFare" value="${escapeAttr(patternA.initialFare ?? 0)}"></div>
        <div class="row"><label>加算距離（km）</label><input type="number" min="0" step="0.001" id="estimateIncrementDistanceKm" value="${escapeAttr(patternA.incrementDistanceKm ?? 0)}"></div>
        <div class="row"><label>加算運賃（円）</label><input type="number" min="0" step="1" id="estimateIncrementFare" value="${escapeAttr(patternA.incrementFare ?? 0)}"></div>
      </div>
    `;
  }

  function renderPreFixedFareSettings(){
    const zones = Array.isArray(estimateDraft.trafficZones?.items)
      ? estimateDraft.trafficZones.items.slice().sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      : [];
    const selectedId = String(estimateDraft.preFixedFare?.trafficZoneId || "");
    const options = zones.map(function(zone){
      const id = String(zone.id || "");
      return `<option value="${escapeAttr(id)}" ${id === selectedId ? "selected" : ""}>${escapeHtml(zone.label || id)}</option>`;
    }).join("");
    return `
      <h3>事前確定運賃</h3>
      <p class="note">出発地住所から交通圏を自動判定します。判定できない場合は、ここで選択した既定交通圏を適用します。</p>
      <div class="row">
        <label for="estimatePreFixedTrafficZoneId">適用交通圏</label>
        <select id="estimatePreFixedTrafficZoneId">
          <option value="">未設定</option>
          ${options}
        </select>
      </div>
    `;
  }

  function renderTrafficZoneItems(){
    const items = Array.isArray(estimateDraft.trafficZones?.items)
      ? estimateDraft.trafficZones.items.slice().sort(function(a, b){ return (a.order || 0) - (b.order || 0); })
      : [];
    if(!items.length){
      return `<p class="note">交通圏係数が設定されていません。</p>`;
    }
    const rows = items.map(function(zone, index){
      const municipalities = Array.isArray(zone.municipalities)
        ? zone.municipalities.join("\n")
        : String(zone.municipalities || "");
      return `
        <tr>
          <td><input type="text" data-traffic-zone-field="id" data-traffic-zone-index="${index}" value="${escapeAttr(zone.id || "")}" readonly></td>
          <td><input type="text" data-traffic-zone-field="label" data-traffic-zone-index="${index}" value="${escapeAttr(zone.label || "")}"></td>
          <td><input type="number" min="0" step="0.01" data-traffic-zone-field="coefficient" data-traffic-zone-index="${index}" value="${escapeAttr(zone.coefficient ?? 0)}"></td>
          <td><textarea rows="3" data-traffic-zone-field="municipalities" data-traffic-zone-index="${index}" placeholder="1行に1市区町村">${escapeHtml(municipalities)}</textarea></td>
          <td><input type="number" min="0" step="1" data-traffic-zone-field="order" data-traffic-zone-index="${index}" value="${escapeAttr(zone.order ?? (index + 1))}"></td>
        </tr>
      `;
    }).join("");
    return `
      <div class="estimate-traffic-zones-table-wrap">
        <table class="estimate-traffic-zones-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>交通圏名</th>
              <th>係数</th>
              <th>対象市区町村</th>
              <th>並び順</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function collectTimeBlockParams(idPrefix){
    return {
      baseMinutes: Number(document.getElementById(idPrefix + "BaseMinutes")?.value) || 0,
      baseAmount: Number(document.getElementById(idPrefix + "BaseAmount")?.value) || 0,
      perBlockMinutes: Number(document.getElementById(idPrefix + "PerBlockMinutes")?.value) || 0,
      perBlockAmount: Number(document.getElementById(idPrefix + "PerBlockAmount")?.value) || 0
    };
  }

  function applyTimeBlockParams(components, componentKey, params){
    if(!Array.isArray(components)) return;
    const component = components.find(function(item){
      return item && item.key === componentKey;
    });
    if(component){
      component.params = Object.assign({}, component.params || {}, params);
    }
  }

  function ensureFareComponents(draft){
    const defaults = window.EstimateDefaults?.createDefaultEstimateConfig?.()?.fareComponents || {};
    draft.fareComponents = draft.fareComponents || {};
    ["time", "distance", "distance_time", "pre_fixed_fare"].forEach(function(mode){
      if(!Array.isArray(draft.fareComponents[mode]) || !draft.fareComponents[mode].length){
        draft.fareComponents[mode] = deepClone(defaults[mode] || []);
      }
    });
    return draft;
  }

  function renderMobilityAssistanceEditor(){
    const root = document.getElementById("estimateMappingsEditor");
    if(!root || !estimateDraft) return;
    const mobilityItems = estimateDraft.categories?.mobility?.items || [];
    const assistanceItems = estimateDraft.categories?.assistance?.items || [];
    const rules = estimateDraft.mappings?.mobilityAssistance || {};

    root.innerHTML = mobilityItems.map(function(mobility){
      const rule = rules[mobility.id] || { mode: "select", assistanceIds: [], assistanceId: "" };
      const modeOptions = ["select", "required", "fixed"].map(function(mode){
        const selected = rule.mode === mode ? " selected" : "";
        return `<option value="${mode}"${selected}>${mode}</option>`;
      }).join("");
      const assistOptions = assistanceItems.map(function(assist){
        const selected = (rule.assistanceIds || []).includes(assist.id) ? " selected" : "";
        return `<option value="${escapeAttr(assist.id)}"${selected}>${escapeHtml(assist.label || assist.id)}</option>`;
      }).join("");
      const fixedOptions = assistanceItems.map(function(assist){
        const selected = rule.assistanceId === assist.id ? " selected" : "";
        return `<option value="${escapeAttr(assist.id)}"${selected}>${escapeHtml(assist.label || assist.id)}</option>`;
      }).join("");
      return `
        <div class="estimate-admin-item">
          <strong>${escapeHtml(mobility.label || mobility.id)}</strong>
          <div class="grid2">
            <div class="row"><label>選択方式</label><select data-mobility-rule-mode="${escapeAttr(mobility.id)}">${modeOptions}</select></div>
            <div class="row"><label>固定介助（fixed時）</label><select data-mobility-rule-fixed="${escapeAttr(mobility.id)}">${fixedOptions}</select></div>
          </div>
          <div class="row"><label>選択肢（select/required時・Ctrlで複数選択）</label><select multiple size="4" data-mobility-rule-ids="${escapeAttr(mobility.id)}">${assistOptions}</select></div>
        </div>
      `;
    }).join("");
  }

  function renderEditor(){
    const root = document.getElementById("estimateSettingsEditor");
    if(!root || !estimateDraft) return;

    const fareMode = String(estimateDraft.fareMode || "time");
    const timeParams = getTimeBlockParamsFromDraft(estimateDraft, "time", "timeBaseFare");
    const distanceTimeParams = getTimeBlockParamsFromDraft(estimateDraft, "distance_time", "timeAdjustment");
    const fareModeDescription = FARE_MODE_DESCRIPTIONS[fareMode] || FARE_MODE_DESCRIPTIONS.time;

    root.innerHTML = `
      <div class="row"><label><input type="checkbox" id="estimateEnabledToggle" ${estimateDraft.enabled !== false ? "checked" : ""}> 概算見積ページを公開する</label></div>

      <h3>ページ設定</h3>
      <div class="row"><label>タイトル</label><input type="text" id="estimatePageTitle" value="${escapeAttr(estimateDraft.page?.title || "")}"></div>
      <div class="row"><label>説明文</label><textarea id="estimatePageDescription" rows="3">${escapeHtml(estimateDraft.page?.description || "")}</textarea></div>
      <div class="row"><label>距離入力ラベル</label><input type="text" id="estimateDistanceLabel" value="${escapeAttr(estimateDraft.page?.distanceLabel || "片道距離（km）")}"></div>
      <div class="row"><label>距離入力補足文</label><textarea id="estimateDistanceNote" rows="2">${escapeHtml(estimateDraft.page?.distanceNote || "")}</textarea></div>

      <h3>Google Maps（住所から距離計算）</h3>
      <div class="row"><label><input type="checkbox" id="estimateGoogleMapsEnabled" ${estimateDraft.googleMaps?.enabled !== false ? "checked" : ""}> 住所からの距離計算を有効にする</label></div>
      <div class="row"><label>APIキー</label><input type="text" id="estimateGoogleMapsApiKey" value="${escapeAttr(estimateDraft.googleMaps?.apiKey || "")}" autocomplete="off" placeholder="Google Maps Platform APIキー（Routes API）"></div>
      <div class="grid2">
        <div class="row"><label>言語コード</label><input type="text" id="estimateGoogleMapsLanguage" value="${escapeAttr(estimateDraft.googleMaps?.language || "ja")}"></div>
        <div class="row"><label>リージョン</label><input type="text" id="estimateGoogleMapsRegion" value="${escapeAttr(estimateDraft.googleMaps?.region || "JP")}"></div>
      </div>
      <p class="note">APIキーは HTTP リファラー制限（GitHub Pages ドメイン）と Routes API のみ有効化を推奨します。</p>

      <h3>基本料金</h3>
      ${renderFeeEditor("基本運賃", estimateDraft.basicFees?.baseFare, "basicFees.baseFare")}
      ${renderFeeEditor("迎車料金", estimateDraft.basicFees?.pickupFee, "basicFees.pickupFee")}
      ${renderFeeEditor("特殊車両使用料", estimateDraft.basicFees?.specialVehicleFee, "basicFees.specialVehicleFee", {
        enabledLabel: "有効",
        note: "特殊車両（リフト車・スロープ車・車いす固定装置搭載車等）の維持管理費として加算する料金です。"
      })}

      <h3>交通圏係数</h3>
      <p class="note">運輸局公示の平準化係数です。事前確定運賃モードの距離運賃にのみ適用されます。</p>
      ${renderTrafficZoneItems()}
      ${renderPreFixedFareSettings()}

      <h3>運賃方式</h3>
      <div class="row">
        <label for="estimateFareMode">運賃方式</label>
        <select id="estimateFareMode">
          <option value="distance" ${fareMode === "distance" ? "selected" : ""}>距離定額</option>
          <option value="time" ${fareMode === "time" ? "selected" : ""}>時間定額</option>
          <option value="distance_time" ${fareMode === "distance_time" ? "selected" : ""}>距離＋予定時間加算（概算）</option>
          <option value="pre_fixed_fare" ${fareMode === "pre_fixed_fare" ? "selected" : ""}>事前確定運賃</option>
        </select>
      </div>
      <p class="note" id="estimateFareModeDescription">${escapeHtml(fareModeDescription)}</p>

      <div id="estimateFareDistancePanel">
        <h4 id="estimateFareDistanceHeading">${fareMode === "distance_time" || fareMode === "pre_fixed_fare" ? "距離部分" : "距離定額設定"}</h4>
        ${renderDistancePatternAFields()}
      </div>

      <div id="estimateFareModeTimeSection">
        <h4>時間定額設定</h4>
        ${renderTimeBlockFields("estimateTime", timeParams)}
      </div>

      <div id="estimateFareDtTimeSection">
        <h4>予定時間加算（概算）</h4>
        <p class="note">ルート予定時間に基づく概算加算です。実走行時の認可メーター（低速走行時 1分20秒/100円）とは別の計算です。</p>
        ${renderTimeBlockFields("estimateDtTime", distanceTimeParams)}
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

      <h3>送迎方法（片道・往復）</h3>
      <p class="note">「送迎方法の選択肢に表示」にチェックした項目のみ利用者画面に表示されます。</p>
      <div id="estimateTripItems">${renderCategoryItems("tripType")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="tripType">送迎方法を追加</button>

      <h3>往復時の待機・付き添い</h3>
      <div id="estimateRoundTripAddonItems">${renderCategoryItems("roundTripAddon")}</div>
      <button type="button" class="secondary" data-action="add-item" data-category="roundTripAddon">待機・付き添い項目を追加</button>

      <h3>移動方法 → 介助内容の選択ルール</h3>
      <div id="estimateMappingsEditor"></div>

      <h3>注意事項</h3>
      <div class="row"><label>概算見積ページに表示する注意事項</label><textarea id="estimatePageDisclaimer" rows="5">${escapeHtml(estimateDraft.page?.disclaimer || "")}</textarea></div>

      ${renderPdfFooterEditor()}
    `;

    renderMobilityAssistanceEditor();
    toggleFareModeFields();
    updatePdfFooterQrPreview();
  }

  function updateFareModeDescription(mode){
    const description = document.getElementById("estimateFareModeDescription");
    if(description){
      description.textContent = FARE_MODE_DESCRIPTIONS[mode] || FARE_MODE_DESCRIPTIONS.time;
    }
    const distanceHeading = document.querySelector("#estimateFareDistanceHeading");
    if(distanceHeading){
      distanceHeading.textContent = mode === "distance_time" || mode === "pre_fixed_fare" ? "距離部分" : "距離定額設定";
    }
  }

  function toggleFareModeFields(){
    const mode = document.getElementById("estimateFareMode")?.value || "time";
    const distancePanel = document.getElementById("estimateFareDistancePanel");
    const timeSection = document.getElementById("estimateFareModeTimeSection");
    const distanceTimeSection = document.getElementById("estimateFareDtTimeSection");
    if(distancePanel) distancePanel.style.display = (mode === "distance" || mode === "distance_time" || mode === "pre_fixed_fare") ? "block" : "none";
    if(timeSection) timeSection.style.display = mode === "time" ? "block" : "none";
    if(distanceTimeSection) distanceTimeSection.style.display = (mode === "distance_time" || mode === "pre_fixed_fare") ? "block" : "none";
    updateFareModeDescription(mode);
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
      disclaimer: document.getElementById("estimatePageDisclaimer")?.value || "",
      resultNotes: estimateDraft.page?.resultNotes || "",
      preFixedFareNotice: estimateDraft.page?.preFixedFareNotice || "",
      distanceLabel: document.getElementById("estimateDistanceLabel")?.value.trim() || "片道距離（km）",
      distanceNote: document.getElementById("estimateDistanceNote")?.value || "",
      tollRoadNote: estimateDraft.page?.tollRoadNote || ""
    };

    draft.pdfFooter = {
      enabled: document.getElementById("estimatePdfFooterEnabled")?.checked !== false,
      businessName: document.getElementById("estimatePdfFooterBusinessName")?.value.trim() || "",
      phone: document.getElementById("estimatePdfFooterPhone")?.value.trim() || "",
      homepageUrl: document.getElementById("estimatePdfFooterHomepageUrl")?.value.trim() || "",
      homepageQrLabel: document.getElementById("estimatePdfFooterHomepageQrLabel")?.value.trim() || "ホームページはこちら",
      lineUrl: document.getElementById("estimatePdfFooterLineUrl")?.value.trim() || "",
      lineQrLabel: document.getElementById("estimatePdfFooterLineQrLabel")?.value.trim() || "LINEで相談",
      message: document.getElementById("estimatePdfFooterMessage")?.value.trim() || ""
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
    draft.distancePricing.mode = estimateDraft.distancePricing?.mode || "patternA";
    draft.distancePricing.patternA = {
      initialDistanceKm: Number(document.getElementById("estimateInitialDistanceKm")?.value) || 0,
      initialFare: Number(document.getElementById("estimateInitialFare")?.value) || 0,
      incrementDistanceKm: Number(document.getElementById("estimateIncrementDistanceKm")?.value) || 0,
      incrementFare: Number(document.getElementById("estimateIncrementFare")?.value) || 0
    };
    draft.distancePricing.patternB = deepClone(estimateDraft.distancePricing?.patternB || { perKmRate: 0 });

    const selectedFareMode = document.getElementById("estimateFareMode")?.value || "time";
    draft.fareMode = ["time", "distance", "distance_time", "pre_fixed_fare"].includes(selectedFareMode) ? selectedFareMode : "time";

    ensureFareComponents(draft);
    applyTimeBlockParams(draft.fareComponents.time, "timeBaseFare", collectTimeBlockParams("estimateTime"));
    applyTimeBlockParams(draft.fareComponents.distance_time, "timeAdjustment", collectTimeBlockParams("estimateDtTime"));
    applyTimeBlockParams(draft.fareComponents.pre_fixed_fare, "timeAdjustment", collectTimeBlockParams("estimateDtTime"));

    draft.preFixedFare = draft.preFixedFare || {};
    draft.preFixedFare.trafficZoneId = String(
      document.getElementById("estimatePreFixedTrafficZoneId")?.value || ""
    ).trim();

    draft.googleMaps = {
      enabled: document.getElementById("estimateGoogleMapsEnabled")?.checked !== false,
      apiKey: (function(){
        const fromInput = document.getElementById("estimateGoogleMapsApiKey")?.value.trim() || "";
        const existing = String(estimateDraft?.googleMaps?.apiKey || "").trim();
        return fromInput || existing;
      })(),
      language: document.getElementById("estimateGoogleMapsLanguage")?.value.trim() || "ja",
      region: document.getElementById("estimateGoogleMapsRegion")?.value.trim() || "JP"
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
    delete draft.options.bodyAssist;

    draft.mappings = draft.mappings || {};
    draft.mappings.mobilityAssistance = draft.mappings.mobilityAssistance || {};
    document.querySelectorAll("[data-mobility-rule-mode]").forEach(function(el){
      const mobilityId = el.getAttribute("data-mobility-rule-mode");
      if(!mobilityId) return;
      if(!draft.mappings.mobilityAssistance[mobilityId]){
        draft.mappings.mobilityAssistance[mobilityId] = { mode: "select", assistanceIds: [], assistanceId: "" };
      }
      draft.mappings.mobilityAssistance[mobilityId].mode = el.value || "select";
    });
    document.querySelectorAll("[data-mobility-rule-fixed]").forEach(function(el){
      const mobilityId = el.getAttribute("data-mobility-rule-fixed");
      if(!mobilityId) return;
      if(!draft.mappings.mobilityAssistance[mobilityId]){
        draft.mappings.mobilityAssistance[mobilityId] = { mode: "fixed", assistanceIds: [], assistanceId: "" };
      }
      draft.mappings.mobilityAssistance[mobilityId].assistanceId = el.value || "";
    });
    document.querySelectorAll("[data-mobility-rule-ids]").forEach(function(el){
      const mobilityId = el.getAttribute("data-mobility-rule-ids");
      if(!mobilityId) return;
      if(!draft.mappings.mobilityAssistance[mobilityId]){
        draft.mappings.mobilityAssistance[mobilityId] = { mode: "select", assistanceIds: [], assistanceId: "" };
      }
      draft.mappings.mobilityAssistance[mobilityId].assistanceIds = Array.from(el.selectedOptions || []).map(function(opt){
        return opt.value;
      });
    });
    delete draft.mappings.mobilityToAssistance;

    if(Array.isArray(draft.categories?.tripType?.items)){
      draft.categories.tripType.items.forEach(function(item){
        if(!(Number(item.distanceMultiplier) > 0)){
          item.distanceMultiplier = 1;
        }
        item.waitingFeeRef = String(item.waitingFeeRef || "").trim();
        item.escortFeeRef = String(item.escortFeeRef || "").trim();
      });
    }
    if(Array.isArray(draft.categories?.roundTripAddon?.items)){
      draft.categories.roundTripAddon.items.forEach(function(item){
        item.waitingFeeRef = String(item.waitingFeeRef || "").trim();
        item.escortFeeRef = String(item.escortFeeRef || "").trim();
      });
    }

    draft.trafficZones = draft.trafficZones || { items: [] };
    if(!Array.isArray(draft.trafficZones.items)){
      draft.trafficZones.items = [];
    }
    document.querySelectorAll("[data-traffic-zone-field]").forEach(function(el){
      const index = Number(el.getAttribute("data-traffic-zone-index"));
      const field = el.getAttribute("data-traffic-zone-field");
      if(Number.isNaN(index) || !field || !draft.trafficZones.items[index]) return;
      if(el.type === "number"){
        draft.trafficZones.items[index][field] = Number(el.value);
      }else if(field === "municipalities"){
        draft.trafficZones.items[index][field] = String(el.value || "")
          .split(/[\n,、，]/)
          .map(function(item){ return String(item || "").trim(); })
          .filter(Boolean);
      }else{
        draft.trafficZones.items[index][field] = el.value;
      }
    });

    draft.version = typeof draft.version === "number" ? draft.version : 1;
    draft.updatedAt = new Date().toISOString();
    return draft;
  }

  function ensurePdfFooter(draft){
    const defaults = window.EstimateDefaults?.createDefaultEstimateConfig?.()?.pdfFooter || {
      enabled: true,
      businessName: "",
      phone: "",
      homepageUrl: "",
      homepageQrLabel: "ホームページはこちら",
      lineUrl: "",
      lineQrLabel: "LINEで相談",
      message: "ご予約・ご相談はお気軽にお問い合わせください"
    };
    draft.pdfFooter = Object.assign({}, defaults, draft.pdfFooter || {});

    if(!draft.pdfFooter.homepageUrl && draft.pdfFooter.qrCodeUrl){
      draft.pdfFooter.homepageUrl = String(draft.pdfFooter.qrCodeUrl || "");
    }
    if(!draft.pdfFooter.homepageQrLabel && draft.pdfFooter.qrCodeLabel){
      draft.pdfFooter.homepageQrLabel = String(draft.pdfFooter.qrCodeLabel || "");
    }
    delete draft.pdfFooter.qrCodeUrl;
    delete draft.pdfFooter.qrCodeLabel;

    if(typeof draft.pdfFooter.enabled !== "boolean"){
      draft.pdfFooter.enabled = true;
    }
    draft.pdfFooter.businessName = String(draft.pdfFooter.businessName || "");
    draft.pdfFooter.phone = String(draft.pdfFooter.phone || "");
    draft.pdfFooter.homepageUrl = String(draft.pdfFooter.homepageUrl || "");
    draft.pdfFooter.homepageQrLabel = String(draft.pdfFooter.homepageQrLabel || defaults.homepageQrLabel || "");
    draft.pdfFooter.lineUrl = String(draft.pdfFooter.lineUrl || "");
    draft.pdfFooter.lineQrLabel = String(draft.pdfFooter.lineQrLabel || defaults.lineQrLabel || "");
    draft.pdfFooter.message = String(draft.pdfFooter.message || defaults.message || "");
    return draft;
  }

  function ensureTrafficZones(draft){
    const defaults = window.EstimateDefaults?.createDefaultTrafficZones?.()
      || window.EstimateDefaults?.createDefaultEstimateConfig?.()?.trafficZones
      || { items: [] };
    const defaultItems = Array.isArray(defaults.items) ? defaults.items : [];
    const currentItems = Array.isArray(draft.trafficZones?.items) ? draft.trafficZones.items : [];
    const map = {};
    currentItems.forEach(function(item){
      if(item?.id) map[item.id] = item;
    });
    draft.trafficZones = {
      items: defaultItems.map(function(item){
        return Object.assign({}, item, map[item.id] || {});
      })
    };
    draft.trafficZones.items.forEach(function(item, index){
      item.id = String(item.id || "zone-" + index);
      item.label = String(item.label || item.id);
      item.coefficient = Number(item.coefficient) || 0;
      item.order = Number(item.order) || (index + 1);
      if(!Array.isArray(item.municipalities)){
        item.municipalities = String(item.municipalities || "")
          .split(/[\n,、，]/)
          .map(function(name){ return String(name || "").trim(); })
          .filter(Boolean);
      }
    });
    return draft;
  }

  function normalizeEstimateConfig(data){
    const draft = deepClone(data || {});
    const defaults = window.EstimateDefaults?.createDefaultEstimateConfig?.() || {};
    if(typeof draft.enabled !== "boolean") draft.enabled = true;
    if(typeof draft.version !== "number") draft.version = 1;
    if(draft.page && typeof draft.page.resultNotes !== "string"){
      draft.page.resultNotes = "";
    }
    if(Array.isArray(defaults.fareModeOptions)){
      draft.fareModeOptions = Array.isArray(draft.fareModeOptions) ? draft.fareModeOptions : deepClone(defaults.fareModeOptions);
    }
    if(defaults.fareComponents){
      draft.fareComponents = Object.assign({}, deepClone(defaults.fareComponents), draft.fareComponents || {});
    }
    if(!["time", "distance", "distance_time", "pre_fixed_fare"].includes(String(draft.fareMode || ""))){
      draft.fareMode = String(defaults.fareMode || "time");
    }
    ensureTrafficZones(draft);
    if(defaults.preFixedFare){
      draft.preFixedFare = Object.assign({}, defaults.preFixedFare, draft.preFixedFare || {});
    }
    if(defaults.basicFees){
      draft.basicFees = Object.assign({}, defaults.basicFees, draft.basicFees || {});
      Object.keys(defaults.basicFees).forEach(function(key){
        draft.basicFees[key] = Object.assign({}, defaults.basicFees[key], draft.basicFees[key] || {});
      });
    }
    return ensurePdfFooter(draft);
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
    if(categoryKey === "tripType" || categoryKey === "roundTripAddon"){
      newItem.distanceMultiplier = categoryKey === "tripType" ? 1 : undefined;
      newItem.waitingFeeRef = "";
      newItem.escortFeeRef = "";
      if(categoryKey === "tripType"){
        newItem.showInSelector = true;
      }
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
    if(event.target && event.target.id === "estimateFareMode"){
      toggleFareModeFields();
    }
    if(
      event.target &&
      (
        event.target.id === "estimatePdfFooterHomepageUrl" ||
        event.target.id === "estimatePdfFooterHomepageQrLabel" ||
        event.target.id === "estimatePdfFooterLineUrl" ||
        event.target.id === "estimatePdfFooterLineQrLabel"
      )
    ){
      updatePdfFooterQrPreview();
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
