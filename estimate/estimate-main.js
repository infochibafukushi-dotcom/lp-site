(function(){
  const state = {
    config: null,
    ctaUrls: {},
    mobilityId: "",
    assistanceId: "",
    stairId: "",
    tripTypeId: "",
    roundTripAddonId: "",
    distanceKm: 0,
    distanceInputText: "",
    distanceInputMode: "address",
    roadType: "general",
    originAddress: "",
    destinationAddress: "",
    routeCalcResult: null,
    routePlan: null,
    routeCalcError: "",
    routeCalcLoading: false,
    estimateNumber: "",
    estimateCreatedAt: "",
    selectionFingerprint: "",
    lastActiveStepId: ""
  };

  let delegatedBound = false;

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

  function parseDistanceValue(raw){
    const text = String(raw ?? "").trim().replace(/，/g, ".");
    if(!text) return null;
    if(!/^\d+(\.\d+)?$/.test(text)) return null;
    const n = Number(text);
    if(!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function getDistanceInputDisplayValue(){
    if(state.distanceInputText !== ""){
      return state.distanceInputText;
    }
    if(state.distanceKm > 0){
      return String(state.distanceKm);
    }
    return "";
  }

  function commitDistanceInput(){
    const parsed = parseDistanceValue(state.distanceInputText);
    if(parsed !== null){
      state.distanceKm = parsed;
      state.distanceInputText = String(parsed);
      invalidateEstimateNumberIfChanged();
      state.lastActiveStepId = "";
      renderPage();
      return;
    }
    state.distanceKm = 0;
    invalidateEstimateNumberIfChanged();
    if(document.querySelector(".estimate-result")){
      state.lastActiveStepId = "";
      renderPage();
    }
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
      state.assistanceId,
      state.stairId,
      state.tripTypeId,
      state.roundTripAddonId,
      String(state.distanceKm),
      state.roadType,
      String(state.routePlan?.selectedRouteId || "")
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

  function syncAssistanceForMobility(){
    if(!state.mobilityId) return;
    const options = window.EstimateCalc.getAssistanceOptions(state.config, state.mobilityId);
    const rule = window.EstimateCalc.getMobilityAssistanceRule(state.config, state.mobilityId);

    if(rule?.mode === "fixed"){
      state.assistanceId = rule.assistanceId || (options[0]?.id || "");
      return;
    }

    if(state.assistanceId && !options.some(function(item){ return item.id === state.assistanceId; })){
      state.assistanceId = "";
    }
  }

  function syncRoundTripAddon(){
    if(!window.EstimateCalc.isRoundTripSelected(state.config, state)){
      state.roundTripAddonId = "";
      return;
    }
    const options = window.EstimateCalc.getRoundTripAddonItems(state.config);
    if(state.roundTripAddonId && !options.some(function(item){ return item.id === state.roundTripAddonId; })){
      state.roundTripAddonId = "";
    }
  }

  function getStepFlow(){
    const steps = [
      {
        id: "mobility",
        title: state.config.categories.mobility.label || "移動方法",
        type: "choice",
        categoryKey: "mobility",
        choiceName: "mobilityChoice",
        getItems: function(){ return getVisibleItems("mobility"); },
        getValue: function(){ return state.mobilityId; }
      },
      {
        id: "assistance",
        title: state.config.categories.assistance.label || "介助内容",
        type: "assistance",
        choiceName: "assistanceChoice"
      },
      {
        id: "stair",
        title: state.config.categories.stairAssist.label || "階段介助",
        type: "choice",
        categoryKey: "stairAssist",
        choiceName: "stairChoice",
        getItems: function(){ return getVisibleItems("stairAssist"); },
        getValue: function(){ return state.stairId; }
      },
      {
        id: "trip",
        title: state.config.categories.tripType.label || "送迎方法",
        type: "trip",
        categoryKey: "tripType",
        choiceName: "tripChoice"
      }
    ];

    if(window.EstimateCalc.isRoundTripSelected(state.config, state)){
      steps.push({
        id: "addon",
        title: state.config.categories.roundTripAddon?.label || "待機・付き添い",
        type: "addon",
        choiceName: "addonChoice"
      });
    }

    steps.push({
      id: "distance",
      title: state.config.page?.distanceLabel || "片道距離（km）",
      type: "distance"
    });

    return steps;
  }

  function isStepComplete(stepId){
    switch(stepId){
      case "mobility":
        return Boolean(state.mobilityId);
      case "assistance":
        return Boolean(window.EstimateCalc.resolveAssistanceId(state.config, state));
      case "stair":
        return Boolean(state.stairId);
      case "trip":
        return Boolean(state.tripTypeId);
      case "addon":
        return Boolean(state.roundTripAddonId);
      case "distance":
        return Number(state.distanceKm) > 0;
      default:
        return false;
    }
  }

  function getFlowState(){
    const flow = getStepFlow();
    let activeIndex = flow.findIndex(function(step){
      return !isStepComplete(step.id);
    });
    if(activeIndex < 0){
      activeIndex = flow.length;
    }
    return { flow: flow, activeIndex: activeIndex };
  }

  function getStepSummaryText(step){
    switch(step.id){
      case "mobility": {
        const item = window.EstimateCalc.findItem(state.config.categories?.mobility?.items, state.mobilityId);
        return item?.label || "";
      }
      case "assistance": {
        const id = window.EstimateCalc.resolveAssistanceId(state.config, state);
        const item = window.EstimateCalc.findItem(state.config.categories?.assistance?.items, id);
        return item?.label || "";
      }
      case "stair": {
        const item = window.EstimateCalc.findItem(state.config.categories?.stairAssist?.items, state.stairId);
        return item?.label || "";
      }
      case "trip": {
        const item = window.EstimateCalc.findItem(state.config.categories?.tripType?.items, state.tripTypeId);
        return item?.label || "";
      }
      case "addon": {
        const item = window.EstimateCalc.findItem(
          state.config.categories?.roundTripAddon?.items,
          state.roundTripAddonId
        );
        return item?.label || "";
      }
      case "distance":
        return Number(state.distanceKm) > 0 ? Number(state.distanceKm).toFixed(1) + "km" : "";
      default:
        return "";
    }
  }

  function clearStepsAfter(stepId){
    const order = ["mobility", "assistance", "stair", "trip", "addon", "distance"];
    const idx = order.indexOf(stepId);
    if(idx < 0) return;

    for(let i = idx + 1; i < order.length; i++){
      switch(order[i]){
        case "assistance":
          if(window.EstimateCalc.getMobilityAssistanceRule(state.config, state.mobilityId)?.mode !== "fixed"){
            state.assistanceId = "";
          }else{
            syncAssistanceForMobility();
          }
          break;
        case "stair":
          state.stairId = "";
          break;
        case "trip":
          state.tripTypeId = "";
          break;
        case "addon":
          state.roundTripAddonId = "";
          break;
        case "distance":
          state.distanceKm = 0;
          state.distanceInputText = "";
          state.roadType = "general";
          state.routeCalcResult = null;
          state.routePlan = null;
          state.routeCalcError = "";
          break;
        default:
          break;
      }
    }
    syncRoundTripAddon();
  }

  function clearStepValue(stepId){
    switch(stepId){
      case "mobility":
        state.mobilityId = "";
        state.assistanceId = "";
        break;
      case "assistance": {
        const rule = window.EstimateCalc.getMobilityAssistanceRule(state.config, state.mobilityId);
        if(rule?.mode === "fixed"){
          state.mobilityId = "";
        }
        state.assistanceId = "";
        break;
      }
      case "stair":
        state.stairId = "";
        break;
      case "trip":
        state.tripTypeId = "";
        state.roundTripAddonId = "";
        break;
      case "addon":
        state.roundTripAddonId = "";
        break;
      case "distance":
        state.distanceKm = 0;
        state.distanceInputText = "";
        state.roadType = "general";
        state.routeCalcResult = null;
        state.routePlan = null;
        state.routeCalcError = "";
        break;
      default:
        break;
    }
    syncAssistanceForMobility();
    syncRoundTripAddon();
  }

  function openStepForEdit(stepId){
    clearStepsAfter(stepId);
    clearStepValue(stepId);
    if(stepId === "distance"){
      state.routeCalcLoading = false;
    }
    state.estimateNumber = "";
    state.estimateCreatedAt = "";
    state.selectionFingerprint = "";
    state.lastActiveStepId = "";
    renderPage();
    requestAnimationFrame(function(){
      const el = document.querySelector('[data-step-id="' + stepId + '"]');
      if(el){
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  }

  function resetAll(){
    state.mobilityId = "";
    state.assistanceId = "";
    state.stairId = "";
    state.tripTypeId = "";
    state.roundTripAddonId = "";
    state.distanceKm = 0;
    state.distanceInputText = "";
    state.distanceInputMode = "address";
    state.roadType = "general";
    state.originAddress = "";
    state.destinationAddress = "";
    state.routeCalcResult = null;
    state.routePlan = null;
    state.routeCalcError = "";
    state.routeCalcLoading = false;
    state.estimateNumber = "";
    state.estimateCreatedAt = "";
    state.selectionFingerprint = "";
    state.lastActiveStepId = "";
    if(window.EstimateUrl?.clearUrlState){
      window.EstimateUrl.clearUrlState();
    }
    if(window.EstimateHandoff?.clearHandoffRecord){
      window.EstimateHandoff.clearHandoffRecord();
    }
    renderPage();
    requestAnimationFrame(function(){
      const el = document.querySelector('[data-step-id="mobility"]');
      if(el){
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  }

  function getFareSections(result){
    const labels = state.config.resultLabels || {};
    const snapshot = result.quoteSnapshot || {};
    const fixedFareRows = Array.isArray(snapshot.fixedFareBreakdown)
      ? snapshot.fixedFareBreakdown.map(function(row){
        return {
          label: row.label || row.key || "",
          amount: Number(row.amount) || 0
        };
      }).filter(function(row){ return row.amount > 0; })
      : [];
    const careServiceRows = Array.isArray(snapshot.serviceFees)
      ? snapshot.serviceFees.map(function(row){
        return {
          label: row.label || row.key || "",
          amount: Number(row.amount) || 0
        };
      }).filter(function(row){ return row.amount > 0; })
      : [];
    const expenseRows = Array.isArray(snapshot.expenses)
      ? snapshot.expenses.map(function(row){
        return {
          label: row.label || row.key || "",
          note: row.note || ""
        };
      })
      : [];

    return [
      {
        key: "fixedFare",
        title: labels.fixedFareSection || "事前確定運賃",
        rows: fixedFareRows
      },
      {
        key: "careService",
        title: labels.careServiceSection || "介助・サービス料金",
        rows: careServiceRows
      },
      {
        key: "expense",
        title: labels.expenseSection || "実費・別途費用",
        rows: expenseRows
      }
    ];
  }

  function renderTripStep(stepNum, step){
    const title = step.title;
    const tripItems = window.EstimateCalc.getTripTypeItems(state.config);
    const tripChoices = tripItems.map(function(item){
      return window.EstimateHelp.renderChoiceCard(item, {
        name: step.choiceName,
        checked: item.id === state.tripTypeId,
        showAmount: false
      });
    }).join("");

    return `
      <section class="estimate-step estimate-step--active" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="estimate-choice-group">${tripChoices}</div>
      </section>
    `;
  }

  function renderAddonStep(stepNum, step){
    const title = step.title;
    const addonItems = window.EstimateCalc.getRoundTripAddonItems(state.config);
    const addonChoices = addonItems.map(function(item){
      return window.EstimateHelp.renderChoiceCard(item, {
        name: step.choiceName,
        checked: item.id === state.roundTripAddonId,
        showAmount: false
      });
    }).join("");

    return `
      <section class="estimate-step estimate-step--active" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="estimate-choice-group">${addonChoices}</div>
        <p class="estimate-step-note">待機または付き添いのいずれかを選択してください。</p>
      </section>
    `;
  }

  function renderChoiceStep(stepNum, step, items, currentValue){
    const title = step.title;
    const choices = items.map(function(item){
      const showAmount = step.categoryKey !== "tripType" && step.categoryKey !== "roundTripAddon";
      return window.EstimateHelp.renderChoiceCard(item, {
        name: step.choiceName,
        checked: item.id === currentValue,
        showAmount: showAmount
      });
    }).join("");

    return `
      <section class="estimate-step estimate-step--active" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="estimate-choice-group">${choices}</div>
      </section>
    `;
  }

  function renderAssistanceStep(stepNum, step){
    const options = window.EstimateCalc.getAssistanceOptions(state.config, state.mobilityId);
    const rule = window.EstimateCalc.getMobilityAssistanceRule(state.config, state.mobilityId);
    const title = step.title;
    const isFixed = rule?.mode === "fixed";

    const choices = options.map(function(item){
      return window.EstimateHelp.renderChoiceCard(item, {
        name: step.choiceName,
        checked: item.id === state.assistanceId,
        disabled: isFixed,
        showAmount: true
      });
    }).join("");

    const note = isFixed
      ? `<p class="estimate-step-note">この移動方法では介助内容が自動選択されます。</p>`
      : (rule?.mode === "required"
        ? `<p class="estimate-step-note">いずれかを選択してください。</p>`
        : `<p class="estimate-step-note">必要に応じて選択してください。</p>`);

    return `
      <section class="estimate-step estimate-step--active" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="estimate-choice-group">${choices}</div>
        ${note}
      </section>
    `;
  }

  function getGoogleMapsConfig(){
    return state.config?.googleMaps || {};
  }

  function logGoogleMapsConfig(context){
    const mapsConfig = getGoogleMapsConfig();
    const apiKey = String(mapsConfig.apiKey || "").trim();
    console.log("[Estimate] googleMaps config (" + context + ")", {
      enabled: mapsConfig.enabled !== false,
      apiKeySet: Boolean(apiKey),
      apiKeyLength: apiKey.length,
      language: mapsConfig.language || "ja",
      region: mapsConfig.region || "JP"
    });
  }

  function isAddressDistanceMode(){
    return state.distanceInputMode === "address";
  }

  function formatRouteDuration(minutes){
    const n = Number(minutes) || 0;
    return n > 0 ? n + "分" : "";
  }

  function formatRouteDistance(km){
    const n = Number(km) || 0;
    return n > 0 ? n.toFixed(1) + "km" : "";
  }

  function formatRouteDurationSeconds(seconds){
    const sec = Number(seconds) || 0;
    if(sec <= 0){
      return "";
    }
    const minutes = Math.max(1, Math.round(sec / 60));
    return minutes + "分";
  }

  function formatRouteDistanceMeters(meters){
    const value = Number(meters) || 0;
    if(value <= 0){
      return "";
    }
    return (value / 1000).toFixed(1) + "km";
  }

  function decodePolyline(encoded){
    const poly = String(encoded || "");
    if(!poly) return [];
    let index = 0;
    const len = poly.length;
    let lat = 0;
    let lng = 0;
    const points = [];

    while(index < len){
      let b;
      let shift = 0;
      let result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do{
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      }while(b >= 0x20 && index < len);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
  }

  let googleMapsApiPromise = null;

  function loadGoogleMapsJsApi(){
    if(window.google?.maps){
      return Promise.resolve(window.google.maps);
    }
    if(googleMapsApiPromise){
      return googleMapsApiPromise;
    }
    const mapsConfig = getGoogleMapsConfig();
    const apiKey = String(mapsConfig.apiKey || "").trim();
    if(!apiKey){
      return Promise.reject(new Error("Google Maps APIキーが設定されていません。"));
    }

    googleMapsApiPromise = new Promise(function(resolve, reject){
      const callbackName = "__estimateGoogleMapsInit_" + Date.now();
      window[callbackName] = function(){
        try{
          delete window[callbackName];
        }catch(error){}
        resolve(window.google.maps);
      };

      const script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(apiKey) +
        "&language=" + encodeURIComponent(mapsConfig.language || "ja") +
        "&region=" + encodeURIComponent(mapsConfig.region || "JP") +
        "&callback=" + encodeURIComponent(callbackName);
      script.async = true;
      script.defer = true;
      script.onerror = function(){
        try{
          delete window[callbackName];
        }catch(error){}
        reject(new Error("Google Maps JavaScript APIの読み込みに失敗しました。"));
      };
      document.head.appendChild(script);
    });

    return googleMapsApiPromise;
  }

  function getRoutePlanPrimaryRoute(routePlan){
    if(!routePlan) return null;
    if(Array.isArray(routePlan.routes) && routePlan.routes.length){
      const selectedId = String(routePlan.selectedRouteId || "");
      const selected = routePlan.routes.find(function(route){
        return String(route?.routeId || "") === selectedId;
      });
      return selected || routePlan.routes[0];
    }
    return {
      encodedPolyline: String(routePlan.encodedPolyline || ""),
      distanceMeters: Number(routePlan.distanceMeters) || 0,
      durationSeconds: Number(routePlan.durationSeconds) || 0
    };
  }

  function getRoadTypeLabel(roadType){
    return String(roadType || "") === "toll" ? "有料道路利用" : "一般道利用";
  }

  async function renderRouteMapIfNeeded(){
    const mapContainer = document.getElementById("estimateRouteMap");
    if(!mapContainer) return;

    const mapsConfig = getGoogleMapsConfig();
    if(mapsConfig.enabled === false){
      mapContainer.innerHTML = '<p class="estimate-route-map-error">地図表示は現在無効です。</p>';
      return;
    }
    const routePlan = state.routePlan;
    const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
    const encodedPolyline = String(primaryRoute?.encodedPolyline || routePlan?.encodedPolyline || "");
    if(!encodedPolyline){
      mapContainer.innerHTML = '<p class="estimate-route-map-error">ルート情報が取得できないため地図を表示できません。</p>';
      return;
    }

    const path = decodePolyline(encodedPolyline);
    if(path.length < 2){
      mapContainer.innerHTML = '<p class="estimate-route-map-error">ルート情報が不足しているため地図を表示できません。</p>';
      return;
    }

    try{
      await loadGoogleMapsJsApi();
      const map = new window.google.maps.Map(mapContainer, {
        center: path[0],
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      const routeLine = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: "#e87f00",
        strokeOpacity: 0.95,
        strokeWeight: 5
      });
      routeLine.setMap(map);

      const startPoint = path[0];
      const endPoint = path[path.length - 1];
      new window.google.maps.Marker({
        position: startPoint,
        map: map,
        title: "出発地",
        label: "発"
      });
      new window.google.maps.Marker({
        position: endPoint,
        map: map,
        title: "目的地",
        label: "着"
      });

      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(function(point){
        bounds.extend(point);
      });
      map.fitBounds(bounds, 48);
    }catch(error){
      mapContainer.innerHTML = '<p class="estimate-route-map-error">' + escapeHtml(error?.message || "地図表示に失敗しました。") + "</p>";
    }
  }

  async function calculateRouteDistance(){
    const origin = String(state.originAddress || "").trim();
    const destination = String(state.destinationAddress || "").trim();

    if(!origin || !destination){
      state.routeCalcError = "出発地と目的地を入力してください。";
      state.routeCalcResult = null;
      updateRouteCalcFeedback();
      return;
    }

    const mapsConfig = getGoogleMapsConfig();
    const apiKey = String(mapsConfig.apiKey || "").trim();
    if(!apiKey){
      logGoogleMapsConfig("calculateRouteDistance:missing-api-key");
      state.routeCalcError = "Google Maps APIキーが設定されていません。管理画面の「料金シミュレーター設定」で APIキーを入力し、estimate-config.json を保存してください。";
      state.routeCalcResult = null;
      updateRouteCalcFeedback();
      return;
    }

    if(!window.EstimateDistanceApi || typeof window.EstimateDistanceApi.computeRouteDistance !== "function"){
      state.routeCalcError = "距離計算機能が読み込まれていません。";
      updateRouteCalcFeedback();
      return;
    }

    state.routeCalcLoading = true;
    state.routeCalcError = "";
    updateRouteCalcFeedback();

    let shouldRenderPage = false;
    try{
      const result = await window.EstimateDistanceApi.computeRouteDistance({
        apiKey: apiKey,
        origin: origin,
        destination: destination,
        roadType: state.roadType,
        languageCode: mapsConfig.language || "ja",
        region: mapsConfig.region || "JP"
      });
      state.routeCalcResult = {
        distanceKm: result.distanceKm,
        durationMinutes: result.durationMinutes
      };
      const primaryRoute = Array.isArray(result.routes) && result.routes.length ? result.routes[0] : null;
      state.routePlan = {
        provider: "google_routes",
        roadType: state.roadType === "toll" ? "toll" : "general",
        selectedRouteId: String(result.selectedRouteId || "route_0"),
        encodedPolyline: String(primaryRoute?.encodedPolyline || ""),
        routeLabels: Array.isArray(primaryRoute?.routeLabels) ? primaryRoute.routeLabels.slice() : [],
        routeToken: String(primaryRoute?.routeToken || ""),
        distanceMeters: Number(primaryRoute?.distanceMeters) || 0,
        durationSeconds: Number(primaryRoute?.durationSeconds) || 0,
        routes: Array.isArray(result.routes) ? result.routes : [],
        pickup: {
          address: origin,
          latLng: null
        },
        destination: {
          address: destination,
          latLng: null
        }
      };
      state.distanceKm = result.distanceKm;
      state.distanceInputText = String(result.distanceKm);
      state.routeCalcError = "";
      invalidateEstimateNumberIfChanged();
      state.lastActiveStepId = "";
      shouldRenderPage = true;
    }catch(error){
      state.routeCalcResult = null;
      state.routePlan = null;
      state.routeCalcError = error?.message || "距離の計算に失敗しました。";
    }finally{
      state.routeCalcLoading = false;
    }

    if(shouldRenderPage){
      renderPage();
    }else{
      updateRouteCalcFeedback();
    }
  }

  function updateRouteCalcFeedback(){
    const feedback = document.getElementById("routeCalcFeedback");
    const btn = document.getElementById("calculateDistanceBtn");
    if(btn){
      btn.disabled = state.routeCalcLoading;
      btn.textContent = state.routeCalcLoading ? "計算中..." : "距離を計算する";
    }
    if(feedback){
      feedback.textContent = state.routeCalcError || "";
      feedback.className = "estimate-route-feedback" + (state.routeCalcError ? " estimate-route-feedback--error" : "");
    }
  }

  function renderDistanceStep(stepNum, step){
    const label = step.title;
    const note = state.config.page?.distanceNote || "※往復送迎を選択した場合は運賃距離を自動で2倍計算します。";
    const addressMode = isAddressDistanceMode();
    const calcResult = state.routeCalcResult;
    const addressFacilityNote = "住所のほか、病院・施設名でも検索できます。";
    const addressDisclaimer = "住所・施設名検索による距離は\n丁目・番地単位で算出されるため、\n実際の運行距離と異なる場合があります。\n\n概算料金の目安としてご利用ください。";
    const tollRoadNote =
      state.config.page?.tollRoadNote ||
      "通行料金は実費負担となります。";

    const modeRadios = `
      <fieldset class="estimate-distance-mode">
        <legend class="estimate-distance-mode-legend">距離入力方法</legend>
        <label class="estimate-distance-mode-option">
          <input type="radio" name="distanceInputMode" value="address" ${addressMode ? "checked" : ""}>
          <span>住所・施設名から自動計算（推奨）</span>
        </label>
        <label class="estimate-distance-mode-option">
          <input type="radio" name="distanceInputMode" value="manual" ${!addressMode ? "checked" : ""}>
          <span>距離を直接入力</span>
        </label>
      </fieldset>
    `;
    const roadTypeRadios = `
      <fieldset class="estimate-road-type">
        <legend class="estimate-road-type-legend">道路利用設定</legend>
        <label class="estimate-road-type-option">
          <input type="radio" name="roadType" value="general" ${state.roadType !== "toll" ? "checked" : ""}>
          <span>一般道を利用する（推奨）</span>
        </label>
        <label class="estimate-road-type-option">
          <input type="radio" name="roadType" value="toll" ${state.roadType === "toll" ? "checked" : ""}>
          <span>有料道路・高速道路を利用する</span>
        </label>
      </fieldset>
    `;

    const addressPanel = `
      <div class="estimate-address-calc" id="estimateAddressCalcPanel">
        <label for="originAddressInput" class="estimate-distance-label">出発地（住所・施設名）</label>
        <input type="text" class="estimate-input" id="originAddressInput" autocomplete="street-address" placeholder="例: 千葉市中央区○○町1-2-3" value="${escapeAttr(state.originAddress)}">
        <label for="destinationAddressInput" class="estimate-distance-label estimate-distance-label--spaced">目的地（住所・施設名）</label>
        <input type="text" class="estimate-input" id="destinationAddressInput" autocomplete="street-address" placeholder="例: 千葉メディカルセンター" value="${escapeAttr(state.destinationAddress)}">
        <p class="estimate-step-note">${escapeHtml(addressFacilityNote)}</p>
        <button type="button" class="estimate-calc-distance-btn" id="calculateDistanceBtn" ${state.routeCalcLoading ? "disabled" : ""}>${state.routeCalcLoading ? "計算中..." : "距離を計算する"}</button>
        <div class="estimate-route-feedback${state.routeCalcError ? " estimate-route-feedback--error" : ""}" id="routeCalcFeedback" aria-live="polite">${escapeHtml(state.routeCalcError || "")}</div>
        ${calcResult ? `
          <div class="estimate-route-result" aria-live="polite">
            <div class="estimate-route-result-row">
              <span class="estimate-route-result-label">距離</span>
              <span class="estimate-route-result-value">${escapeHtml(formatRouteDistance(calcResult.distanceKm))}</span>
            </div>
            <div class="estimate-route-result-row">
              <span class="estimate-route-result-label">所要時間</span>
              <span class="estimate-route-result-value">${escapeHtml(formatRouteDuration(calcResult.durationMinutes))}</span>
            </div>
          </div>
        ` : ""}
        <p class="estimate-address-disclaimer">${escapeHtml(addressDisclaimer)}</p>
      </div>
    `;

    const manualPanel = `
      <div class="estimate-manual-distance" id="estimateManualDistancePanel">
        <label for="distanceKmInput" class="estimate-distance-label">${escapeHtml(label)}</label>
        <input type="text" class="estimate-input estimate-input--distance" id="distanceKmInput" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="例: 5.5" value="${escapeAttr(getDistanceInputDisplayValue())}">
      </div>
    `;

    return `
      <section class="estimate-step estimate-step--active" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(label)}</h2>
          </div>
        </div>
        ${modeRadios}
        ${roadTypeRadios}
        ${state.roadType === "toll" ? `<p class="estimate-road-type-note">${escapeHtml(tollRoadNote)}</p>` : ""}
        ${addressMode ? addressPanel : manualPanel}
        <p class="estimate-step-note">${escapeHtml(note)}</p>
      </section>
    `;
  }

  function renderStepActive(step, stepNum){
    if(step.type === "assistance"){
      return renderAssistanceStep(stepNum, step);
    }
    if(step.type === "trip"){
      return renderTripStep(stepNum, step);
    }
    if(step.type === "addon"){
      return renderAddonStep(stepNum, step);
    }
    if(step.type === "distance"){
      return renderDistanceStep(stepNum, step);
    }
    return renderChoiceStep(stepNum, step, step.getItems(), step.getValue());
  }

  function renderStepSummary(step, stepNum){
    const summary = getStepSummaryText(step);
    return `
      <section class="estimate-step estimate-step--done" data-step-id="${escapeAttr(step.id)}">
        <div class="estimate-step-head">
          <div>
            <div class="estimate-step-label">STEP${stepNum}</div>
            <h2 class="estimate-step-title">${escapeHtml(step.title)}</h2>
          </div>
          <button type="button" class="estimate-step-edit" data-edit-step="${escapeAttr(step.id)}" aria-label="${escapeAttr(step.title)}を変更">変更</button>
        </div>
        <p class="estimate-step-summary">${escapeHtml(summary)}</p>
      </section>
    `;
  }

  function renderFareSections(result){
    const sections = getFareSections(result);
    return sections.map(function(section){
      const rows = section.rows || [];
      const body = rows.length
        ? rows.map(function(row){
          if(row.note){
            return `<li><span>${escapeHtml(row.label)}</span><span class="estimate-breakdown-note-value">${escapeHtml(row.note)}</span></li>`;
          }
          return `<li><span>${escapeHtml(row.label)}</span><span>${formatYen(row.amount)}</span></li>`;
        }).join("")
        : `<li class="estimate-breakdown-empty"><span>該当なし</span><span>-</span></li>`;
      return `
        <div class="estimate-breakdown-section">
          <div class="estimate-breakdown-section-title">${escapeHtml(section.title)}</div>
          <ul class="estimate-breakdown">
            ${body}
          </ul>
        </div>
      `;
    }).join("");
  }

  function getResultNotes(){
    const fallback =
      "※表示料金は概算です。\n" +
      "※実際の料金は運行距離、交通状況、待機時間、付き添い時間、介助内容等により変動する場合があります。";
    const fixedFareNotice = String(state.config.page?.preFixedFareNotice || "").trim();
    const base = state.config.page?.resultNotes || fallback;
    return fixedFareNotice ? (base + "\n\n" + fixedFareNotice) : base;
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

  function renderFareBasisUsage(section){
    if(Array.isArray(section.usageLines) && section.usageLines.length){
      return (
        "<ul class=\"estimate-fare-basis-usage-list\">" +
        section.usageLines.map(function(line){
          const note = line.note
            ? "<span class=\"estimate-fare-basis-usage-note\">（" + escapeHtml(line.note) + "）</span>"
            : "";
          return (
            "<li>" +
            "<span class=\"estimate-fare-basis-usage-label\">" + escapeHtml(line.label || "") + "</span>" +
            "<span class=\"estimate-fare-basis-usage-value\">" + escapeHtml(line.value || "") + note + "</span>" +
            "</li>"
          );
        }).join("") +
        "</ul>"
      );
    }
    if(section.usage){
      return "<p class=\"estimate-fare-basis-usage\">" + escapeHtml(section.usage) + "</p>";
    }
    return "";
  }

  function formatCalcBasisYen(amount){
    const n = Number(amount) || 0;
    return n.toLocaleString("ja-JP") + "円";
  }

  function getRouteProviderLabel(provider){
    if(provider === "google_routes"){
      return "Google Maps Platform Routes API";
    }
    if(provider === "manual_distance"){
      return "距離手入力";
    }
    return String(provider || "-");
  }

  function getTollRoadUsageLabel(roadType){
    return String(roadType || "") === "toll" ? "利用する" : "利用しない";
  }

  function renderCalcBasisRow(label, value){
    return (
      "<div class=\"estimate-calc-basis-row\">" +
      "<dt>" + escapeHtml(label) + "</dt>" +
      "<dd>" + escapeHtml(value) + "</dd>" +
      "</div>"
    );
  }

  function renderCalcBasisSection(title, rows){
    const rowsHtml = rows.map(function(row){
      return renderCalcBasisRow(row[0], row[1]);
    }).join("");
    return (
      "<section class=\"estimate-calc-basis-section\">" +
      "<h4 class=\"estimate-calc-basis-section-title\">" + escapeHtml(title) + "</h4>" +
      "<dl class=\"estimate-calc-basis-list\">" + rowsHtml + "</dl>" +
      "</section>"
    );
  }

  function renderCalculationBasis(result){
    const snapshot = result.quoteSnapshot || {};
    const breakdown = result.breakdown || {};

    const distanceMeters = Number(snapshot.distanceMeters) || 0;
    const distanceLabel = distanceMeters > 0
      ? formatRouteDistanceMeters(distanceMeters)
      : (formatRouteDistance(snapshot.distanceKm || state.distanceKm) || "-");

    const durationSeconds = Number(snapshot.durationSeconds) || 0;
    const durationLabel = durationSeconds > 0
      ? formatRouteDurationSeconds(durationSeconds)
      : (formatRouteDuration(state.routeCalcResult?.durationMinutes || 0) || "-");

    const routeTypeLabel = snapshot.routeProvider === "google_routes" ? "最短時間ルート" : "-";
    const routeRows = [
      ["推計走行距離", distanceLabel],
      ["推計所要時間", durationLabel],
      ["距離算出システム", getRouteProviderLabel(snapshot.routeProvider)],
      ["ルート種別", routeTypeLabel],
      ["有料道路", getTollRoadUsageLabel(snapshot.roadType || state.roadType)]
    ];

    const fareRows = [];
    if(snapshot.preFixedFareMode){
      if(snapshot.baseDistanceFareAmount != null){
        fareRows.push(["認可距離制運賃", formatCalcBasisYen(snapshot.baseDistanceFareAmount)]);
      }
      if(snapshot.selectedTrafficZoneLabel){
        fareRows.push(["適用交通圏", snapshot.selectedTrafficZoneLabel]);
      }
      if(snapshot.trafficZoneCoefficient != null){
        fareRows.push(["平準化係数", String(snapshot.trafficZoneCoefficient)]);
      }
      if(snapshot.adjustedDistanceFareAmount != null){
        fareRows.push(["事前確定運賃", formatCalcBasisYen(snapshot.adjustedDistanceFareAmount)]);
      }
      (snapshot.fixedFareBreakdown || []).forEach(function(row){
        if(row.key === "pickupFee"){
          fareRows.push([row.label || "迎車料金", formatCalcBasisYen(row.amount)]);
        }else if(row.key === "timeAdjustment"){
          fareRows.push([row.label || "予定時間加算", formatCalcBasisYen(row.amount)]);
        }
      });
    }else{
      (snapshot.fixedFareBreakdown || []).forEach(function(row){
        fareRows.push([row.label || row.key || "", formatCalcBasisYen(row.amount)]);
      });
    }

    const serviceRows = [
      ["乗降介助", formatCalcBasisYen(breakdown.assistanceFee)],
      ["階段介助", formatCalcBasisYen(breakdown.stairFee)],
      [
        "待機・付き添い",
        formatCalcBasisYen((Number(breakdown.waitingFee) || 0) + (Number(breakdown.escortFee) || 0))
      ]
    ];

    const basisNotes = [
      "※本見積は出発地・目的地から算出した推計ルートに基づいています。",
      "※道路状況、交通規制、利用者様のご要望等により実際の運行内容が変更となる場合があります。",
      "※有料道路料金、駐車料金等の実費は別途ご負担となる場合があります。",
      "※事前確定運賃は認可運賃および適用係数に基づき算出しています。"
    ];

    return (
      "<div class=\"estimate-calc-basis\">" +
      "<button type=\"button\" class=\"estimate-calc-basis-toggle\" id=\"estimateCalcBasisToggle\" aria-expanded=\"false\" aria-controls=\"estimateCalcBasisPanel\">" +
      "料金算出根拠を見る" +
      "</button>" +
      "<div class=\"estimate-calc-basis-panel\" id=\"estimateCalcBasisPanel\" hidden>" +
      "<h4 class=\"estimate-calc-basis-title\">料金算出根拠</h4>" +
      renderCalcBasisSection("ルート算出情報", routeRows) +
      renderCalcBasisSection("運賃計算情報", fareRows) +
      renderCalcBasisSection("サービス料金", serviceRows) +
      renderCalcBasisSection("合計", [["見積金額", formatCalcBasisYen(result.total)]]) +
      "<div class=\"estimate-calc-basis-notes\">" +
      basisNotes.map(function(note){
        return "<p>" + escapeHtml(note) + "</p>";
      }).join("") +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderFareBasis(result){
    const basis = result.quoteSnapshot?.fareBasis;
    if(!basis || !Array.isArray(basis.sections) || !basis.sections.length){
      return "";
    }
    const title = state.config.resultLabels?.fareBasisSection || "運賃計算根拠";
    const sectionsHtml = basis.sections.map(function(section){
      const rules = Array.isArray(section.rules)
        ? section.rules.map(function(rule){
          return `<li>${escapeHtml(rule)}</li>`;
        }).join("")
        : "";
      const usage = renderFareBasisUsage(section);
      const amountLabel = String(section.amountLabel || section.title || "");
      const amountHtml = amountLabel
        ? `<p class="estimate-fare-basis-amount"><span>${escapeHtml(amountLabel)}</span><strong>${formatYen(Number(section.amount) || 0)}</strong></p>`
        : "";
      return `
        <div class="estimate-fare-basis-block">
          <div class="estimate-fare-basis-block-title">${escapeHtml(section.title || "")}</div>
          ${rules ? `<ul class="estimate-fare-basis-rules">${rules}</ul>` : ""}
          ${usage}
          ${amountHtml}
        </div>
      `;
    }).join("");
    const noticesHtml = Array.isArray(basis.notices) && basis.notices.length
      ? basis.notices.map(function(notice){
        return `<p class="estimate-fare-basis-notice">${escapeHtml(notice)}</p>`;
      }).join("")
      : "";
    return `
      <div class="estimate-fare-basis">
        <div class="estimate-fare-basis-head">
          <div class="estimate-fare-basis-title">${escapeHtml(title)}</div>
          <div class="estimate-fare-basis-mode">${escapeHtml(basis.fareModeLabel || "")}</div>
        </div>
        <div class="estimate-fare-basis-blocks">
          ${sectionsHtml}
        </div>
        ${noticesHtml ? `<div class="estimate-fare-basis-notices">${noticesHtml}</div>` : ""}
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
      if(typeof window.EstimateHandoff.buildReservationHandoffUrl === "function"){
        return window.EstimateHandoff.buildReservationHandoffUrl(base, state.estimateNumber);
      }
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
      quoteSnapshot: result.quoteSnapshot || null,
      routePlan: result.routePlan || state.routePlan || null,
      selections: {
        mobilityId: state.mobilityId,
        assistanceId: state.assistanceId,
        stairId: state.stairId,
        tripTypeId: state.tripTypeId,
        roundTripAddonId: state.roundTripAddonId,
        roadType: state.roadType
      },
      handoffSource: "lp-site-estimate",
      dtoVersion: 2
    });
  }

  function syncHandoffForResult(result){
    if(!window.EstimateHandoff) return;
    void ensureEstimateNumber(result).then(function(){
      refreshResultSection(result);
    });
  }

  function renderResult(result){
    const totalLabel = state.config.resultLabels?.totalEstimateSection || state.config.resultLabels?.total || "合計目安";
    const reservationUrl = getReservationUrl();
    const lineUrl = state.ctaUrls.line || "#";
    const phoneUrl = state.ctaUrls.phone || "#";

    const routePlan = state.routePlan;
    const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
    const plannedDistance = formatRouteDistanceMeters(primaryRoute?.distanceMeters || routePlan?.distanceMeters || 0);
    const plannedDuration = formatRouteDurationSeconds(primaryRoute?.durationSeconds || routePlan?.durationSeconds || 0);
    const roadTypeLabel = getRoadTypeLabel(routePlan?.roadType || state.roadType);
    const routeCardHtml = routePlan ? `
      <section class="estimate-route-preview" aria-label="走行予定ルート">
        <h4 class="estimate-route-preview-title">走行予定ルート</h4>
        <div class="estimate-route-map" id="estimateRouteMap" role="img" aria-label="走行予定ルート地図"></div>
        <dl class="estimate-route-info-list">
          <div class="estimate-route-info-row">
            <dt>出発地</dt>
            <dd>${escapeHtml(routePlan?.pickup?.address || state.originAddress || "-")}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>目的地</dt>
            <dd>${escapeHtml(routePlan?.destination?.address || state.destinationAddress || "-")}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>道路設定</dt>
            <dd>${escapeHtml(roadTypeLabel)}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>予定距離</dt>
            <dd>${escapeHtml(plannedDistance || formatRouteDistance(state.distanceKm) || "-")}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>予定時間</dt>
            <dd>${escapeHtml(plannedDuration || formatRouteDuration(state.routeCalcResult?.durationMinutes || 0) || "-")}</dd>
          </div>
        </dl>
      </section>
    ` : "";

    return `
      <section class="estimate-result" aria-live="polite" aria-atomic="true">
        <h3>見積結果</h3>
        ${renderEstimateNumberBox()}
        ${routeCardHtml}
        ${renderUsageSummary(result)}
        ${renderFareBasis(result)}
        <div class="estimate-breakdown-groups">
          ${renderFareSections(result)}
        </div>
        <div class="estimate-total-section">
          <div class="estimate-total-rule" aria-hidden="true"></div>
          <div class="estimate-total-box">
            <div class="estimate-total-label">${escapeHtml(totalLabel)}</div>
            <div class="estimate-total-amount">${formatYen(result.total)}～</div>
          </div>
          <div class="estimate-total-rule" aria-hidden="true"></div>
          <div class="estimate-result-notes">${escapeHtml(getResultNotes())}</div>
        </div>
        ${renderCalculationBasis(result)}
        <button type="button" class="estimate-pdf-btn" id="estimatePdfBtn">見積書PDFを保存</button>
        <div class="estimate-pdf-feedback" id="estimatePdfFeedback" aria-live="polite"></div>
        <button type="button" class="estimate-copy-url-btn" id="estimateCopyUrlBtn">見積URLをコピー</button>
        <div class="estimate-copy-url-feedback" id="estimateCopyUrlFeedback" aria-live="polite"></div>
        <button type="button" class="estimate-reset-btn estimate-reset-btn--bottom" id="estimateResetBtnBottom">最初からやり直す</button>
      </section>
      <div class="estimate-cta-group">
        <a class="estimate-cta-primary" href="${escapeAttr(reservationUrl)}" rel="noopener noreferrer">この内容で予約する</a>
        <div class="estimate-cta-secondary-row">
          <a class="estimate-cta-secondary" href="${escapeAttr(lineUrl)}" target="_blank" rel="noopener noreferrer">LINEで相談する</a>
          <a class="estimate-cta-secondary" href="${escapeAttr(phoneUrl)}">電話で問い合わせる</a>
        </div>
      </div>
      <div class="estimate-disclaimer">${escapeHtml(state.config.page?.disclaimer || "")}</div>
    `;
  }

  function scrollToActiveStep(flow, activeIndex){
    const activeStep = flow[activeIndex];
    if(!activeStep) return;
    if(state.lastActiveStepId === activeStep.id) return;
    state.lastActiveStepId = activeStep.id;
    requestAnimationFrame(function(){
      const el = document.querySelector('[data-step-id="' + activeStep.id + '"]');
      if(el){
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  }

  function renderPage(){
    const root = getRoot();
    if(!root || !state.config) return;

    syncAssistanceForMobility();
    syncRoundTripAddon();
    invalidateEstimateNumberIfChanged();

    const { flow, activeIndex } = getFlowState();
    const allComplete = activeIndex >= flow.length;
    const result = window.EstimateCalc.computeEstimate(state.config, state);

    let stepsHtml = "";
    flow.forEach(function(step, index){
      const stepNum = index + 1;
      if(index < activeIndex){
        stepsHtml += renderStepSummary(step, stepNum);
      }else if(index === activeIndex){
        stepsHtml += renderStepActive(step, stepNum);
      }
    });

    root.innerHTML = `
      <div class="estimate-wrap">
        <div class="estimate-header">
          <h1 class="estimate-title">${escapeHtml(state.config.page?.title || "概算見積シミュレーター")}</h1>
          <button type="button" class="estimate-reset-btn" id="estimateResetBtn">最初からやり直す</button>
        </div>
        <p class="estimate-lead">${escapeHtml(state.config.page?.description || "")}</p>
        ${stepsHtml}
        ${allComplete ? renderResult(result) : ""}
      </div>
    `;

    bindEvents();
    bindCopyUrlButton();

    if(!allComplete){
      scrollToActiveStep(flow, activeIndex);
    }else{
      state.lastActiveStepId = "result";
      syncHandoffForResult(result);
      renderRouteMapIfNeeded();
      console.log("PDF_DEBUG_1 ボタン描画");
    }
  }

  function bindDelegatedEvents(){
    const root = getRoot();
    if(!root || delegatedBound) return;
    delegatedBound = true;
    root.addEventListener("click", function(event){
      const editBtn = event.target.closest("[data-edit-step]");
      if(editBtn){
        event.preventDefault();
        event.stopPropagation();
        if(editBtn.disabled) return;
        const stepId = editBtn.getAttribute("data-edit-step");
        if(stepId) openStepForEdit(stepId);
        return;
      }
      const resetBtn = event.target.closest("#estimateResetBtn, #estimateResetBtnBottom");
      if(resetBtn){
        event.preventDefault();
        resetAll();
        return;
      }
      const pdfBtn = event.target.closest("#estimatePdfBtn");
      if(pdfBtn){
        event.preventDefault();
        if(pdfBtn.disabled) return;
        console.log("PDF_DEBUG_2 ボタンクリック");
        saveEstimatePdf();
        return;
      }
      const basisToggle = event.target.closest("#estimateCalcBasisToggle");
      if(basisToggle){
        event.preventDefault();
        const panel = document.getElementById("estimateCalcBasisPanel");
        const expanded = basisToggle.getAttribute("aria-expanded") === "true";
        basisToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        basisToggle.textContent = expanded ? "料金算出根拠を見る" : "料金算出根拠を閉じる";
        if(panel) panel.hidden = expanded;
      }
    });
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

  async function saveEstimatePdf(){
    console.log("PDF_DEBUG_3 generateEstimatePdf開始");
    const feedback = document.getElementById("estimatePdfFeedback");
    const btn = document.getElementById("estimatePdfBtn");
    if(btn) btn.disabled = true;
    if(feedback) feedback.textContent = "PDF を作成しています...";

    try{
      const result = window.EstimateCalc.computeEstimate(state.config, state);
      await ensureEstimateNumber(result);
      if(!window.EstimatePdf){
        throw new Error("PDF モジュールが読み込まれていません。");
      }
      await window.EstimatePdf.savePdf({
        estimateNumber: state.estimateNumber,
        createdAt: state.estimateCreatedAt,
        usageSummary: result.usageSummary,
        quoteSnapshot: result.quoteSnapshot || null,
        fareSections: getFareSections(result),
        breakdownRows: [],
        total: result.total,
        resultNotes: getResultNotes(),
        pdfFooter: state.config.pdfFooter || {},
        pageTitle: state.config.page?.title || "",
        routePlan: state.routePlan || result.routePlan || null,
        googleMaps: state.config.googleMaps || {}
      });
      if(feedback) feedback.textContent = "PDF を保存しました（" + state.estimateNumber + "）";
      refreshResultSection(result);
    }catch(error){
      if(feedback) feedback.textContent = "PDF 保存に失敗しました: " + error.message;
    }finally{
      if(btn) btn.disabled = false;
    }
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
    renderRouteMapIfNeeded();
    bindCopyUrlButton();
  }

  function buildShareUrl(){
    if(!window.EstimateUrl || typeof window.EstimateUrl.buildShareUrl !== "function"){
      return window.location.href;
    }
    return window.EstimateUrl.buildShareUrl({
      mobilityId: state.mobilityId,
      assistanceId: state.assistanceId,
      stairId: state.stairId,
      tripTypeId: state.tripTypeId,
      roundTripAddonId: state.roundTripAddonId,
      distanceKm: state.distanceKm,
      roadType: state.roadType,
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

  function bindChoiceGroup(name, handler){
    document.querySelectorAll('input[name="' + name + '"]').forEach(function(input){
      input.addEventListener("change", function(){
        if(input.checked && input.value){
          handler(input.value);
        }
      });
    });
  }

  function bindEvents(){
    bindChoiceGroup("mobilityChoice", function(value){
      state.mobilityId = value;
      clearStepsAfter("mobility");
      syncAssistanceForMobility();
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("assistanceChoice", function(value){
      state.assistanceId = value;
      clearStepsAfter("assistance");
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("stairChoice", function(value){
      state.stairId = value;
      clearStepsAfter("stair");
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("tripChoice", function(value){
      state.tripTypeId = value;
      state.roundTripAddonId = "";
      clearStepsAfter("trip");
      syncRoundTripAddon();
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("addonChoice", function(value){
      state.roundTripAddonId = value;
      clearStepsAfter("addon");
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("distanceInputMode", function(value){
      state.distanceInputMode = value === "manual" ? "manual" : "address";
      state.routeCalcError = "";
      if(state.distanceInputMode === "manual"){
        state.routePlan = null;
      }
      state.lastActiveStepId = "";
      renderPage();
    });

    bindChoiceGroup("roadType", function(value){
      state.roadType = value === "toll" ? "toll" : "general";
      state.routeCalcError = "";
      state.routePlan = null;
      state.lastActiveStepId = "";
      renderPage();
    });

    const originInput = document.getElementById("originAddressInput");
    if(originInput){
      originInput.addEventListener("input", function(){
        state.originAddress = originInput.value;
      });
    }

    const destinationInput = document.getElementById("destinationAddressInput");
    if(destinationInput){
      destinationInput.addEventListener("input", function(){
        state.destinationAddress = destinationInput.value;
      });
    }

    const calculateBtn = document.getElementById("calculateDistanceBtn");
    if(calculateBtn){
      calculateBtn.addEventListener("click", function(event){
        event.preventDefault();
        calculateRouteDistance();
      });
    }

    const distanceInput = document.getElementById("distanceKmInput");
    if(distanceInput){
      distanceInput.addEventListener("input", function(){
        state.distanceInputText = distanceInput.value;
      });
      distanceInput.addEventListener("blur", function(){
        commitDistanceInput();
      });
      distanceInput.addEventListener("keydown", function(event){
        if(event.key === "Enter"){
          event.preventDefault();
          distanceInput.blur();
        }
      });
    }
  }

  async function init(){
    showMessage("loading", "設定を読み込んでいます...");
    try{
      if(!window.EstimateConfigLoader || typeof window.EstimateConfigLoader.loadEstimateConfig !== "function"){
        throw new Error("設定の読み込み機能が利用できません。");
      }
      bindDelegatedEvents();
      await loadCtaUrls();

      const urlState = window.EstimateUrl?.parseUrlState?.() || {};
      state.config = await window.EstimateConfigLoader.loadEstimateConfig();
      logGoogleMapsConfig("init:config-loaded");

      if(window.EstimateUrl?.applyUrlStateToFormState){
        window.EstimateUrl.applyUrlStateToFormState(state, urlState, state.config);
      }
      if(state.roadType !== "toll"){
        state.roadType = "general";
      }
      if(urlState.estimateNumber){
        state.estimateNumber = urlState.estimateNumber;
      }

      if(state.config?.googleMaps?.enabled === false){
        state.distanceInputMode = "manual";
      }

      syncAssistanceForMobility();
      syncRoundTripAddon();

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
