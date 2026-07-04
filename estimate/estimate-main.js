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
    returnPlanType: "same_return",
    returnStopType: "",
    returnStopAddress: "",
    differentReturnAddress: "",
    routeCalcResult: null,
    routePlan: null,
    routeCalcError: "",
    routeCalcLoading: false,
    hasRouteCalculatedOnce: false,
    distanceRouteReviewed: false,
    estimateNumber: "",
    estimateCreatedAt: "",
    selectionFingerprint: "",
    lastActiveStepId: "",
    quoteRegisterStatus: "",
    quoteRegisterMessage: ""
  };

  let delegatedBound = false;
  let mobileReserveBarResizeBound = false;
  let mobileReserveBarResizeTimer = null;
  // 初回表示・再読み込み時はページ上部から開始する（STEPカード途中への自動スクロールを抑止）
  let pageEntryScrollPending = true;
  let mobileReserveBarObserver = null;

  if("scrollRestoration" in history){
    history.scrollRestoration = "manual";
  }

  function scrollPageToTop(){
    window.scrollTo(0, 0);
    if(document.documentElement){
      document.documentElement.scrollTop = 0;
    }
    if(document.body){
      document.body.scrollTop = 0;
    }
  }

  scrollPageToTop();

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

  function isRoundTripActive(){
    return window.EstimateCalc?.isRoundTripSelected?.(state.config, state) === true;
  }

  function getActiveReturnPlanType(){
    if(!isRoundTripActive()){
      return "";
    }
    return window.EstimateCalc.resolveReturnPlanType(state);
  }

  function clearReturnPlanInputs(){
    state.returnPlanType = "same_return";
    state.returnStopType = "";
    state.returnStopAddress = "";
    state.differentReturnAddress = "";
  }

  function getReturnPlanNotice(){
    const planType = getActiveReturnPlanType();
    if(planType === "same_return"){
      return "往復送迎のため、往路と復路を別々にルート計算します。交通規制や一方通行等により、帰りの距離・時間は往路と異なる場合があります。";
    }
    if(planType === "return_with_stop"){
      return "帰りに立ち寄り先を経由するため、復路は「目的地 → 立ち寄り先 → 出発地」で計算します。立ち寄り内容や待機時間により、実際の料金が変動する場合があります。";
    }
    if(planType === "different_return_destination"){
      return "往復送迎のため、往路と復路を別々にルート計算します。帰り先が異なる場合も復路を個別に算定します。";
    }
    if(planType === "return_pending"){
      return "帰りの予定が未定のため、復路は事前確定運賃の対象外です。診察終了後の状況により、通常見積または確認対応となります。";
    }
    return "";
  }

  function getReturnLegRequest(){
    const planType = getActiveReturnPlanType();
    if(!isRoundTripActive() || planType === "return_pending"){
      return null;
    }
    const origin = String(state.destinationAddress || "").trim();
    const home = String(state.originAddress || "").trim();
    if(planType === "same_return"){
      return { origin: origin, destination: home, intermediateAddress: "" };
    }
    if(planType === "return_with_stop"){
      const stop = String(state.returnStopAddress || "").trim();
      return { origin: origin, destination: home, intermediateAddress: stop };
    }
    if(planType === "different_return_destination"){
      const returnDest = String(state.differentReturnAddress || "").trim();
      return { origin: origin, destination: returnDest, intermediateAddress: "" };
    }
    return null;
  }

  function buildLegRoutePlanFromApiResult(origin, destination, waypoint, apiResult){
    const routes = Array.isArray(apiResult?.routes) ? apiResult.routes : [];
    const primaryRoute = routes.length ? routes[0] : null;
    const waypointInfo = waypoint
      ? {
        waypointLabel: String(waypoint.label || waypoint.address || "").trim(),
        waypointAddress: String(waypoint.address || "").trim(),
        stopType: waypoint.stopType || null
      }
      : null;
    return {
      provider: "google_routes",
      roadType: state.roadType === "toll" ? "toll" : "general",
      origin: { address: origin },
      destination: { address: destination },
      waypoint: waypointInfo,
      selectedRouteId: String(apiResult?.selectedRouteId || primaryRoute?.routeId || "route_0"),
      encodedPolyline: String(primaryRoute?.encodedPolyline || ""),
      routeLabel: String(primaryRoute?.routeLabel || ""),
      routeDescription: String(primaryRoute?.routeDescription || ""),
      routeSummary: String(primaryRoute?.routeSummary || primaryRoute?.routeLabel || ""),
      routeStrategy: primaryRoute?.routeStrategy || null,
      routeSource: primaryRoute?.routeSource || "google_routes",
      routeToken: String(primaryRoute?.routeToken || ""),
      distanceMeters: Number(primaryRoute?.distanceMeters || apiResult?.distanceMeters) || 0,
      durationSeconds: Number(primaryRoute?.durationSeconds || apiResult?.durationSeconds) || 0,
      tollInfo: primaryRoute?.tollInfo || null,
      tollPreference: primaryRoute?.tollPreference || null,
      tollExcludedFromFare: primaryRoute?.tollExcludedFromFare === true,
      intermediateWaypoint: primaryRoute?.intermediateWaypoint || waypointInfo,
      routeLegs: Array.isArray(primaryRoute?.routeLegs) ? primaryRoute.routeLegs : [],
      routes: routes,
      routeCandidates: Array.isArray(apiResult?.routeCandidates) ? apiResult.routeCandidates : routes,
      selectedAt: new Date().toISOString(),
      preFixedFareConfirmable: apiResult?.preFixedFareConfirmable === true,
      multipleRoutesAvailable: apiResult?.multipleRoutesAvailable === true,
      routeCandidateCount: Number(apiResult?.routeCandidateCount) || routes.length,
      distinctRouteCount: Number(apiResult?.distinctRouteCount) || routes.length,
      alternativeRouteCount: Number(apiResult?.alternativeRouteCount) || routes.length,
      routeDedupedCount: Number(apiResult?.routeDedupedCount) || routes.length,
      routeGenerationStrategies: Array.isArray(apiResult?.routeGenerationStrategies)
        ? apiResult.routeGenerationStrategies.slice()
        : [],
      rawRouteCount: Number(apiResult?.rawRouteCount) || 0,
      fallbackReason: apiResult?.fallbackReason || null
    };
  }

  function mirrorRoutePlanLegacyFields(routePlan){
    if(!routePlan?.outboundRoutePlan){
      return routePlan;
    }
    const outbound = routePlan.outboundRoutePlan;
    const primaryRoute = window.EstimateCalc.getLegPrimaryRoute(outbound);
    return Object.assign({}, routePlan, {
      tripType: routePlan.tripType || null,
      returnPlanType: routePlan.returnPlanType || null,
      provider: outbound.provider || "google_routes",
      roadType: outbound.roadType || routePlan.roadType || "general",
      selectedRouteId: String(outbound.selectedRouteId || primaryRoute?.routeId || ""),
      encodedPolyline: String(primaryRoute?.encodedPolyline || outbound.encodedPolyline || ""),
      routeLabel: String(primaryRoute?.routeLabel || outbound.routeLabel || ""),
      routeDescription: String(primaryRoute?.routeDescription || outbound.routeDescription || ""),
      routeSummary: String(primaryRoute?.routeSummary || outbound.routeSummary || ""),
      routeStrategy: primaryRoute?.routeStrategy || outbound.routeStrategy || null,
      routeSource: primaryRoute?.routeSource || outbound.routeSource || null,
      routeToken: String(primaryRoute?.routeToken || outbound.routeToken || ""),
      distanceMeters: Number(primaryRoute?.distanceMeters || outbound.distanceMeters) || 0,
      durationSeconds: Number(primaryRoute?.durationSeconds || outbound.durationSeconds) || 0,
      tollInfo: primaryRoute?.tollInfo ?? outbound.tollInfo ?? null,
      tollPreference: primaryRoute?.tollPreference || outbound.tollPreference || null,
      tollExcludedFromFare: primaryRoute?.tollExcludedFromFare === true,
      intermediateWaypoint: primaryRoute?.intermediateWaypoint || outbound.waypoint || null,
      routes: Array.isArray(outbound.routes) ? outbound.routes : [],
      routeCandidates: Array.isArray(outbound.routeCandidates) ? outbound.routeCandidates : [],
      preFixedFareConfirmable: routePlan.preFixedFareConfirmable === true,
      multipleRoutesAvailable: routePlan.multipleRoutesAvailable === true,
      routeCandidateCount: Number(outbound.routeCandidateCount) || 0,
      distinctRouteCount: Number(outbound.distinctRouteCount) || 0,
      alternativeRouteCount: Number(outbound.alternativeRouteCount) || 0,
      routeDedupedCount: Number(outbound.routeDedupedCount) || 0,
      routeGenerationStrategies: Array.isArray(outbound.routeGenerationStrategies)
        ? outbound.routeGenerationStrategies.slice()
        : [],
      fallbackReason: outbound.fallbackReason || null,
      pickup: {
        address: outbound.origin?.address || state.originAddress || "",
        latLng: routePlan.pickup?.latLng || null,
        geocoding: routePlan.pickup?.geocoding || null
      },
      destination: {
        address: outbound.destination?.address || state.destinationAddress || "",
        latLng: routePlan.destination?.latLng || null
      }
    });
  }

  function buildStructuredRoutePlan(outboundLeg, returnLeg, options){
    const opts = options || {};
    const outboundMeters = Number(window.EstimateCalc.getLegPrimaryRoute(outboundLeg)?.distanceMeters || outboundLeg?.distanceMeters) || 0;
    const outboundSeconds = Number(window.EstimateCalc.getLegPrimaryRoute(outboundLeg)?.durationSeconds || outboundLeg?.durationSeconds) || 0;
    const returnMeters = returnLeg
      ? Number(window.EstimateCalc.getLegPrimaryRoute(returnLeg)?.distanceMeters || returnLeg?.distanceMeters) || 0
      : 0;
    const returnSeconds = returnLeg
      ? Number(window.EstimateCalc.getLegPrimaryRoute(returnLeg)?.durationSeconds || returnLeg?.durationSeconds) || 0
      : 0;
    const totalDistanceMeters = outboundMeters + returnMeters;
    const totalDurationSeconds = outboundSeconds + returnSeconds;
    const returnPlanType = opts.returnPlanType || getActiveReturnPlanType();
    const hasReturnLeg = Boolean(returnLeg);
    const returnFareStatus = returnPlanType === "return_pending"
      ? "review_required"
      : (hasReturnLeg ? "fixed_candidate" : "review_required");
    const preFixedFareScope = returnPlanType === "return_pending" || !hasReturnLeg
      ? "outbound_only"
      : "outbound_and_return";
    const preFixedFareConfirmable = window.EstimateCalc.resolveStructuredPreFixedFareConfirmable({
      returnPlanType: returnPlanType,
      outboundRoutePlan: outboundLeg,
      returnRoutePlan: returnLeg,
      overallRouteSelection: opts.overallRouteSelection || null
    });

    const routePlan = mirrorRoutePlanLegacyFields({
      tripType: opts.tripType || (isRoundTripActive() ? "round_trip" : "one_way"),
      returnPlanType: isRoundTripActive() ? returnPlanType : null,
      outboundRoutePlan: outboundLeg,
      returnRoutePlan: returnLeg,
      overallRouteSelection: opts.overallRouteSelection || null,
      returnWithStopSplitContext: opts.returnWithStopSplitContext || null,
      totalDistanceMeters: totalDistanceMeters,
      totalDurationSeconds: totalDurationSeconds,
      preFixedFareScope: preFixedFareScope,
      returnFareStatus: isRoundTripActive() ? returnFareStatus : null,
      preFixedFareConfirmable: preFixedFareConfirmable,
      multipleRoutesAvailable: preFixedFareConfirmable,
      pickup: opts.pickup || null,
      destination: opts.destination || null
    });
    return routePlan;
  }

  function getSelectionFingerprint(){
    return [
      state.mobilityId,
      state.assistanceId,
      state.stairId,
      state.tripTypeId,
      state.roundTripAddonId,
      getActiveReturnPlanType(),
      state.returnStopType,
      state.returnStopAddress,
      state.differentReturnAddress,
      String(state.distanceKm),
      state.roadType,
      String(state.routePlan?.outboundRoutePlan?.selectedRouteId || state.routePlan?.selectedRouteId || ""),
      String(state.routePlan?.returnRoutePlan?.selectedRouteId || ""),
      String(state.routePlan?.overallRouteSelection?.selectedOverallRouteId || "")
    ].join("|");
  }

  function invalidateEstimateNumberIfChanged(){
    const fp = getSelectionFingerprint();
    if(state.selectionFingerprint && state.selectionFingerprint !== fp){
      state.estimateNumber = "";
      state.estimateCreatedAt = "";
      state.quoteRegisterStatus = "";
      state.quoteRegisterMessage = "";
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
      title: state.config.page?.distanceLabel || "走行ルート設定",
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
        if(Number(state.distanceKm) <= 0){
          return false;
        }
        if(isPreFixedFareMode() && state.routePlan){
          return state.distanceRouteReviewed === true;
        }
        return true;
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
      case "distance": {
        const billed = window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, state);
        return billed > 0 ? billed.toFixed(1) + "km" : "";
      }
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
          clearReturnPlanInputs();
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
        clearReturnPlanInputs();
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
        state.distanceRouteReviewed = false;
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
    state.quoteRegisterStatus = "";
    state.quoteRegisterMessage = "";
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
    clearReturnPlanInputs();
    state.routeCalcResult = null;
    state.routePlan = null;
    state.routeCalcError = "";
    state.routeCalcLoading = false;
    state.hasRouteCalculatedOnce = false;
    state.distanceRouteReviewed = false;
    state.estimateNumber = "";
    state.estimateCreatedAt = "";
    state.selectionFingerprint = "";
    state.lastActiveStepId = "";
    state.quoteRegisterStatus = "";
    state.quoteRegisterMessage = "";
    if(window.EstimateUrl?.clearUrlState){
      window.EstimateUrl.clearUrlState();
    }
    if(window.EstimateHandoff?.clearHandoffRecord){
      window.EstimateHandoff.clearHandoffRecord();
    }
    pageEntryScrollPending = true;
    renderPage();
  }

  function getFareSections(result){
    const labels = state.config.resultLabels || {};
    const snapshot = result.quoteSnapshot || {};
    const fareMode = snapshot.fareMode || state.config.fareMode || "";
    const fixedFareTitle = window.EstimateFareDisplay
      ? window.EstimateFareDisplay.getFixedFareSectionTitle(fareMode, labels)
      : (fareMode === "pre_fixed_fare"
        ? (labels.fixedFareSection || "事前確定運賃")
        : (labels.estimatedFareSection || "概算料金内訳"));
    const fixedFareRows = Array.isArray(snapshot.fixedFareBreakdown)
      ? snapshot.fixedFareBreakdown.map(function(row){
        return {
          key: row.key || "",
          label: row.label || row.key || "",
          amount: Number(row.amount) || 0
        };
      }).filter(function(row){
        return row.amount > 0 && row.key !== "specialVehicleFee";
      })
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
        title: fixedFareTitle,
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
      const displayItem = Object.assign({}, item, {
        amount: window.EstimateCalc.getAddonDisplayAmount(state.config, item)
      });
      return window.EstimateHelp.renderChoiceCard(displayItem, {
        name: step.choiceName,
        checked: item.id === state.roundTripAddonId,
        showAmount: true,
        approximateAmount: true
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
    if(window.EstimateCalc && typeof window.EstimateCalc.getLegPrimaryRoute === "function"){
      const outbound = window.EstimateCalc.getOutboundLegPlan(routePlan);
      return window.EstimateCalc.getLegPrimaryRoute(outbound);
    }
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

  function getRouteCandidatesFromLeg(legPlan){
    if(!legPlan){
      return [];
    }
    const candidates = Array.isArray(legPlan.routeCandidates) && legPlan.routeCandidates.length
      ? legPlan.routeCandidates.slice()
      : (Array.isArray(legPlan.routes) && legPlan.routes.length ? legPlan.routes.slice() : []);
    if(candidates.length){
      return candidates;
    }
    if((Number(legPlan.distanceMeters) || 0) > 0 || String(legPlan.encodedPolyline || "").trim()){
      return [{
        routeId: String(legPlan.selectedRouteId || "route_0"),
        routeLabel: String(legPlan.routeLabel || "おすすめルート"),
        routeDescription: String(legPlan.routeDescription || ""),
        routeStrategy: legPlan.routeStrategy || "recommended",
        routeSource: legPlan.routeSource || legPlan.provider || "google_routes",
        distanceMeters: Number(legPlan.distanceMeters) || 0,
        durationSeconds: Number(legPlan.durationSeconds) || 0,
        distanceKm: Math.round((Number(legPlan.distanceMeters) || 0) / 100) / 10,
        durationMinutes: Number(legPlan.durationSeconds) > 0
          ? Math.max(1, Math.round(Number(legPlan.durationSeconds) / 60))
          : 0,
        encodedPolyline: String(legPlan.encodedPolyline || ""),
        routeToken: String(legPlan.routeToken || ""),
        routeSummary: String(legPlan.routeSummary || legPlan.routeLabel || ""),
        tollInfo: legPlan.tollInfo || null,
        tollPreference: legPlan.tollPreference || null,
        tollExcludedFromFare: legPlan.tollExcludedFromFare === true,
        intermediateWaypoint: legPlan.intermediateWaypoint || legPlan.waypoint || null,
        roadType: legPlan.roadType || "general",
        routeLabels: []
      }];
    }
    return [];
  }

  function getRouteCandidatesFromPlan(routePlan){
    if(routePlan?.outboundRoutePlan){
      return getRouteCandidatesFromLeg(routePlan.outboundRoutePlan);
    }
    if(!routePlan){
      return [];
    }
    const candidates = Array.isArray(routePlan.routeCandidates) && routePlan.routeCandidates.length
      ? routePlan.routeCandidates.slice()
      : (Array.isArray(routePlan.routes) && routePlan.routes.length ? routePlan.routes.slice() : []);
    if(candidates.length){
      return candidates;
    }
    if((Number(routePlan.distanceMeters) || 0) > 0 || String(routePlan.encodedPolyline || "").trim()){
      const distanceMeters = Number(routePlan.distanceMeters) || 0;
      const durationSeconds = Number(routePlan.durationSeconds) || 0;
      return [{
        routeId: String(routePlan.selectedRouteId || "route_0"),
        routeLabel: String(routePlan.routeLabel || "おすすめルート"),
        routeDescription: String(routePlan.routeDescription || ""),
        routeStrategy: routePlan.routeStrategy || "recommended",
        routeSource: routePlan.routeSource || routePlan.provider || "google_routes",
        distanceMeters: distanceMeters,
        durationSeconds: durationSeconds,
        distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
        durationMinutes: durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : 0,
        encodedPolyline: String(routePlan.encodedPolyline || ""),
        routeToken: String(routePlan.routeToken || ""),
        routeSummary: String(routePlan.routeSummary || routePlan.routeLabel || ""),
        tollInfo: routePlan.tollInfo || null,
        tollPreference: routePlan.tollPreference || null,
        tollExcludedFromFare: routePlan.tollExcludedFromFare === true,
        intermediateWaypoint: routePlan.intermediateWaypoint || null,
        roadType: routePlan.roadType || "general",
        routeLabels: Array.isArray(routePlan.routeLabels) ? routePlan.routeLabels.slice() : []
      }];
    }
    return [];
  }

  function getRoadTypeLabel(roadType){
    return String(roadType || "") === "toll" ? "有料道路利用" : "一般道利用";
  }

  function getConfigFareMode(){
    return String(state.config?.fareMode || "");
  }

  function getLpFareModeLeadText(){
    const fareMode = getConfigFareMode();
    if(window.EstimateFareDisplay){
      return window.EstimateFareDisplay.getLpFareModeLeadFromFareMode(fareMode);
    }
    return state.config?.page?.description || "";
  }

  function getLpFareModeTitleText(){
    const fareMode = getConfigFareMode();
    if(window.EstimateFareDisplay){
      return window.EstimateFareDisplay.getLpFareModeTitleFromFareMode(fareMode);
    }
    return state.config?.page?.title || "かんたん料金確認";
  }

  function isPreFixedFareMode(){
    return getConfigFareMode() === "pre_fixed_fare";
  }

  function isRouteUiDebugEnabled(){
    try{
      if(typeof window !== "undefined"){
        if(new URLSearchParams(window.location.search).get("routeUiDebug") === "1"){
          return true;
        }
        if(window.localStorage && window.localStorage.getItem("estimateRouteUiDebug") === "1"){
          return true;
        }
      }
    }catch(error){}
    return false;
  }

  function logRouteUiState(result){
    const fareMode = String(state.config?.fareMode || result?.quoteSnapshot?.fareMode || "");
    const routeCandidates = getRouteCandidatesFromPlan(state.routePlan);
    const snapshot = result?.quoteSnapshot || {};
    const distinctRouteCount = Number(state.routePlan?.distinctRouteCount ?? routeCandidates.length);
    const preFixedFareConfirmable = state.routePlan?.preFixedFareConfirmable === true
      || snapshot.preFixedFareConfirmable === true;
    const selectionUiVisible = fareMode === "pre_fixed_fare" && routeCandidates.length > 0;

    if(isRouteUiDebugEnabled()){
      console.log("[route-ui] fareMode", fareMode);
      console.log("[route-ui] routeCandidates", routeCandidates);
      console.log("[route-ui] distinctRouteCount", distinctRouteCount);
      console.log("[route-ui] preFixedFareConfirmable", preFixedFareConfirmable);
      console.log("[route-ui] detail", {
        hasRoutePlan: Boolean(state.routePlan),
        routeCandidateCount: routeCandidates.length,
        selectionUiVisible: selectionUiVisible,
        routeCalcError: state.routeCalcError || "",
        fallbackReason: state.routePlan?.fallbackReason || snapshot.fallbackReason || null
      });
    }

    if(fareMode !== "pre_fixed_fare"){
      console.info(
        "[route-ui] 現在は概算見積モード（fareMode=" + fareMode + "）のため、事前確定運賃のルート選択UIは非表示。"
        + " 管理画面の運賃方式を「事前確定運賃」に設定し、estimate-config.json を保存してください。"
      );
    }
  }

  function getRouteDisplayLabel(route, index){
    if(window.PreFixedFareRoutePresentation && typeof window.PreFixedFareRoutePresentation.getRouteDisplayLabel === "function"){
      return window.PreFixedFareRoutePresentation.getRouteDisplayLabel(route, index);
    }
    const explicit = String(route?.routeLabel || "").trim();
    if(explicit){
      return explicit;
    }
    const labels = Array.isArray(route?.routeLabels) ? route.routeLabels.filter(Boolean) : [];
    if(labels.length){
      return labels.join(" / ");
    }
    return "ルート候補 " + (Number(index) + 1);
  }

  function getRouteDisplayDescription(route){
    if(window.PreFixedFareRoutePresentation && typeof window.PreFixedFareRoutePresentation.getRouteDisplayDescription === "function"){
      return window.PreFixedFareRoutePresentation.getRouteDisplayDescription(route);
    }
    return String(route?.routeDescription || "").trim();
  }

  function shouldShowRouteSummaryMeta(route, summary){
    const text = String(summary || "").trim();
    if(!text){
      return false;
    }
    if(window.PreFixedFareRoutePresentation && typeof window.PreFixedFareRoutePresentation.isInternalRouteSummary === "function"){
      return !window.PreFixedFareRoutePresentation.isInternalRouteSummary(text);
    }
    return text !== String(route?.routeLabel || "").trim();
  }

  function isLegPreFixedFareConfirmable(legPlan){
    return legPlan?.preFixedFareConfirmable === true;
  }

  function isPreFixedFareConfirmable(){
    return state.routePlan?.preFixedFareConfirmable === true;
  }

  function getOverallRouteSelection(routePlan){
    return routePlan?.overallRouteSelection || null;
  }

  function getOverallRouteCandidates(routePlan){
    const overall = getOverallRouteSelection(routePlan);
    return Array.isArray(overall?.overallRouteCandidates) ? overall.overallRouteCandidates : [];
  }

  function requiresOverallRouteSelection(routePlan){
    if(getActiveReturnPlanType() !== "return_with_stop" || !isPreFixedFareMode()){
      return false;
    }
    return getOverallRouteCandidates(routePlan).length >= 2;
  }

  function hasOverallRouteSelected(routePlan){
    const overall = getOverallRouteSelection(routePlan);
    return Boolean(String(overall?.selectedOverallRouteId || "").trim());
  }

  function isOverallRouteSelectionMode(routePlan){
    return requiresOverallRouteSelection(routePlan);
  }

  function getOverallRoutePathLabel(routePlan){
    const overall = getOverallRouteSelection(routePlan);
    const segments = Array.isArray(overall?.commonSegments) ? overall.commonSegments : [];
    const selectable = overall?.selectableSegment || null;
    const outbound = segments.find(function(segment){
      return segment?.key === "outbound";
    });
    const returnCommon = segments.find(function(segment){
      return segment?.key === "return_common";
    });
    const home = String(outbound?.originAddress || state.originAddress || "出発地").trim();
    const goal = String(outbound?.destinationAddress || state.destinationAddress || "目的地").trim();
    const stop = String(returnCommon?.destinationAddress || selectable?.originAddress || state.returnStopAddress || "立ち寄り").trim();
    return home + " → " + goal + " → " + stop + " → " + home;
  }

  function getSelectedOverallRouteCandidate(routePlan){
    const overall = getOverallRouteSelection(routePlan);
    const selectedId = String(overall?.selectedOverallRouteId || "").trim();
    if(!selectedId){
      return null;
    }
    return getOverallRouteCandidates(routePlan).find(function(candidate){
      return String(candidate?.routeId || "") === selectedId;
    }) || null;
  }

  function applySelectedOverallToRoutePlan(routePlan){
    const candidate = getSelectedOverallRouteCandidate(routePlan);
    if(!candidate || !routePlan){
      return routePlan;
    }
    const confirmable = window.EstimateCalc.resolveStructuredPreFixedFareConfirmable(routePlan);
    return Object.assign({}, routePlan, {
      totalDistanceMeters: Number(candidate.totalDistanceMeters) || Number(routePlan.totalDistanceMeters) || 0,
      totalDurationSeconds: Number(candidate.totalDurationSeconds) || Number(routePlan.totalDurationSeconds) || 0,
      routeLabel: String(candidate.routeLabel || routePlan.routeLabel || ""),
      routeDescription: String(candidate.routeDescription || routePlan.routeDescription || ""),
      selectedRouteLabel: String(candidate.routeLabel || ""),
      selectedRouteDescription: String(candidate.routeDescription || ""),
      selectedRouteType: candidate.routeType || candidate.strategy || null,
      selectedUsesToll: candidate.usesToll === true,
      preFixedFareConfirmable: confirmable,
      multipleRoutesAvailable: confirmable
    });
  }

  function legRequiresRouteSelection(legPlan){
    if(!legPlan || !isLegPreFixedFareConfirmable(legPlan)){
      return false;
    }
    return legPlan.routeSelectionConfirmed !== true;
  }

  function isRouteReviewComplete(routePlan){
    if(!routePlan){
      return false;
    }
    if(isOverallRouteSelectionMode(routePlan)){
      return hasOverallRouteSelected(routePlan);
    }
    const outbound = routePlan.outboundRoutePlan || routePlan;
    if(legRequiresRouteSelection(outbound)){
      return false;
    }
    const returnLeg = routePlan.returnRoutePlan;
    if(returnLeg && legRequiresRouteSelection(returnLeg)){
      return false;
    }
    return true;
  }

  function applyRouteToLegPlan(legPlan, route){
    if(!legPlan || !route){
      return legPlan;
    }
    const next = Object.assign({}, legPlan, {
      selectedRouteId: String(route.routeId || ""),
      distanceMeters: Number(route.distanceMeters) || 0,
      durationSeconds: Number(route.durationSeconds) || 0,
      encodedPolyline: String(route.encodedPolyline || ""),
      routeToken: String(route.routeToken || ""),
      routeLabel: String(route.routeLabel || ""),
      routeDescription: String(route.routeDescription || ""),
      routeSummary: String(route.routeSummary || route.routeLabel || ""),
      routeStrategy: route.routeStrategy || null,
      routeType: route.routeType || route.routeStrategy || null,
      usesToll: route.usesToll === true,
      routeSource: route.routeSource || null,
      roadType: String(route.roadType || legPlan.roadType || state.roadType || "general"),
      tollInfo: route.tollInfo || null,
      tollPreference: route.tollPreference || null,
      tollExcludedFromFare: route.tollExcludedFromFare === true,
      intermediateWaypoint: route.intermediateWaypoint || legPlan.waypoint || null,
      routeLegs: Array.isArray(route.routeLegs) ? route.routeLegs : (legPlan.routeLegs || []),
      routeSelectionConfirmed: true,
      selectedAt: new Date().toISOString()
    });
    if(Array.isArray(next.routes)){
      next.routes = next.routes.map(function(item){
        if(String(item?.routeId || "") === String(route.routeId || "")){
          return Object.assign({}, item, route);
        }
        return item;
      });
    }
    return next;
  }

  function buildReturnWithStopSplitContext(returnRequest, returnWithStopSplit){
    if(!returnRequest || !returnWithStopSplit){
      return null;
    }
    const selectableCandidates = Array.isArray(returnWithStopSplit.selectableResult?.routeCandidates)
      ? returnWithStopSplit.selectableResult.routeCandidates
      : [];
    if(!returnWithStopSplit.returnCommonRoute || !selectableCandidates.length){
      return null;
    }
    return {
      homeAddress: String(returnRequest.destination || "").trim(),
      goalAddress: String(returnRequest.origin || "").trim(),
      stopAddress: String(returnRequest.intermediateAddress || "").trim(),
      returnCommonRoute: returnWithStopSplit.returnCommonRoute,
      selectableCandidates: selectableCandidates
    };
  }

  function resolveReturnWithStopOverallRouteSelection(outboundLeg, existingPlan){
    const splitContext = existingPlan?.returnWithStopSplitContext;
    if(!splitContext || typeof window.EstimateDistanceApi?.assembleOverallRouteSelection !== "function"){
      return existingPlan?.overallRouteSelection || null;
    }
    const outboundRoute = window.EstimateCalc.getLegPrimaryRoute(outboundLeg);
    if(!outboundRoute){
      return existingPlan?.overallRouteSelection || null;
    }
    const outboundRouteCandidates = Array.isArray(outboundLeg?.routeCandidates) && outboundLeg.routeCandidates.length
      ? outboundLeg.routeCandidates
      : [outboundRoute];
    const selectedOutboundId = String(outboundLeg?.selectedRouteId || outboundRoute?.routeId || "");
    const selectionPhase = outboundRouteCandidates.length >= 2 && selectedOutboundId
      ? "overall"
      : (outboundRouteCandidates.length >= 2 ? "outbound" : "overall");
    return window.EstimateDistanceApi.assembleOverallRouteSelection({
      homeAddress: splitContext.homeAddress,
      goalAddress: splitContext.goalAddress,
      stopAddress: splitContext.stopAddress,
      outboundRoute: outboundRoute,
      outboundRouteCandidates: outboundRouteCandidates,
      returnCommonRoute: splitContext.returnCommonRoute,
      selectableCandidates: splitContext.selectableCandidates,
      selectedOverallRouteId: existingPlan?.overallRouteSelection?.selectedOverallRouteId || null,
      selectionPhase: selectionPhase
    });
  }

  function rebuildRoutePlanFromLegs(outboundLeg, returnLeg, opts){
    const existingPlan = state.routePlan || {};
    const extras = opts || {};
    const splitContext = existingPlan.returnWithStopSplitContext || null;
    const priorOverall = extras.overallRouteSelection || existingPlan.overallRouteSelection || null;
    const overallRouteSelection = splitContext
      ? resolveReturnWithStopOverallRouteSelection(outboundLeg, Object.assign({}, existingPlan, {
        overallRouteSelection: priorOverall
      }))
      : (priorOverall || null);
    let routePlan = buildStructuredRoutePlan(outboundLeg, returnLeg, {
      returnPlanType: getActiveReturnPlanType(),
      tripType: isRoundTripActive() ? "round_trip" : "one_way",
      pickup: existingPlan.pickup || {
        address: state.originAddress,
        latLng: null,
        geocoding: null
      },
      destination: existingPlan.destination || {
        address: state.destinationAddress,
        latLng: null
      },
      overallRouteSelection: overallRouteSelection,
      returnWithStopSplitContext: splitContext
    });
    return applySelectedOverallToRoutePlan(routePlan);
  }

  function syncStateFromRoutePlan(routePlan){
    const billedKm = window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, Object.assign({}, state, { routePlan: routePlan }));
    const rideMinutes = window.EstimateCalc.getEffectiveRideMinutes(Object.assign({}, state, { routePlan: routePlan }));
    state.routePlan = routePlan;
    state.distanceKm = billedKm;
    state.distanceInputText = String(billedKm);
    state.routeCalcResult = {
      distanceKm: billedKm,
      durationMinutes: rideMinutes,
      outboundDistanceKm: routePlan.outboundRoutePlan
        ? Math.round((Number(window.EstimateCalc.getLegPrimaryRoute(routePlan.outboundRoutePlan)?.distanceMeters || 0) / 1000) * 10) / 10
        : billedKm,
      returnDistanceKm: routePlan.returnRoutePlan
        ? Math.round((Number(window.EstimateCalc.getLegPrimaryRoute(routePlan.returnRoutePlan)?.distanceMeters || 0) / 1000) * 10) / 10
        : 0
    };
  }

  function computeResultForRoute(route, legKey){
    if(!route || !state.config || !state.routePlan){
      return null;
    }
    const key = legKey === "return" ? "return" : "outbound";
    if(state.routePlan.outboundRoutePlan){
      const outboundLeg = key === "outbound"
        ? applyRouteToLegPlan(state.routePlan.outboundRoutePlan, route)
        : state.routePlan.outboundRoutePlan;
      const returnLeg = key === "return"
        ? applyRouteToLegPlan(state.routePlan.returnRoutePlan, route)
        : state.routePlan.returnRoutePlan;
      const routePlan = rebuildRoutePlanFromLegs(outboundLeg, returnLeg);
      return window.EstimateCalc.computeEstimate(state.config, Object.assign({}, state, {
        routePlan: routePlan,
        distanceKm: window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, Object.assign({}, state, { routePlan: routePlan })),
        routeCalcResult: {
          distanceKm: window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, Object.assign({}, state, { routePlan: routePlan })),
          durationMinutes: window.EstimateCalc.getEffectiveRideMinutes(Object.assign({}, state, { routePlan: routePlan }))
        }
      }));
    }
    const tempState = Object.assign({}, state, {
      distanceKm: Number(route.distanceKm) || 0,
      routeCalcResult: {
        distanceKm: Number(route.distanceKm) || 0,
        durationMinutes: Number(route.durationMinutes) || 0
      },
      routePlan: Object.assign({}, state.routePlan, {
        selectedRouteId: String(route.routeId || ""),
        distanceMeters: Number(route.distanceMeters) || 0,
        durationSeconds: Number(route.durationSeconds) || 0,
        encodedPolyline: String(route.encodedPolyline || ""),
        routeToken: String(route.routeToken || ""),
        routeLabels: Array.isArray(route.routeLabels) ? route.routeLabels.slice() : [],
        routeLabel: String(route.routeLabel || ""),
        routeDescription: String(route.routeDescription || ""),
        routeSummary: String(route.routeSummary || route.routeLabel || ""),
        routeStrategy: route.routeStrategy || null,
        routeSource: route.routeSource || null,
        roadType: String(route.roadType || state.routePlan.roadType || state.roadType || "general"),
        tollInfo: route.tollInfo || null,
        tollPreference: route.tollPreference || null,
        tollExcludedFromFare: route.tollExcludedFromFare === true,
        intermediateWaypoint: route.intermediateWaypoint || null
      })
    });
    return window.EstimateCalc.computeEstimate(state.config, tempState);
  }

  function getCompactRoadTypeLabel(roadType){
    return String(roadType || "") === "toll" ? "高速利用" : "一般道";
  }

  function isFlowComplete(){
    return getStepFlow().every(function(step){
      return isStepComplete(step.id);
    });
  }

  function anyLegRequiresRouteSelection(routePlan){
    if(!routePlan){
      return false;
    }
    if(isOverallRouteSelectionMode(routePlan)){
      return false;
    }
    const outbound = routePlan.outboundRoutePlan || routePlan;
    if(legRequiresRouteSelection(outbound)){
      return true;
    }
    const returnLeg = routePlan.returnRoutePlan;
    if(returnLeg && legRequiresRouteSelection(returnLeg)){
      return true;
    }
    return false;
  }

  function shouldAutoAcknowledgeRouteReview(routePlan){
    if(!routePlan || !isPreFixedFareMode()){
      return false;
    }
    if(requiresOverallRouteSelection(routePlan)){
      return false;
    }
    return !anyLegRequiresRouteSelection(routePlan);
  }

  function getReservationReviewNotice(){
    if(!isPreFixedFareMode() || isPreFixedFareConfirmable() || !state.routePlan){
      return "";
    }
    const statusOptions = {
      returnPlanType: getActiveReturnPlanType(),
      outboundRoutePlan: state.routePlan.outboundRoutePlan || null,
      returnRoutePlan: state.routePlan.returnRoutePlan || null
    };
    if(window.PreFixedFareStatus?.shouldShowSingleCandidateNotice?.(state.routePlan, statusOptions)){
      return window.PreFixedFareStatus.getSingleCandidateNotice();
    }
    return "この見積は確認対応が必要です。予約後に内容を確認いたします。";
  }

  function getReservationCtaLabel(){
    if(isPreFixedFareMode() && !isPreFixedFareConfirmable()){
      return "確認対応として予約へ進む";
    }
    return "この内容で予約する";
  }

  function getRouteCalcButtonLabel(){
    if(state.routeCalcLoading){
      return "計算中...";
    }
    return state.hasRouteCalculatedOnce ? "再計算する" : "ルート計算をする";
  }

  function shouldShowMobileReservationBar(result){
    if(!result || !(Number(result.total) > 0)){
      return false;
    }
    if(!isFlowComplete()){
      return false;
    }
    if(!state.routePlan){
      return false;
    }
    if(isPreFixedFareMode() && !isRouteReviewComplete(state.routePlan)){
      return false;
    }
    return true;
  }

  function renderMobileReservationBar(result){
    if(!shouldShowMobileReservationBar(result)){
      return "";
    }
    return (
      '<div class="estimate-mobile-reserve-bar" id="estimateMobileReserveBar" hidden>' +
        '<div class="estimate-mobile-reserve-bar-inner">' +
          '<div class="estimate-mobile-reserve-bar-amount">' +
            '<span class="estimate-mobile-reserve-bar-label">事前確定運賃</span>' +
            '<span class="estimate-mobile-reserve-bar-value">' + escapeHtml(formatResultTotalAmount(result.total)) + "</span>" +
          "</div>" +
          '<a class="estimate-mobile-reserve-bar-btn" id="estimateMobileReserveBarBtn" href="' + escapeAttr(getReservationUrl()) + '" rel="noopener noreferrer">' +
            escapeHtml(getReservationCtaLabel()) +
          "</a>" +
        "</div>" +
      "</div>"
    );
  }

  function disconnectMobileReserveBarObserver(){
    if(mobileReserveBarObserver){
      mobileReserveBarObserver.disconnect();
      mobileReserveBarObserver = null;
    }
  }

  function setMobileReserveBarVisible(visible){
    const bar = document.getElementById("estimateMobileReserveBar");
    const page = document.querySelector(".estimate-page") || document.body;
    if(!bar){
      page.classList.remove("estimate-has-mobile-reserve-bar");
      return;
    }
    if(visible){
      bar.hidden = false;
      page.classList.add("estimate-has-mobile-reserve-bar");
    }else{
      bar.hidden = true;
      page.classList.remove("estimate-has-mobile-reserve-bar");
    }
  }

  function bindMobileReserveBarVisibility(){
    disconnectMobileReserveBarObserver();
    if(!mobileReserveBarResizeBound){
      mobileReserveBarResizeBound = true;
      window.addEventListener("resize", function(){
        if(mobileReserveBarResizeTimer){
          clearTimeout(mobileReserveBarResizeTimer);
        }
        mobileReserveBarResizeTimer = setTimeout(function(){
          bindMobileReserveBarVisibility();
        }, 150);
      });
    }
    const bar = document.getElementById("estimateMobileReserveBar");
    if(!bar){
      setMobileReserveBarVisible(false);
      return;
    }
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
    if(!isMobile){
      setMobileReserveBarVisible(false);
      return;
    }
    const primaryCta = document.getElementById("estimateResultReservationCta");
    if(!primaryCta || typeof IntersectionObserver !== "function"){
      setMobileReserveBarVisible(true);
      return;
    }
    mobileReserveBarObserver = new IntersectionObserver(function(entries){
      const entry = entries[0];
      const primaryVisible = Boolean(entry && entry.isIntersecting && entry.intersectionRatio > 0);
      setMobileReserveBarVisible(!primaryVisible);
    }, {
      root: null,
      threshold: [0, 0.1, 0.25, 0.5, 1]
    });
    mobileReserveBarObserver.observe(primaryCta);
    const rect = primaryCta.getBoundingClientRect();
    const primaryVisible = rect.top < window.innerHeight && rect.bottom > 0;
    setMobileReserveBarVisible(!primaryVisible);
  }

  function getDistanceRouteProceedLabel(){
    if(isPreFixedFareMode() && state.routePlan && !anyLegRequiresRouteSelection(state.routePlan)){
      return "この内容で予約へ進む";
    }
    return "見積結果を表示する";
  }

  function needsDistanceRouteReview(){
    return isPreFixedFareMode() && Boolean(state.routePlan) && state.distanceRouteReviewed !== true;
  }

  function acknowledgeDistanceRouteReview(){
    if(!state.routePlan){
      return;
    }
    state.distanceRouteReviewed = true;
    invalidateEstimateNumberIfChanged();
    state.lastActiveStepId = "result";
    renderPage();
  }

  function getRouteStrategyKey(route){
    return String(route?.routeStrategy || route?.routeType || route?.strategy || "").trim();
  }

  function findRouteCandidateByStrategy(legPlan, strategy){
    const target = String(strategy || "").trim();
    if(!legPlan || !target){
      return null;
    }
    return getRouteCandidatesFromLeg(legPlan).find(function(item){
      return getRouteStrategyKey(item) === target;
    }) || null;
  }

  function getRoundTripPairStrategies(){
    return [
      {
        strategy: "time_priority",
        abLabel: "A",
        label: "時間優先の往復ルート",
        shortLabel: "時間優先の往復"
      },
      {
        strategy: "general_road_priority",
        abLabel: "B",
        label: "一般道優先の往復ルート",
        shortLabel: "一般道優先の往復"
      }
    ];
  }

  function getRouteAbInfo(strategyOrRoute, options){
    const strategy = typeof strategyOrRoute === "string"
      ? String(strategyOrRoute || "").trim()
      : getRouteStrategyKey(strategyOrRoute);
    const isRoundTrip = options?.roundTrip === true;
    if(strategy === "time_priority"){
      return {
        abLabel: "A",
        strategy: strategy,
        fullLabel: isRoundTrip ? "時間優先の往復ルート" : "時間優先ルート",
        shortLabel: isRoundTrip ? "時間優先の往復" : "時間優先",
        colorClass: "a"
      };
    }
    if(strategy === "general_road_priority"){
      return {
        abLabel: "B",
        strategy: strategy,
        fullLabel: isRoundTrip ? "一般道優先の往復ルート" : "一般道優先ルート",
        shortLabel: isRoundTrip ? "一般道優先の往復" : "一般道優先",
        colorClass: "b"
      };
    }
    return null;
  }

  function renderRouteAbBadge(abInfo){
    if(!abInfo?.abLabel){
      return "";
    }
    return (
      '<span class="estimate-route-ab-badge estimate-route-ab-badge--' + escapeAttr(abInfo.colorClass || abInfo.abLabel.toLowerCase()) + '" aria-hidden="true">' +
        escapeHtml(abInfo.abLabel) +
      "</span>"
    );
  }

  function renderRouteCardTitle(abInfo, fallbackLabel){
    if(abInfo){
      return (
        '<div class="estimate-route-card-head">' +
          renderRouteAbBadge(abInfo) +
          '<div class="estimate-route-card-titles">' +
            '<div class="estimate-route-card-title-full">' + escapeHtml(abInfo.abLabel + " " + abInfo.fullLabel) + "</div>" +
            '<div class="estimate-route-card-title-short">' + escapeHtml(abInfo.abLabel + " " + abInfo.shortLabel) + "</div>" +
          "</div>" +
        "</div>"
      );
    }
    return (
      '<div class="estimate-route-card-head">' +
        '<div class="estimate-route-card-titles">' +
          '<div class="estimate-route-card-title-full">' + escapeHtml(fallbackLabel || "ルート候補") + "</div>" +
          '<div class="estimate-route-card-title-short">' + escapeHtml(fallbackLabel || "ルート候補") + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function areRouteMetricsNearlyIdentical(left, right){
    if(!left || !right){
      return false;
    }
    const leftDistance = formatRouteDistanceMeters(left.distanceMeters);
    const rightDistance = formatRouteDistanceMeters(right.distanceMeters);
    const leftDuration = formatRouteDurationSeconds(left.durationSeconds);
    const rightDuration = formatRouteDurationSeconds(right.durationSeconds);
    if(!leftDistance || !rightDistance || !leftDuration || !rightDuration){
      return false;
    }
    return leftDistance === rightDistance && leftDuration === rightDuration;
  }

  function buildSimilarAbRoutesNotice(metricsList){
    if(!Array.isArray(metricsList) || metricsList.length < 2){
      return "";
    }
    const baseline = metricsList[0];
    const allSimilar = metricsList.every(function(item){
      return areRouteMetricsNearlyIdentical(baseline, item);
    });
    if(!allSimilar){
      return "";
    }
    return '<p class="estimate-route-selection-similar-note">近距離のため、A/Bともほぼ同じルートです。</p>';
  }

  function getRouteSelectButtonLabel(isSelected, options){
    const roundTrip = options?.roundTrip === true;
    if(isSelected){
      return roundTrip ? "この往復ルートを選択中" : "このルートを選択中";
    }
    return roundTrip ? "この往復ルートを選択" : "このルートを選択";
  }

  function scrollToRouteResultArea(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        const target = document.querySelector(".estimate-route-preview--inline")
          || document.querySelector("#estimateRouteResultArea")
          || document.querySelector(".estimate-route-result")
          || document.querySelector(".estimate-route-selection");
        if(!target || typeof target.scrollIntoView !== "function"){
          return;
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function buildRoundTripRoutePairs(routePlan){
    const outboundLeg = routePlan?.outboundRoutePlan;
    const returnLeg = routePlan?.returnRoutePlan;
    if(!outboundLeg || !returnLeg){
      return [];
    }
    return getRoundTripPairStrategies().map(function(pair){
      const outboundRoute = findRouteCandidateByStrategy(outboundLeg, pair.strategy);
      const returnRoute = findRouteCandidateByStrategy(returnLeg, pair.strategy);
      if(!outboundRoute || !returnRoute){
        return null;
      }
      const outboundMeters = Number(outboundRoute.distanceMeters) || 0;
      const outboundSeconds = Number(outboundRoute.durationSeconds) || 0;
      const returnMeters = Number(returnRoute.distanceMeters) || 0;
      const returnSeconds = Number(returnRoute.durationSeconds) || 0;
      return {
        strategy: pair.strategy,
        abLabel: pair.abLabel,
        label: pair.label,
        shortLabel: pair.shortLabel,
        outboundRoute: outboundRoute,
        returnRoute: returnRoute,
        outboundDistanceMeters: outboundMeters,
        outboundDurationSeconds: outboundSeconds,
        returnDistanceMeters: returnMeters,
        returnDurationSeconds: returnSeconds,
        totalDistanceMeters: outboundMeters + returnMeters,
        totalDurationSeconds: outboundSeconds + returnSeconds,
        usesToll: outboundRoute.usesToll === true || returnRoute.usesToll === true
          || getRouteStrategyKey(outboundRoute) === "time_priority"
          || getRouteStrategyKey(returnRoute) === "time_priority"
      };
    }).filter(Boolean);
  }

  function canUseRoundTripPairSelection(routePlan){
    if(!routePlan || !isRoundTripActive() || isOverallRouteSelectionMode(routePlan)){
      return false;
    }
    if(!routePlan.outboundRoutePlan || !routePlan.returnRoutePlan){
      return false;
    }
    if(getActiveReturnPlanType() === "return_pending"){
      return false;
    }
    if(!isLegPreFixedFareConfirmable(routePlan.outboundRoutePlan)
      || !isLegPreFixedFareConfirmable(routePlan.returnRoutePlan)){
      return false;
    }
    return buildRoundTripRoutePairs(routePlan).length > 0;
  }

  function getSelectedRoundTripPairStrategy(routePlan){
    const outboundLeg = routePlan?.outboundRoutePlan;
    const returnLeg = routePlan?.returnRoutePlan;
    if(!outboundLeg || !returnLeg){
      return "";
    }
    if(outboundLeg.routeSelectionConfirmed !== true || returnLeg.routeSelectionConfirmed !== true){
      return "";
    }
    const outboundStrategy = getRouteStrategyKey(outboundLeg);
    const returnStrategy = getRouteStrategyKey(returnLeg);
    if(!outboundStrategy || outboundStrategy !== returnStrategy){
      return "";
    }
    return outboundStrategy;
  }

  function applyRoadTypeFromRoute(route){
    if(String(route?.roadType || "") === "toll"){
      state.roadType = "toll";
    }else if(route?.roadType){
      state.roadType = "general";
    }
  }

  function selectRoute(routeId, legKey){
    const key = legKey === "return" ? "return" : "outbound";
    const legPlan = key === "return"
      ? state.routePlan?.returnRoutePlan
      : (state.routePlan?.outboundRoutePlan || state.routePlan);
    if(!legPlan){
      return;
    }
    if(!isLegPreFixedFareConfirmable(legPlan)){
      return;
    }
    const routes = getRouteCandidatesFromLeg(legPlan);
    const route = routes.find(function(item){
      return String(item?.routeId || "") === String(routeId || "");
    });
    if(!route || !state.routePlan){
      return;
    }
    applyRoadTypeFromRoute(route);
    if(state.routePlan.outboundRoutePlan){
      const outboundLeg = key === "outbound"
        ? applyRouteToLegPlan(state.routePlan.outboundRoutePlan, route)
        : state.routePlan.outboundRoutePlan;
      const returnLeg = key === "return"
        ? applyRouteToLegPlan(state.routePlan.returnRoutePlan, route)
        : state.routePlan.returnRoutePlan;
      syncStateFromRoutePlan(rebuildRoutePlanFromLegs(outboundLeg, returnLeg));
    }else{
      state.routePlan = Object.assign({}, state.routePlan, applyRouteToLegPlan(state.routePlan, route));
      state.distanceKm = Number(route.distanceKm) || 0;
      state.distanceInputText = String(state.distanceKm);
      state.routeCalcResult = {
        distanceKm: Number(route.distanceKm) || 0,
        durationMinutes: Number(route.durationMinutes) || 0
      };
    }
    invalidateEstimateNumberIfChanged();
    state.distanceRouteReviewed = isRouteReviewComplete(state.routePlan);
    state.lastActiveStepId = isFlowComplete() ? "result" : "distance";
    renderPage();
  }

  function selectRoundTripRoutePair(strategy){
    if(!state.routePlan || !canUseRoundTripPairSelection(state.routePlan)){
      return;
    }
    const pair = buildRoundTripRoutePairs(state.routePlan).find(function(item){
      return item.strategy === strategy;
    });
    if(!pair){
      return;
    }
    applyRoadTypeFromRoute(pair.outboundRoute);
    const outboundLeg = applyRouteToLegPlan(state.routePlan.outboundRoutePlan, pair.outboundRoute);
    const returnLeg = applyRouteToLegPlan(state.routePlan.returnRoutePlan, pair.returnRoute);
    syncStateFromRoutePlan(rebuildRoutePlanFromLegs(outboundLeg, returnLeg));
    invalidateEstimateNumberIfChanged();
    state.distanceRouteReviewed = isRouteReviewComplete(state.routePlan);
    state.lastActiveStepId = isFlowComplete() ? "result" : "distance";
    renderPage();
  }

  function computeResultForRoundTripPair(pair){
    if(!pair || !state.config || !state.routePlan){
      return null;
    }
    const outboundLeg = applyRouteToLegPlan(state.routePlan.outboundRoutePlan, pair.outboundRoute);
    const returnLeg = applyRouteToLegPlan(state.routePlan.returnRoutePlan, pair.returnRoute);
    const routePlan = rebuildRoutePlanFromLegs(outboundLeg, returnLeg);
    return window.EstimateCalc.computeEstimate(state.config, Object.assign({}, state, {
      routePlan: routePlan,
      distanceKm: window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, Object.assign({}, state, { routePlan: routePlan })),
      routeCalcResult: {
        distanceKm: window.EstimateCalc.getEffectiveBilledDistanceKm(state.config, Object.assign({}, state, { routePlan: routePlan })),
        durationMinutes: window.EstimateCalc.getEffectiveRideMinutes(Object.assign({}, state, { routePlan: routePlan }))
      }
    }));
  }

  function selectOverallRoute(routeId){
    if(!state.routePlan || !requiresOverallRouteSelection(state.routePlan)){
      return;
    }
    const overall = getOverallRouteSelection(state.routePlan);
    const candidate = getOverallRouteCandidates(state.routePlan).find(function(item){
      return String(item?.routeId || "") === String(routeId || "");
    });
    if(!overall || !candidate){
      return;
    }
    const updatedOverall = Object.assign({}, overall, {
      selectedOverallRouteId: String(routeId),
      selectionPhase: "completed"
    });
    const outboundLeg = state.routePlan.outboundRoutePlan;
    const returnLeg = state.routePlan.returnRoutePlan;
    syncStateFromRoutePlan(rebuildRoutePlanFromLegs(outboundLeg, returnLeg, {
      overallRouteSelection: updatedOverall
    }));
    invalidateEstimateNumberIfChanged();
    state.distanceRouteReviewed = isRouteReviewComplete(state.routePlan);
    state.lastActiveStepId = isFlowComplete() ? "result" : "distance";
    renderPage();
  }

  function renderRoundTripRoutePairSelectionSection(options){
    const routePlan = state.routePlan;
    const pairs = buildRoundTripRoutePairs(routePlan);
    if(!pairs.length){
      return "";
    }
    const selectedStrategy = getSelectedRoundTripPairStrategy(routePlan);
    const compact = options?.compact === true;
    const stepReviewPending = compact && isPreFixedFareMode() && !state.distanceRouteReviewed;
    const notice = '<p class="estimate-route-selection-note">往復の走行予定ルートを1つ選択してください。選択した往復ルートの合計距離で事前確定運賃を算定します。</p>';
    const similarNotice = buildSimilarAbRoutesNotice(pairs.map(function(pair){
      return {
        distanceMeters: pair.totalDistanceMeters,
        durationSeconds: pair.totalDurationSeconds
      };
    }));
    const useAbLayout = pairs.length === 2 && pairs.every(function(pair){
      return Boolean(getRouteAbInfo(pair.strategy, { roundTrip: true }));
    });
    const cards = pairs.map(function(pair){
      const isSelected = pair.strategy === selectedStrategy;
      const abInfo = getRouteAbInfo(pair.strategy, { roundTrip: true });
      const outboundDistanceLabel = formatRouteDistanceMeters(pair.outboundDistanceMeters);
      const outboundDurationLabel = formatRouteDurationSeconds(pair.outboundDurationSeconds);
      const returnDistanceLabel = formatRouteDistanceMeters(pair.returnDistanceMeters);
      const returnDurationLabel = formatRouteDurationSeconds(pair.returnDurationSeconds);
      const totalDistanceLabel = formatRouteDistanceMeters(pair.totalDistanceMeters);
      const totalDurationLabel = formatRouteDurationSeconds(pair.totalDurationSeconds);
      const pairResult = computeResultForRoundTripPair(pair);
      const preFixedAmount = Number(pairResult?.quoteSnapshot?.adjustedDistanceFareAmount) || 0;
      const fareLabel = preFixedAmount > 0
        ? formatYen(preFixedAmount)
        : (pairResult ? formatYen(pairResult.total) : "-");
      const tollNote = pair.usesToll
        ? "有料道路料金は見積料金に含まれず、別途必要です。"
        : "";
      const showAsSelected = !stepReviewPending && isSelected;
      const selectLabel = getRouteSelectButtonLabel(showAsSelected, { roundTrip: true });
      const selectDisabled = showAsSelected;
      const titleHtml = renderRouteCardTitle(abInfo, pair.label);
      const metaHtml = (
        '<div class="estimate-roundtrip-pair-meta">' +
          "<div>行き：" + escapeHtml(outboundDistanceLabel || "-") + "　" + escapeHtml(outboundDurationLabel || "-") + "</div>" +
          "<div>帰り：" + escapeHtml(returnDistanceLabel || "-") + "　" + escapeHtml(returnDurationLabel || "-") + "</div>" +
          "<div class=\"estimate-roundtrip-pair-total\">合計：" + escapeHtml(totalDistanceLabel || "-") + "　" + escapeHtml(totalDurationLabel || "-") + "</div>" +
        "</div>"
      );

      if(compact){
        return (
          '<article class="estimate-route-card estimate-route-card--compact estimate-roundtrip-pair-card' + (isSelected ? " is-selected" : "") + (abInfo ? " estimate-route-card--ab-" + abInfo.colorClass : "") + '">' +
            titleHtml +
            metaHtml +
            (tollNote
              ? '<p class="estimate-route-card-toll-note">' + escapeHtml(tollNote) + "</p>"
              : "") +
            '<button type="button" class="estimate-route-select-btn' + (showAsSelected ? " is-selected" : "") + '" data-select-roundtrip-pair="' + escapeAttr(pair.strategy) + '"' + (selectDisabled ? " disabled" : "") + ">" + escapeHtml(selectLabel) + "</button>" +
          "</article>"
        );
      }

      return (
        '<article class="estimate-route-card estimate-roundtrip-pair-card' + (isSelected ? " is-selected" : "") + (abInfo ? " estimate-route-card--ab-" + abInfo.colorClass : "") + '">' +
          titleHtml +
          (tollNote
            ? '<p class="estimate-route-card-toll-note">' + escapeHtml(tollNote) + "</p>"
            : "") +
          metaHtml +
          '<dl class="estimate-route-card-meta estimate-route-card-meta--fare-only">' +
            '<div><dt>事前確定運賃</dt><dd class="estimate-route-card-fare">' + escapeHtml(fareLabel) + "</dd></div>" +
          "</dl>" +
          '<button type="button" class="estimate-route-select-btn' + (isSelected ? " is-selected" : "") + '" data-select-roundtrip-pair="' + escapeAttr(pair.strategy) + '"' + (isSelected ? " disabled" : "") + ">" + escapeHtml(getRouteSelectButtonLabel(isSelected, { roundTrip: true })) + "</button>" +
        "</article>"
      );
    }).join("");

    return (
      '<section class="estimate-route-selection estimate-roundtrip-pair-selection" aria-label="往復ルートの選択">' +
        '<h4 class="estimate-route-selection-title">往復ルートの選択</h4>' +
        notice +
        similarNotice +
        '<div class="estimate-route-card-list' + (useAbLayout ? " estimate-route-card-list--ab" : "") + '">' + cards + "</div>" +
      "</section>"
    );
  }

  function renderOverallRouteSelectionSection(){
    const routePlan = state.routePlan;
    if(!routePlan || !requiresOverallRouteSelection(routePlan)){
      return "";
    }
    const candidates = getOverallRouteCandidates(routePlan);
    const overall = getOverallRouteSelection(routePlan);
    const selectedId = String(overall?.selectedOverallRouteId || "");
    const pathLabel = getOverallRoutePathLabel(routePlan);
    const description = (
      "復路は、目的地 → 立ち寄り先 → 出発地の指定ルートで距離を算定します。" +
      "目的地 → 立ち寄り先 までは共通です。" +
      "立ち寄り先 → 出発地 の区間で異なる走行予定ルートを含め、以下の全体走行予定ルートから選択できます。"
    );
    const cards = candidates.map(function(candidate, index){
      const routeId = String(candidate.routeId || "");
      const isSelected = routeId && routeId === selectedId;
      const routeLabel = String(candidate.routeLabel || ("全体候補 " + (index + 1)));
      const routeDescription = String(candidate.routeDescription || "");
      const distanceLabel = formatRouteDistanceMeters(candidate.totalDistanceMeters);
      const durationLabel = formatRouteDurationSeconds(candidate.totalDurationSeconds);
      const tollLabel = candidate.usesToll === true ? "有料道路利用" : "一般道利用";
      const tollNote = candidate.usesToll === true || candidate.strategy === "toll_allowed" || candidate.routeType === "toll_allowed"
        ? '<p class="estimate-route-card-toll-note">有料道路料金は見積料金に含まれず、別途必要です。</p>'
        : "";
      return (
        '<article class="estimate-route-card estimate-route-card--compact estimate-overall-route-card' + (isSelected ? " is-selected" : "") + '">' +
          '<div class="estimate-route-card-compact-head">全体候補：' + escapeHtml(routeLabel) + "</div>" +
          '<p class="estimate-overall-route-path">' + escapeHtml(pathLabel) + "</p>" +
          (routeDescription
            ? '<p class="estimate-route-card-description estimate-route-card-description--compact">' + escapeHtml(routeDescription) + "</p>"
            : "") +
          '<div class="estimate-route-card-compact-meta">' +
            escapeHtml(tollLabel) + "　合計 " + escapeHtml(distanceLabel || "-") + "　" + escapeHtml(durationLabel || "-") +
          "</div>" +
          tollNote +
          '<button type="button" class="estimate-route-select-btn" data-select-overall-route-id="' + escapeAttr(routeId) + '"' + (isSelected ? " disabled" : "") + ">" + (isSelected ? "選択中" : "このルートを選択") + "</button>" +
        "</article>"
      );
    }).join("");

    return (
      '<section class="estimate-route-selection estimate-overall-route-selection" aria-label="全体走行予定ルートの選択">' +
        '<h4 class="estimate-route-selection-title">全体走行予定ルートの選択</h4>' +
        '<p class="estimate-route-selection-note">' + escapeHtml(description) + "</p>" +
        '<p class="estimate-route-selection-note">2件以上の全体走行予定ルートから1つを選択してください。</p>' +
        '<div class="estimate-route-card-list">' + cards + "</div>" +
      "</section>"
    );
  }

  function renderRouteSelectionCards(legPlan, legKey, sectionTitle, options){
    const routes = getRouteCandidatesFromLeg(legPlan);
    if(!routes.length){
      return "";
    }
    const confirmable = isLegPreFixedFareConfirmable(legPlan);
    const selectedId = String(legPlan.selectedRouteId || routes[0]?.routeId || "");
    const singleCandidateNotice = window.PreFixedFareStatus?.getSingleCandidateNotice?.()
      || "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。";
    const notice = confirmable
      ? '<p class="estimate-route-selection-note">2件以上の走行予定ルートから1つを選択してください。選択したルートの距離で事前確定運賃を算定します。</p>'
      : '<p class="estimate-route-selection-warning">' + escapeHtml(singleCandidateNotice) + "</p>";
    const abRoutes = routes.filter(function(route){
      return Boolean(getRouteAbInfo(route));
    });
    const useAbLayout = abRoutes.length >= 2;
    const similarNotice = useAbLayout
      ? buildSimilarAbRoutesNotice(abRoutes.map(function(route){
        return {
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds
        };
      }))
      : "";

    const compact = options?.compact === true;
    const stepReviewPending = compact && isPreFixedFareMode() && !state.distanceRouteReviewed;
    const cards = routes.map(function(route, index){
      const routeId = String(route.routeId || "");
      const isSelected = routeId === selectedId || (!selectedId && index === 0);
      const routeResult = computeResultForRoute(route, legKey);
      const preFixedAmount = Number(routeResult?.quoteSnapshot?.adjustedDistanceFareAmount) || 0;
      const fareLabel = preFixedAmount > 0
        ? formatYen(preFixedAmount)
        : (routeResult ? formatYen(routeResult.total) : "-");
      const distanceLabel = formatRouteDistanceMeters(route.distanceMeters);
      const durationLabel = formatRouteDurationSeconds(route.durationSeconds);
      const summary = getRouteDisplayLabel(route, index);
      const description = getRouteDisplayDescription(route);
      const roadTypeLabel = getRoadTypeLabel(route.roadType || legPlan.roadType || state.roadType);
      const abInfo = getRouteAbInfo(route);
      const tollNote = route.usesToll === true || route.routeStrategy === "toll_allowed" || route.routeStrategy === "time_priority"
        ? "有料道路料金は見積料金に含まれず、別途必要です。"
        : "";
      const waypointLabel = route.intermediateWaypoint?.waypointLabel
        ? String(route.intermediateWaypoint.waypointLabel)
        : "";
      const showAsSelected = !stepReviewPending && isSelected;
      const selectLabel = getRouteSelectButtonLabel(showAsSelected);
      const titleHtml = renderRouteCardTitle(abInfo, summary);
      const cardClass = "estimate-route-card"
        + (compact ? " estimate-route-card--compact" : "")
        + (isSelected ? " is-selected" : "")
        + (abInfo ? " estimate-route-card--ab-" + abInfo.colorClass : "");

      if(compact){
        return (
          '<article class="' + cardClass + '">' +
            titleHtml +
            (description
              ? '<p class="estimate-route-card-description estimate-route-card-description--compact">' + escapeHtml(description) + "</p>"
              : "") +
            '<div class="estimate-route-card-compact-meta">' +
              escapeHtml(distanceLabel || "-") + "　" + escapeHtml(durationLabel || "-") +
            "</div>" +
            (confirmable
              ? '<button type="button" class="estimate-route-select-btn' + (showAsSelected ? " is-selected" : "") + '" data-select-route-id="' + escapeAttr(routeId) + '" data-select-route-leg="' + escapeAttr(legKey) + '"' + (showAsSelected ? " disabled" : "") + ">" + escapeHtml(selectLabel) + "</button>"
              : "") +
          "</article>"
        );
      }

      return (
        '<article class="' + cardClass + '">' +
          titleHtml +
          (description
            ? '<p class="estimate-route-card-description">' + escapeHtml(description) + "</p>"
            : "") +
          (tollNote
            ? '<p class="estimate-route-card-toll-note">' + escapeHtml(tollNote) + "</p>"
            : "") +
          '<dl class="estimate-route-card-meta">' +
            "<div><dt>距離</dt><dd>" + escapeHtml(distanceLabel || "-") + "</dd></div>" +
            "<div><dt>予定時間</dt><dd>" + escapeHtml(durationLabel || "-") + "</dd></div>" +
            "<div><dt>有料道路利用</dt><dd>" + escapeHtml(roadTypeLabel) + "</dd></div>" +
            (waypointLabel
              ? "<div><dt>主要経由</dt><dd>" + escapeHtml(waypointLabel) + "</dd></div>"
              : "") +
            '<div><dt>事前確定運賃</dt><dd class="estimate-route-card-fare">' + escapeHtml(fareLabel) + "</dd></div>" +
          "</dl>" +
          (confirmable
            ? '<button type="button" class="estimate-route-select-btn' + (isSelected ? " is-selected" : "") + '" data-select-route-id="' + escapeAttr(routeId) + '" data-select-route-leg="' + escapeAttr(legKey) + '"' + (isSelected ? " disabled" : "") + ">" + escapeHtml(getRouteSelectButtonLabel(isSelected)) + "</button>"
            : "") +
        "</article>"
      );
    }).join("");

    return (
      '<section class="estimate-route-selection' + (confirmable ? "" : " estimate-route-selection--fallback") + '" aria-label="' + escapeAttr(sectionTitle) + '">' +
        '<h4 class="estimate-route-selection-title">' + escapeHtml(sectionTitle) + "</h4>" +
        notice +
        similarNotice +
        '<div class="estimate-route-card-list' + (useAbLayout ? " estimate-route-card-list--ab" : "") + '">' + cards + "</div>" +
      "</section>"
    );
  }

  function renderRouteSelectionSection(result, options){
    logRouteUiState(result);

    if(!isPreFixedFareMode()){
      return "";
    }
    const selectionOptions = Object.assign({ compact: false }, options || {});
    if(!state.routePlan){
      return (
        '<section class="estimate-route-selection estimate-route-selection--fallback" aria-label="ルート候補の選択">' +
          '<h4 class="estimate-route-selection-title">走行予定ルートの選択</h4>' +
          '<p class="estimate-route-selection-warning">走行予定ルートを取得できませんでした。出発地・目的地を入力して距離を計算してください。</p>' +
        "</section>"
      );
    }

    if(state.routePlan.outboundRoutePlan){
      const pendingNotice = getActiveReturnPlanType() === "return_pending"
        ? '<p class="estimate-route-selection-warning">復路は帰り未定のため確認対応です。往路のみ事前確定運賃候補として算定します。</p>'
        : "";
      if(canUseRoundTripPairSelection(state.routePlan)){
        return pendingNotice + renderRoundTripRoutePairSelectionSection(selectionOptions);
      }
      const outboundNeedsSelection = isLegPreFixedFareConfirmable(state.routePlan.outboundRoutePlan);
      const outboundSection = outboundNeedsSelection
        ? renderRouteSelectionCards(
          state.routePlan.outboundRoutePlan,
          "outbound",
          "往路の走行予定ルートの選択",
          selectionOptions
        )
        : "";
      const overallSection = isOverallRouteSelectionMode(state.routePlan)
        ? renderOverallRouteSelectionSection()
        : "";
      const returnSection = (!isOverallRouteSelectionMode(state.routePlan) && state.routePlan.returnRoutePlan)
        ? renderRouteSelectionCards(
          state.routePlan.returnRoutePlan,
          "return",
          "復路の走行予定ルートの選択",
          selectionOptions
        )
        : "";
      if(!outboundSection && !returnSection && !overallSection){
        return (
          '<section class="estimate-route-selection estimate-route-selection--fallback" aria-label="ルート候補の選択">' +
            '<h4 class="estimate-route-selection-title">走行予定ルートの選択</h4>' +
            '<p class="estimate-route-selection-warning">走行予定ルートを取得できませんでした。距離を手入力するか、住所を確認して再度お試しください。</p>' +
          "</section>"
        );
      }
      return pendingNotice + outboundSection + overallSection + returnSection;
    }

    const routes = getRouteCandidatesFromPlan(state.routePlan);
    if(!routes.length){
      return (
        '<section class="estimate-route-selection estimate-route-selection--fallback" aria-label="ルート候補の選択">' +
          '<h4 class="estimate-route-selection-title">走行予定ルートの選択</h4>' +
          '<p class="estimate-route-selection-warning">走行予定ルートを取得できませんでした。距離を手入力するか、住所を確認して再度お試しください。</p>' +
        "</section>"
      );
    }

    return renderRouteSelectionCards(state.routePlan, "outbound", "走行予定ルートの選択", selectionOptions);
  }

  function renderStepRouteSelection(){
    if(!state.routePlan || !isPreFixedFareMode()){
      return "";
    }
    return renderRouteSelectionSection(window.EstimateCalc.computeEstimate(state.config, state), { compact: true })
      + renderDistanceRouteReviewActions();
  }

  function renderDistanceRouteReviewActions(){
    if(!needsDistanceRouteReview()){
      return "";
    }
    if(anyLegRequiresRouteSelection(state.routePlan)){
      return '<p class="estimate-route-selection-note">ルート候補を選択すると見積結果へ進みます。</p>';
    }
    if(requiresOverallRouteSelection(state.routePlan) && !hasOverallRouteSelected(state.routePlan)){
      return '<p class="estimate-route-selection-note">全体走行予定ルートを選択すると見積結果へ進みます。</p>';
    }
    const reviewNotice = getReservationReviewNotice();
    return (
      '<div class="estimate-distance-route-review-actions">' +
        (reviewNotice
          ? '<p class="estimate-reservation-review-notice">' + escapeHtml(reviewNotice) + "</p>"
          : "") +
        '<button type="button" class="estimate-calc-distance-btn estimate-distance-route-ack-btn" data-distance-route-acknowledge="1">' +
          escapeHtml(getDistanceRouteProceedLabel()) +
        "</button>" +
      "</div>"
    );
  }

  async function resolveRouteMapWaypointLatLng(routePlan){
    const display = window.EstimateRouteMapDisplay;
    if(!display || typeof display.resolveWaypointLatLng !== "function"){
      return null;
    }
    const mapsConfig = getGoogleMapsConfig();
    const apiKey = String(mapsConfig.apiKey || "").trim();
    if(!apiKey || !window.EstimateDistanceApi || typeof window.EstimateDistanceApi.geocodeAddress !== "function"){
      return display.resolveWaypointLatLng(routePlan, null);
    }
    return display.resolveWaypointLatLng(routePlan, async function(address){
      const result = await window.EstimateDistanceApi.geocodeAddress({
        apiKey: apiKey,
        address: address,
        languageCode: mapsConfig.language || "ja",
        region: mapsConfig.region || "JP"
      });
      return result?.location || null;
    }, state.returnStopAddress);
  }

  async function renderRouteMapIfNeeded(){
    const mapContainers = document.querySelectorAll(".estimate-route-map");
    if(!mapContainers.length) return;

    const mapsConfig = getGoogleMapsConfig();
    const display = window.EstimateRouteMapDisplay;
    if(mapsConfig.enabled === false){
      mapContainers.forEach(function(mapContainer){
        mapContainer.innerHTML = '<p class="estimate-route-map-error">地図表示は現在無効です。</p>';
      });
      return;
    }

    const routePlan = state.routePlan;
    if(!display || typeof display.buildRouteMapSegments !== "function"){
      mapContainers.forEach(function(mapContainer){
        mapContainer.innerHTML = '<p class="estimate-route-map-error">地図表示機能が読み込まれていません。</p>';
      });
      return;
    }
    if(!routePlan || !display.hasRenderableRouteMap(routePlan)){
      mapContainers.forEach(function(mapContainer){
        mapContainer.innerHTML = '<p class="estimate-route-map-error">ルート情報が取得できないため地図を表示できません。</p>';
      });
      return;
    }

    const waypointLatLng = await resolveRouteMapWaypointLatLng(routePlan);
    const abSegments = typeof display.buildAbRouteMapSegments === "function"
      ? display.buildAbRouteMapSegments(routePlan)
      : [];
    const useAbSegments = abSegments.some(function(segment){
      return segment.key === "routeA";
    }) && abSegments.some(function(segment){
      return segment.key === "routeB";
    });
    const segments = useAbSegments
      ? abSegments
      : display.buildRouteMapSegments(routePlan, waypointLatLng);
    const markers = display.buildRouteMapMarkers(routePlan, segments, waypointLatLng);
    const allPoints = display.getAllPathPoints(segments);
    if(allPoints.length < 2){
      mapContainers.forEach(function(mapContainer){
        mapContainer.innerHTML = '<p class="estimate-route-map-error">ルート情報が不足しているため地図を表示できません。</p>';
      });
      return;
    }

    try{
      await loadGoogleMapsJsApi();
      mapContainers.forEach(function(mapContainer){
        const wrap = mapContainer.closest(".estimate-route-map-wrap") || mapContainer.parentElement;
        mapContainer.innerHTML = "";
        if(wrap){
          const existingLegend = wrap.querySelector(".estimate-route-map-legend");
          if(existingLegend){
            existingLegend.remove();
          }
        }

        const map = new window.google.maps.Map(mapContainer, {
          center: allPoints[0],
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        // A(実線)を先に、B(破線)を後に描画し、重なり時も破線で区別できるようにする
        const orderedSegments = useAbSegments
          ? segments.slice().sort(function(left, right){
            if(left.key === right.key){
              return 0;
            }
            return left.key === "routeA" ? -1 : 1;
          })
          : segments;

        orderedSegments.forEach(function(segment){
          if(!segment.path || segment.path.length < 2){
            return;
          }
          const isDashedAbRoute = useAbSegments && (segment.lineStyle === "dashed" || segment.key === "routeB");
          const routeLine = isDashedAbRoute
            ? new window.google.maps.Polyline({
              path: segment.path,
              geodesic: true,
              strokeColor: segment.color,
              strokeOpacity: 0,
              strokeWeight: 5,
              icons: [{
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: 0.95,
                  strokeColor: segment.color,
                  scale: 4,
                  strokeWeight: 2
                },
                offset: "0",
                repeat: "12px"
              }]
            })
            : new window.google.maps.Polyline({
              path: segment.path,
              geodesic: true,
              strokeColor: segment.color,
              strokeOpacity: useAbSegments ? 0.82 : 0.95,
              strokeWeight: useAbSegments ? 6 : 5
            });
          routeLine.setMap(map);
        });

        markers.forEach(function(markerInfo){
          new window.google.maps.Marker({
            position: markerInfo.position,
            map: map,
            title: markerInfo.title,
            label: markerInfo.label
          });
        });

        const bounds = new window.google.maps.LatLngBounds();
        allPoints.forEach(function(point){
          bounds.extend(point);
        });
        map.fitBounds(bounds, 48);

        if(display.shouldShowLegend(segments) && wrap){
          wrap.insertAdjacentHTML("beforeend", display.buildLegendHtml(segments));
        }
      });
    }catch(error){
      mapContainers.forEach(function(mapContainer){
        mapContainer.innerHTML = '<p class="estimate-route-map-error">' + escapeHtml(error?.message || "地図表示に失敗しました。") + "</p>";
      });
    }
  }

  async function calculateRouteDistance(){
    const origin = String(state.originAddress || "").trim();
    const destination = String(state.destinationAddress || "").trim();
    const returnPlanType = getActiveReturnPlanType();

    if(!origin || !destination){
      state.routeCalcError = "出発地と目的地を入力してください。";
      state.routeCalcResult = null;
      updateRouteCalcFeedback();
      return;
    }

    if(isRoundTripActive() && returnPlanType === "return_with_stop" && !String(state.returnStopAddress || "").trim()){
      state.routeCalcError = "立ち寄り先の住所または施設名を入力してください。";
      state.routeCalcResult = null;
      updateRouteCalcFeedback();
      return;
    }

    if(isRoundTripActive() && returnPlanType === "different_return_destination" && !String(state.differentReturnAddress || "").trim()){
      state.routeCalcError = "帰り先の住所または施設名を入力してください。";
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
      const apiOptions = {
        apiKey: apiKey,
        roadType: state.roadType,
        requestPreFixedFareCandidates: isPreFixedFareMode(),
        languageCode: mapsConfig.language || "ja",
        region: mapsConfig.region || "JP"
      };
      const outboundPromise = window.EstimateDistanceApi.computeRouteDistance(Object.assign({}, apiOptions, {
        origin: origin,
        destination: destination
      }));
      const returnRequest = getReturnLegRequest();
      const useReturnWithStopSplit = Boolean(
        returnRequest
        && returnPlanType === "return_with_stop"
        && isPreFixedFareMode()
        && typeof window.EstimateDistanceApi.computeReturnWithStopOverallRouteSelection === "function"
      );
      const returnPromise = returnRequest
        ? (useReturnWithStopSplit
          ? outboundPromise.then(function(outboundResult){
            const outboundRoutes = Array.isArray(outboundResult?.routeCandidates)
              ? outboundResult.routeCandidates
              : (Array.isArray(outboundResult?.routes) ? outboundResult.routes : []);
            const primaryOutbound = outboundRoutes[0] || null;
            return window.EstimateDistanceApi.computeReturnWithStopOverallRouteSelection(Object.assign({}, apiOptions, {
              homeAddress: returnRequest.destination,
              goalAddress: returnRequest.origin,
              stopAddress: returnRequest.intermediateAddress,
              outboundRoute: primaryOutbound,
              outboundRouteCandidates: outboundRoutes
            })).then(function(splitResult){
              return {
                splitResult: splitResult,
                apiResult: splitResult.returnLegApiResult
              };
            });
          })
          : window.EstimateDistanceApi.computeRouteDistance(Object.assign({}, apiOptions, {
            origin: returnRequest.origin,
            destination: returnRequest.destination,
            intermediateAddress: returnRequest.intermediateAddress || ""
          })))
        : Promise.resolve(null);
      const geocodePromise = typeof window.EstimateDistanceApi.geocodeAddress === "function"
        ? window.EstimateDistanceApi.geocodeAddress({
          apiKey: apiKey,
          address: origin,
          languageCode: mapsConfig.language || "ja",
          region: mapsConfig.region || "JP"
        }).catch(function(){
          return null;
        })
        : Promise.resolve(null);
      const stopGeocodePromise = returnRequest?.intermediateAddress && typeof window.EstimateDistanceApi.geocodeAddress === "function"
        ? window.EstimateDistanceApi.geocodeAddress({
          apiKey: apiKey,
          address: returnRequest.intermediateAddress,
          languageCode: mapsConfig.language || "ja",
          region: mapsConfig.region || "JP"
        }).catch(function(){
          return null;
        })
        : Promise.resolve(null);
      const results = await Promise.all([outboundPromise, returnPromise, geocodePromise, stopGeocodePromise]);
      const outboundResult = results[0];
      const returnPayload = results[1];
      const returnResult = returnPayload?.apiResult || returnPayload;
      const returnWithStopSplit = returnPayload?.splitResult || null;
      const geocoding = results[2];
      const stopGeocoding = results[3];

      const outboundLeg = buildLegRoutePlanFromApiResult(origin, destination, null, outboundResult);
      let returnLeg = null;
      if(returnResult && returnRequest){
        const waypoint = returnRequest.intermediateAddress
          ? {
            address: returnRequest.intermediateAddress,
            label: returnRequest.intermediateAddress
          }
          : null;
        returnLeg = buildLegRoutePlanFromApiResult(
          returnRequest.origin,
          returnRequest.destination,
          waypoint,
          returnResult
        );
        if(returnLeg && returnRequest.intermediateAddress){
          const waypointInfo = {
            waypointLabel: returnRequest.intermediateAddress,
            waypointAddress: returnRequest.intermediateAddress
          };
          if(stopGeocoding?.location){
            waypointInfo.waypointLatLng = {
              latitude: stopGeocoding.location.lat,
              longitude: stopGeocoding.location.lng
            };
          }
          const primaryReturnRoute = window.EstimateCalc.getLegPrimaryRoute(returnLeg);
          const routeLegs = Array.isArray(primaryReturnRoute?.routeLegs) ? primaryReturnRoute.routeLegs : [];
          if(!waypointInfo.waypointLatLng && routeLegs.length >= 2){
            const endLatLng = routeLegs[0]?.endLatLng || routeLegs[1]?.startLatLng || null;
            if(endLatLng){
              waypointInfo.waypointLatLng = {
                latitude: endLatLng.lat,
                longitude: endLatLng.lng
              };
            }
          }
          returnLeg.waypoint = Object.assign({}, returnLeg.waypoint || {}, waypointInfo);
          returnLeg.intermediateWaypoint = Object.assign(
            {},
            primaryReturnRoute?.intermediateWaypoint || returnLeg.intermediateWaypoint || {},
            waypointInfo
          );
          if(routeLegs.length){
            returnLeg.routeLegs = routeLegs;
          }
        }
      }

      const routePlan = buildStructuredRoutePlan(outboundLeg, returnLeg, {
        returnPlanType: returnPlanType,
        tripType: isRoundTripActive() ? "round_trip" : "one_way",
        overallRouteSelection: returnWithStopSplit?.overallRouteSelection || null,
        returnWithStopSplitContext: buildReturnWithStopSplitContext(returnRequest, returnWithStopSplit),
        pickup: {
          address: origin,
          latLng: geocoding?.location || null,
          geocoding: geocoding || null
        },
        destination: {
          address: destination,
          latLng: null
        }
      });

      syncStateFromRoutePlan(routePlan);
      state.hasRouteCalculatedOnce = true;
      state.routeCalcError = "";
      state.distanceRouteReviewed = shouldAutoAcknowledgeRouteReview(state.routePlan);
      invalidateEstimateNumberIfChanged();
      state.lastActiveStepId = "distance";
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
      scrollToRouteResultArea();
    }else{
      updateRouteCalcFeedback();
    }
  }

  function updateRouteCalcFeedback(){
    const feedback = document.getElementById("routeCalcFeedback");
    const btn = document.getElementById("calculateDistanceBtn");
    if(btn){
      btn.disabled = state.routeCalcLoading;
      btn.textContent = getRouteCalcButtonLabel();
    }
    if(feedback){
      feedback.textContent = state.routeCalcError || "";
      feedback.className = "estimate-route-feedback" + (state.routeCalcError ? " estimate-route-feedback--error" : "");
    }
  }

  function renderReturnPlanSection(){
    if(!isRoundTripActive()){
      return "";
    }
    const planType = getActiveReturnPlanType();
    const planOptions = [
      { id: "same_return", label: "同じ場所へ戻る" },
      { id: "return_with_stop", label: "帰りに立ち寄る" },
      { id: "different_return_destination", label: "帰り先が違う" },
      { id: "return_pending", label: "帰りは未定・診察後に相談" }
    ];
    const planRadios = planOptions.map(function(option){
      return (
        '<label class="estimate-return-plan-option">' +
          '<input type="radio" name="returnPlanType" value="' + escapeAttr(option.id) + '"' + (planType === option.id ? " checked" : "") + ">" +
          "<span>" + escapeHtml(option.label) + "</span>" +
        "</label>"
      );
    }).join("");

    const stopPanel = planType === "return_with_stop"
      ? (
        '<div class="estimate-return-stop-panel">' +
          '<label for="returnStopAddressInput" class="estimate-distance-label">立ち寄り先住所・施設名</label>' +
          '<input type="text" class="estimate-input" id="returnStopAddressInput" autocomplete="street-address" placeholder="例: 近隣薬局、イオン千葉みなと" value="' + escapeAttr(state.returnStopAddress) + '">' +
        "</div>"
      )
      : "";

    const differentReturnPanel = planType === "different_return_destination"
      ? (
        '<div class="estimate-return-destination-panel">' +
          '<label for="differentReturnAddressInput" class="estimate-distance-label">帰り先住所または施設名</label>' +
          '<input type="text" class="estimate-input" id="differentReturnAddressInput" autocomplete="street-address" placeholder="例: ご自宅、施設名" value="' + escapeAttr(state.differentReturnAddress) + '">' +
        "</div>"
      )
      : "";

    const pendingNotice = planType === "return_pending"
      ? '<p class="estimate-return-plan-pending">帰りのルート・運賃は未確定です。診察終了後の状況により、通常見積または確認対応となります。</p>'
      : "";

    const planNotice = getReturnPlanNotice();

    return (
      '<fieldset class="estimate-return-plan">' +
        '<legend class="estimate-return-plan-legend">帰りの予定</legend>' +
        '<div class="estimate-return-plan-options">' + planRadios + "</div>" +
        stopPanel +
        differentReturnPanel +
        pendingNotice +
        (planNotice ? '<p class="estimate-return-plan-note">' + escapeHtml(planNotice) + "</p>" : "") +
      "</fieldset>"
    );
  }

  function renderDistanceStep(stepNum, step){
    const label = step.title;
    const note = isRoundTripActive()
      ? "往路・復路はそれぞれ最適なルートで計算します。道路状況や一方通行等により、帰りの距離・時間が異なる場合があります。"
      : (state.config.page?.distanceNote || "住所・施設名から走行ルートを計算します。");
    const calcResult = state.routeCalcResult;
    const addressFacilityNote = "住所のほか、病院・施設名でも検索できます。";
    const addressDisclaimer = "住所・施設名検索による距離は\n丁目・番地単位で算出されるため、\n実際の運行距離と異なる場合があります。\n\n概算料金の目安としてご利用ください。";
    const tollRoadNote =
      state.config.page?.tollRoadNote ||
      "通行料金は実費負担となります。";
    const hideRoadTypeRadios = isPreFixedFareMode();

    const roadTypeRadios = hideRoadTypeRadios ? "" : `
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
        <button type="button" class="estimate-calc-distance-btn" id="calculateDistanceBtn" ${state.routeCalcLoading ? "disabled" : ""}>${escapeHtml(getRouteCalcButtonLabel())}</button>
        <div class="estimate-route-feedback${state.routeCalcError ? " estimate-route-feedback--error" : ""}" id="routeCalcFeedback" aria-live="polite">${escapeHtml(state.routeCalcError || "")}</div>
        ${calcResult ? `
          <div class="estimate-route-result" aria-live="polite">
            ${calcResult.outboundDistanceKm > 0 && isRoundTripActive() ? `
              <div class="estimate-route-result-row">
                <span class="estimate-route-result-label">往路距離</span>
                <span class="estimate-route-result-value">${escapeHtml(formatRouteDistance(calcResult.outboundDistanceKm))}</span>
              </div>
            ` : ""}
            ${calcResult.returnDistanceKm > 0 ? `
              <div class="estimate-route-result-row">
                <span class="estimate-route-result-label">復路距離</span>
                <span class="estimate-route-result-value">${escapeHtml(formatRouteDistance(calcResult.returnDistanceKm))}</span>
              </div>
            ` : ""}
            ${getActiveReturnPlanType() === "return_pending" && isRoundTripActive() ? `
              <div class="estimate-route-result-row">
                <span class="estimate-route-result-label">復路</span>
                <span class="estimate-route-result-value">確認対応（帰り未定）</span>
              </div>
            ` : ""}
            <div class="estimate-route-result-row">
              <span class="estimate-route-result-label">${isRoundTripActive() ? "合計距離" : "距離"}</span>
              <span class="estimate-route-result-value">${escapeHtml(formatRouteDistance(calcResult.distanceKm))}</span>
            </div>
            <div class="estimate-route-result-row">
              <span class="estimate-route-result-label">所要時間</span>
              <span class="estimate-route-result-value">${escapeHtml(formatRouteDuration(calcResult.durationMinutes))}</span>
            </div>
          </div>
          ${state.routePlan ? `
            <div id="estimateRouteResultArea" class="estimate-route-result-area">
              <section class="estimate-route-preview estimate-route-preview--inline" aria-label="走行予定ルート">
                <h4 class="estimate-route-preview-title">走行予定ルート</h4>
                <div class="estimate-route-map-wrap">
                  <div class="estimate-route-map" role="img" aria-label="走行予定ルート地図"></div>
                </div>
              </section>
              ${renderStepRouteSelection()}
            </div>
          ` : ""}
        ` : ""}
        <p class="estimate-address-disclaimer">${escapeHtml(addressDisclaimer)}</p>
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
        ${renderReturnPlanSection()}
        ${roadTypeRadios}
        ${!hideRoadTypeRadios && state.roadType === "toll" ? `<p class="estimate-road-type-note">${escapeHtml(tollRoadNote)}</p>` : ""}
        ${addressPanel}
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
    if(isPreFixedFareMode()){
      const notice = String(state.config.page?.preFixedFareNotice || "").trim();
      const serviceNote = "※迎車料金・介助料・待機料・有料道路代等は、事前確定運賃とは別枠でご精算となる場合があります。";
      return notice ? (notice + "\n\n" + serviceNote) : serviceNote;
    }

    const fallback =
      "※表示料金は概算です。\n" +
      "※実際の料金は運行距離、交通状況、待機時間、付き添い時間、介助内容等により変動する場合があります。";
    const base = state.config.page?.resultNotes || fallback;
    return base;
  }

  function getResultTotalLabel(){
    if(isPreFixedFareMode()){
      return state.config.resultLabels?.fixedFareSection || "事前確定運賃込み合計";
    }
    return state.config.resultLabels?.totalEstimateSection || state.config.resultLabels?.total || "合計目安";
  }

  function formatResultTotalAmount(total){
    const amount = formatYen(total);
    return isPreFixedFareMode() ? amount : amount + "～";
  }

  function renderUsageSummary(result){
    const title = state.config.resultLabels?.usageSummary || "ご利用内容";
    const fareMode = String(result?.quoteSnapshot?.fareMode || getConfigFareMode());
    const items = window.EstimateFareDisplay
      ? window.EstimateFareDisplay.mapUsageSummaryForLp(result.usageSummary, fareMode)
      : (Array.isArray(result.usageSummary) ? result.usageSummary : []);
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
    const trafficZoneRows = [];
    if(snapshot.preFixedFareMode){
      if(snapshot.baseDistanceFareAmount != null){
        fareRows.push(["認可距離制運賃", formatCalcBasisYen(snapshot.baseDistanceFareAmount)]);
      }
      if(snapshot.detectedMunicipality){
        trafficZoneRows.push(["判定市区町村", snapshot.detectedMunicipality]);
      }
      if(snapshot.selectedTrafficZoneLabel){
        trafficZoneRows.push(["適用交通圏", snapshot.selectedTrafficZoneLabel]);
      }
      if(snapshot.trafficZoneCoefficient != null){
        const coefficientLabel = window.EstimateTrafficZone
          ? window.EstimateTrafficZone.formatTrafficZoneCoefficient(snapshot.trafficZoneCoefficient)
          : String(snapshot.trafficZoneCoefficient);
        trafficZoneRows.push(["平準化係数", coefficientLabel]);
      }
      if(snapshot.trafficZoneDetectionMethod){
        const methodLabel = window.EstimateTrafficZone
          ? window.EstimateTrafficZone.getTrafficZoneDetectionMethodLabel(snapshot.trafficZoneDetectionMethod)
          : snapshot.trafficZoneDetectionMethod;
        trafficZoneRows.push(["判定方法", methodLabel]);
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

    const serviceRows = [];
    const specialVehicleFee = Number(breakdown.specialVehicleFee) || Number(snapshot.specialVehicleFeeAmount) || 0;
    if(specialVehicleFee > 0){
      serviceRows.push(["特殊車両使用料", formatCalcBasisYen(specialVehicleFee)]);
    }
    serviceRows.push(
      ["乗降介助", formatCalcBasisYen(breakdown.assistanceFee)],
      ["階段介助", formatCalcBasisYen(breakdown.stairFee)],
      [
        "待機・付き添い",
        formatCalcBasisYen((Number(breakdown.waitingFee) || 0) + (Number(breakdown.escortFee) || 0))
      ]
    );

    const labels = state.config.resultLabels || {};
    const basisToggleOpen = labels.calcBasisToggleOpen || "料金の計算方法を見る";
    const basisToggleClose = labels.calcBasisToggleClose || "料金の計算方法を閉じる";
    const basisTitle = labels.calcBasisTitle || "料金の計算方法";

    const basisNotes = [
      "※本見積は出発地・目的地から算出した推計ルートに基づいています。",
      "※道路状況、交通規制、利用者様のご要望等により実際の運行内容が変更となる場合があります。",
      "※有料道路料金、駐車料金等の実費は別途ご負担となる場合があります。"
    ];
    if(snapshot.preFixedFareMode){
      basisNotes.push("※事前確定運賃は認可運賃および適用係数に基づき算出しています。");
    }

    return (
      "<div class=\"estimate-calc-basis\">" +
      "<button type=\"button\" class=\"estimate-calc-basis-toggle\" id=\"estimateCalcBasisToggle\" aria-expanded=\"false\" aria-controls=\"estimateCalcBasisPanel\">" +
      escapeHtml(basisToggleOpen) +
      "</button>" +
      "<div class=\"estimate-calc-basis-panel\" id=\"estimateCalcBasisPanel\" hidden>" +
      "<h4 class=\"estimate-calc-basis-title\">" + escapeHtml(basisTitle) + "</h4>" +
      renderCalcBasisSection("ルート算出情報", routeRows) +
      (trafficZoneRows.length ? renderCalcBasisSection("交通圏情報", trafficZoneRows) : "") +
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
    const fareMode = String(basis.fareMode || result?.quoteSnapshot?.fareMode || getConfigFareMode());
    const displayModeLabel = window.EstimateFareDisplay
      ? window.EstimateFareDisplay.getLpFareModeLabelFromFareMode(fareMode)
      : (basis.fareModeLabel || "");
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
          <div class="estimate-fare-basis-mode">${escapeHtml(displayModeLabel)}</div>
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
    let url = base;
    if(window.EstimateHandoff && state.estimateNumber){
      if(typeof window.EstimateHandoff.buildReservationHandoffUrl === "function"){
        url = window.EstimateHandoff.buildReservationHandoffUrl(base, state.estimateNumber);
      }else{
        url = window.EstimateHandoff.appendEstimateNoToUrl(base, state.estimateNumber);
      }
    }
    if(isPreFixedFareMode() && !isPreFixedFareConfirmable()){
      try{
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.set("fareConfirm", "review");
        return parsed.toString();
      }catch(error){
        const sep = url.includes("?") ? "&" : "?";
        return url + sep + "fareConfirm=review";
      }
    }
    return url;
  }

  function buildHandoffRecord(result){
    return {
      estimateNumber: state.estimateNumber,
      createdAt: state.estimateCreatedAt,
      total: result.total,
      distanceKm: state.distanceKm,
      usageSummary: result.usageSummary,
      breakdown: result.breakdown,
      quoteSnapshot: result.quoteSnapshot || null,
      routePlan: result.routePlan || state.routePlan || null,
      snapshotHash: state.handoffSnapshotHash || null,
      selections: {
        mobilityId: state.mobilityId,
        assistanceId: state.assistanceId,
        stairId: state.stairId,
        tripTypeId: state.tripTypeId,
        roundTripAddonId: state.roundTripAddonId,
        returnPlanType: getActiveReturnPlanType(),
        returnStopType: state.returnStopType,
        returnStopAddress: state.returnStopAddress,
        differentReturnAddress: state.differentReturnAddress,
        roadType: state.roadType
      },
      handoffSource: "lp-site-estimate",
      dtoVersion: 2
    };
  }

  async function persistHandoff(result){
    if(!window.EstimateHandoff || !state.estimateNumber) return;
    const handoff = buildHandoffRecord(result);
    window.EstimateHandoff.saveHandoffRecord(handoff);
    state.quoteRegisterStatus = "pending";
    state.quoteRegisterMessage = "";
    if(!window.EstimateQuoteRegister || typeof window.EstimateQuoteRegister.registerQuoteFromHandoff !== "function"){
      state.quoteRegisterStatus = "warn";
      state.quoteRegisterMessage = window.EstimateQuoteRegister?.REGISTER_WARN_MESSAGE
        || "見積のサーバー登録に失敗しました。予約は可能ですが、表示内容が最新でない場合があります。お困りの際はお電話ください。";
      return;
    }
    try{
      const registerResult = await window.EstimateQuoteRegister.registerQuoteFromHandoff(handoff);
      if(registerResult.ok){
        state.quoteRegisterStatus = "ok";
        state.quoteRegisterMessage = "";
        if(registerResult.data?.snapshotHash){
          handoff.snapshotHash = registerResult.data.snapshotHash;
          state.handoffSnapshotHash = registerResult.data.snapshotHash;
          if(registerResult.data?.expiresAt){
            handoff.quoteExpiresAt = registerResult.data.expiresAt;
          }
          window.EstimateHandoff.saveHandoffRecord(handoff);
        }
        return;
      }
      state.quoteRegisterStatus = "warn";
      state.quoteRegisterMessage = registerResult.userMessage
        || window.EstimateQuoteRegister.REGISTER_WARN_MESSAGE;
    }catch(error){
      state.quoteRegisterStatus = "warn";
      state.quoteRegisterMessage = window.EstimateQuoteRegister?.REGISTER_WARN_MESSAGE
        || "見積のサーバー登録に失敗しました。予約は可能ですが、表示内容が最新でない場合があります。お困りの際はお電話ください。";
    }
  }

  function syncHandoffForResult(result){
    if(!window.EstimateHandoff) return;
    void (async function(){
      try{
        await ensureEstimateNumber(result);
        if(!state.estimateCreatedAt){
          state.estimateCreatedAt = new Date().toISOString();
        }
        await persistHandoff(result);
      }catch(error){
        state.quoteRegisterStatus = "warn";
        state.quoteRegisterMessage = window.EstimateQuoteRegister?.REGISTER_WARN_MESSAGE
          || "見積のサーバー登録に失敗しました。予約は可能ですが、表示内容が最新でない場合があります。お困りの際はお電話ください。";
      }
      refreshResultSection(result);
    })();
  }

  function renderRegisterWarningBox(){
    if(state.quoteRegisterStatus !== "warn" || !state.quoteRegisterMessage){
      return "";
    }
    return `<div class="estimate-register-warning" role="status">${escapeHtml(state.quoteRegisterMessage)}</div>`;
  }

  function renderResult(result){
    const totalLabel = getResultTotalLabel();
    const reservationUrl = getReservationUrl();
    const lineUrl = state.ctaUrls.line || "#";
    const phoneUrl = state.ctaUrls.phone || "#";

    const routePlan = state.routePlan;
    const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
    const outboundLeg = routePlan?.outboundRoutePlan || null;
    const returnLeg = routePlan?.returnRoutePlan || null;
    const outboundRoute = outboundLeg ? getRoutePlanPrimaryRoute({ routes: outboundLeg.routes, selectedRouteId: outboundLeg.selectedRouteId, distanceMeters: outboundLeg.distanceMeters, durationSeconds: outboundLeg.durationSeconds, encodedPolyline: outboundLeg.encodedPolyline }) : primaryRoute;
    const returnRoute = returnLeg ? getRoutePlanPrimaryRoute({ routes: returnLeg.routes, selectedRouteId: returnLeg.selectedRouteId, distanceMeters: returnLeg.distanceMeters, durationSeconds: returnLeg.durationSeconds, encodedPolyline: returnLeg.encodedPolyline }) : null;
    const plannedDistance = formatRouteDistanceMeters(routePlan?.totalDistanceMeters || primaryRoute?.distanceMeters || routePlan?.distanceMeters || 0);
    const plannedDuration = formatRouteDurationSeconds(routePlan?.totalDurationSeconds || primaryRoute?.durationSeconds || routePlan?.durationSeconds || 0);
    const roadTypeLabel = getRoadTypeLabel(routePlan?.roadType || state.roadType);
    const roundTripStatusHtml = isPreFixedFareMode() && routePlan && window.PreFixedFareStatus
      ? window.PreFixedFareStatus.buildStatusHtml(routePlan, {
        escapeHtml: escapeHtml,
        returnPlanType: getActiveReturnPlanType() || result?.quoteSnapshot?.returnPlanType || null,
        outboundRoutePlan: result?.quoteSnapshot?.outboundRoutePlan || routePlan?.outboundRoutePlan || null,
        returnRoutePlan: result?.quoteSnapshot?.returnRoutePlan || routePlan?.returnRoutePlan || null
      })
      : "";
    const routeCardHtml = routePlan ? `
      <section class="estimate-route-preview" aria-label="走行予定ルート">
        <h4 class="estimate-route-preview-title">走行予定ルート（選択中）</h4>
        ${roundTripStatusHtml}
        <div class="estimate-route-map-wrap">
          <div class="estimate-route-map" role="img" aria-label="走行予定ルート地図"></div>
        </div>
        <dl class="estimate-route-info-list">
          <div class="estimate-route-info-row">
            <dt>出発地</dt>
            <dd>${escapeHtml(routePlan?.pickup?.address || outboundLeg?.origin?.address || state.originAddress || "-")}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>目的地</dt>
            <dd>${escapeHtml(routePlan?.destination?.address || outboundLeg?.destination?.address || state.destinationAddress || "-")}</dd>
          </div>
          ${outboundRoute ? `
            <div class="estimate-route-info-row">
              <dt>往路距離</dt>
              <dd>${escapeHtml(formatRouteDistanceMeters(outboundRoute.distanceMeters) || "-")}</dd>
            </div>
          ` : ""}
          ${returnRoute ? `
            <div class="estimate-route-info-row">
              <dt>復路距離</dt>
              <dd>${escapeHtml(formatRouteDistanceMeters(returnRoute.distanceMeters) || "-")}</dd>
            </div>
          ` : ""}
          ${getActiveReturnPlanType() === "return_pending" && isRoundTripActive() ? `
            <div class="estimate-route-info-row">
              <dt>復路</dt>
              <dd>帰り未定のため確認対応</dd>
            </div>
          ` : ""}
          <div class="estimate-route-info-row">
            <dt>道路設定</dt>
            <dd>${escapeHtml(roadTypeLabel)}</dd>
          </div>
          <div class="estimate-route-info-row">
            <dt>${isRoundTripActive() ? "合計予定距離" : "予定距離"}</dt>
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
        ${renderRegisterWarningBox()}
        <div class="estimate-total-section estimate-total-section--hero">
          <div class="estimate-total-box">
            <div class="estimate-total-label">${escapeHtml(totalLabel)}</div>
            <div class="estimate-total-amount">${escapeHtml(formatResultTotalAmount(result.total))}</div>
          </div>
          <div class="estimate-result-notes estimate-result-notes--hero">${escapeHtml(getResultNotes())}</div>
        </div>
        <div class="estimate-cta-group estimate-cta-group--result" id="estimateResultReservationCta">
          <a class="estimate-cta-primary" href="${escapeAttr(reservationUrl)}" rel="noopener noreferrer">${escapeHtml(getReservationCtaLabel())}</a>
          ${getReservationReviewNotice()
            ? '<p class="estimate-reservation-review-notice estimate-reservation-review-notice--result">' + escapeHtml(getReservationReviewNotice()) + "</p>"
            : ""}
        </div>
        <div class="estimate-breakdown-groups">
          ${renderFareSections(result)}
        </div>
        ${renderUsageSummary(result)}
        ${renderFareBasis(result)}
        ${renderCalculationBasis(result)}
        <div class="estimate-result-route-block">
          ${renderRouteSelectionSection(result)}
          ${routeCardHtml}
        </div>
        <div class="estimate-result-actions">
          <button type="button" class="estimate-pdf-btn" id="estimatePdfBtn">見積書PDFを保存</button>
          <div class="estimate-pdf-feedback" id="estimatePdfFeedback" aria-live="polite"></div>
          <button type="button" class="estimate-copy-url-btn" id="estimateCopyUrlBtn">見積URLをコピー</button>
          <div class="estimate-copy-url-feedback" id="estimateCopyUrlFeedback" aria-live="polite"></div>
          <button type="button" class="estimate-reset-btn estimate-reset-btn--bottom" id="estimateResetBtnBottom">最初からやり直す</button>
        </div>
      </section>
      <div class="estimate-cta-group estimate-cta-group--secondary">
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
    // ページ入場時・リセット直後はヘッダー／タイトルが見えるよう先頭へ
    if(pageEntryScrollPending){
      pageEntryScrollPending = false;
      requestAnimationFrame(function(){
        scrollPageToTop();
      });
      return;
    }
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

    disconnectMobileReserveBarObserver();
    const page = document.querySelector(".estimate-page") || document.body;
    page.classList.remove("estimate-has-mobile-reserve-bar");

    root.innerHTML = `
      <div class="estimate-wrap">
        <div class="estimate-header">
          <h1 class="estimate-title">${escapeHtml(getLpFareModeTitleText())}</h1>
          <button type="button" class="estimate-reset-btn" id="estimateResetBtn">最初からやり直す</button>
        </div>
        <p class="estimate-lead" id="estimateLeadText">${escapeHtml(getLpFareModeLeadText())}</p>
        ${stepsHtml}
        ${allComplete ? renderResult(result) : ""}
      </div>
      ${allComplete ? renderMobileReservationBar(result) : ""}
    `;

    bindEvents();
    bindCopyUrlButton();
    bindMobileReserveBarVisibility();

    if(!allComplete){
      scrollToActiveStep(flow, activeIndex);
      if(state.routePlan){
        renderRouteMapIfNeeded();
      }
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
      const routeSelectBtn = event.target.closest("[data-select-route-id]");
      if(routeSelectBtn){
        event.preventDefault();
        if(routeSelectBtn.disabled) return;
        const routeId = routeSelectBtn.getAttribute("data-select-route-id");
        const legKey = routeSelectBtn.getAttribute("data-select-route-leg") || "outbound";
        if(routeId) selectRoute(routeId, legKey);
        return;
      }
      const overallSelectBtn = event.target.closest("[data-select-overall-route-id]");
      if(overallSelectBtn){
        event.preventDefault();
        if(overallSelectBtn.disabled) return;
        const overallRouteId = overallSelectBtn.getAttribute("data-select-overall-route-id");
        if(overallRouteId) selectOverallRoute(overallRouteId);
        return;
      }
      const roundTripPairBtn = event.target.closest("[data-select-roundtrip-pair]");
      if(roundTripPairBtn){
        event.preventDefault();
        if(roundTripPairBtn.disabled) return;
        const pairStrategy = roundTripPairBtn.getAttribute("data-select-roundtrip-pair");
        if(pairStrategy) selectRoundTripRoutePair(pairStrategy);
        return;
      }
      const routeAckBtn = event.target.closest("[data-distance-route-acknowledge]");
      if(routeAckBtn){
        event.preventDefault();
        acknowledgeDistanceRouteReview();
        return;
      }
      const basisToggle = event.target.closest("#estimateCalcBasisToggle");
      if(basisToggle){
        event.preventDefault();
        const panel = document.getElementById("estimateCalcBasisPanel");
        const expanded = basisToggle.getAttribute("aria-expanded") === "true";
        const labels = state.config.resultLabels || {};
        const basisToggleOpen = labels.calcBasisToggleOpen || "料金の計算方法を見る";
        const basisToggleClose = labels.calcBasisToggleClose || "料金の計算方法を閉じる";
        basisToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        basisToggle.textContent = expanded ? basisToggleOpen : basisToggleClose;
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
      await persistHandoff(result);
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
        breakdown: result.breakdown,
        routePlan: state.routePlan || result.routePlan || null,
        returnPlanType: getActiveReturnPlanType(),
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
    if(!resultSection) return;

    const temp = document.createElement("div");
    temp.innerHTML = renderResult(result);
    const newResult = temp.querySelector(".estimate-result");
    const newSecondary = temp.querySelector(".estimate-cta-group--secondary");
    const newDisclaimer = temp.querySelector(".estimate-disclaimer");
    const oldSecondary = document.querySelector(".estimate-cta-group--secondary");
    const oldDisclaimer = document.querySelector(".estimate-disclaimer");

    if(newResult){
      resultSection.replaceWith(newResult);
    }
    if(newSecondary && oldSecondary){
      oldSecondary.replaceWith(newSecondary);
    }else if(newSecondary && !oldSecondary){
      const currentResult = document.querySelector(".estimate-result");
      if(currentResult){
        currentResult.insertAdjacentElement("afterend", newSecondary);
      }
    }
    if(newDisclaimer && oldDisclaimer){
      oldDisclaimer.replaceWith(newDisclaimer);
    }else if(newDisclaimer && !oldDisclaimer){
      const secondary = document.querySelector(".estimate-cta-group--secondary");
      if(secondary){
        secondary.insertAdjacentElement("afterend", newDisclaimer);
      }
    }

    const oldMobileBar = document.getElementById("estimateMobileReserveBar");
    const mobileBarHtml = renderMobileReservationBar(result);
    if(mobileBarHtml){
      const barTemp = document.createElement("div");
      barTemp.innerHTML = mobileBarHtml;
      const newMobileBar = barTemp.firstElementChild;
      if(oldMobileBar && newMobileBar){
        oldMobileBar.replaceWith(newMobileBar);
      }else if(newMobileBar){
        const root = getRoot();
        if(root){
          root.appendChild(newMobileBar);
        }
      }
    }else if(oldMobileBar){
      oldMobileBar.remove();
    }

    renderRouteMapIfNeeded();
    bindCopyUrlButton();
    bindMobileReserveBarVisibility();
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
      if(value !== "round-trip"){
        clearReturnPlanInputs();
      }
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

    bindChoiceGroup("returnPlanType", function(value){
      state.returnPlanType = value;
      if(value !== "return_with_stop"){
        state.returnStopAddress = "";
      }
      if(value !== "different_return_destination"){
        state.differentReturnAddress = "";
      }
      state.routePlan = null;
      state.routeCalcResult = null;
      state.routeCalcError = "";
      state.distanceKm = 0;
      state.distanceInputText = "";
      state.distanceRouteReviewed = false;
      state.lastActiveStepId = "";
      renderPage();
    });

    const returnStopInput = document.getElementById("returnStopAddressInput");
    if(returnStopInput){
      returnStopInput.addEventListener("input", function(){
        state.returnStopAddress = returnStopInput.value;
      });
    }

    bindChoiceGroup("roadType", function(value){
      state.roadType = value === "toll" ? "toll" : "general";
      state.routeCalcError = "";
      state.routePlan = null;
      state.distanceRouteReviewed = false;
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

    const differentReturnInput = document.getElementById("differentReturnAddressInput");
    if(differentReturnInput){
      differentReturnInput.addEventListener("input", function(){
        state.differentReturnAddress = differentReturnInput.value;
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
      console.info("[route-ui] loaded fareMode", getConfigFareMode());
      if(!isPreFixedFareMode()){
        console.info("[route-ui] 現在は概算見積モードのため、事前確定運賃のルート選択UIは非表示");
      }

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
      }else{
        state.distanceInputMode = "address";
      }

      syncAssistanceForMobility();
      syncRoundTripAddon();

      pageEntryScrollPending = true;
      renderPage();
      scrollPageToTop();
      requestAnimationFrame(function(){
        scrollPageToTop();
        pageEntryScrollPending = false;
      });
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
