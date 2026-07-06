(function(global){
  const RETURN_PLAN_PENDING = "return_pending";
  const RETURN_WITH_STOP = "return_with_stop";

  function getRouteCandidatesFromLeg(legPlan){
    if(!legPlan){
      return [];
    }
    if(Array.isArray(legPlan.routeCandidates) && legPlan.routeCandidates.length){
      return legPlan.routeCandidates;
    }
    if(Array.isArray(legPlan.routes) && legPlan.routes.length){
      return legPlan.routes;
    }
    return [];
  }

  function isLegConfirmable(legPlan){
    return legPlan?.preFixedFareConfirmable === true;
  }

  function getLegStatusLabel(legPlan){
    return isLegConfirmable(legPlan) ? "事前確定運賃候補" : "確認対応";
  }

  function hasSingleNonConfirmableCandidate(legPlan){
    if(!legPlan || isLegConfirmable(legPlan)){
      return false;
    }
    if(legPlan.fallbackReason === "only_one_distinct_route"){
      return true;
    }
    return getRouteCandidatesFromLeg(legPlan).length === 1;
  }

  function resolveReturnPlanType(routePlan, options){
    const fromOptions = String(options?.returnPlanType || "").trim();
    if(fromOptions){
      return fromOptions;
    }
    return String(routePlan?.returnPlanType || "").trim();
  }

  function getOutboundLeg(routePlan, options){
    return options?.outboundRoutePlan || routePlan?.outboundRoutePlan || routePlan;
  }

  function getReturnLeg(routePlan, options){
    return options?.returnRoutePlan || routePlan?.returnRoutePlan || null;
  }

  function legNeedsReviewNotice(legPlan){
    if(!legPlan || isLegConfirmable(legPlan)){
      return false;
    }
    return hasSingleNonConfirmableCandidate(legPlan) || legPlan.preFixedFareConfirmable === false;
  }

  function getSingleCandidateNotice(){
    return "ルート候補が1件のみのため、予約受付後に確認してご連絡します。";
  }

  function isOverallRouteSelectionConfirmable(routePlan){
    if(resolveReturnPlanType(routePlan) !== RETURN_WITH_STOP){
      return false;
    }
    const overall = routePlan?.overallRouteSelection;
    if(!overall){
      return false;
    }
    const candidates = Array.isArray(overall.overallRouteCandidates) ? overall.overallRouteCandidates : [];
    const selectedId = String(overall.selectedOverallRouteId || "").trim();
    return candidates.length >= 2 && Boolean(selectedId);
  }

  function shouldShowSingleCandidateNotice(routePlan, options){
    if(!routePlan){
      return false;
    }
    if(isOverallRouteSelectionConfirmable(routePlan)){
      return false;
    }
    const outbound = getOutboundLeg(routePlan, options);
    const returnPlanType = resolveReturnPlanType(routePlan, options);
    const returnLeg = getReturnLeg(routePlan, options);
    if(legNeedsReviewNotice(outbound)){
      return true;
    }
    if(returnPlanType !== RETURN_PLAN_PENDING && legNeedsReviewNotice(returnLeg)){
      return true;
    }
    return routePlan.preFixedFareConfirmable === false
      && (legNeedsReviewNotice(outbound) || (returnPlanType !== RETURN_PLAN_PENDING && legNeedsReviewNotice(returnLeg)));
  }

  function getReturnStopoverRouteStructureExplanation(){
    return "復路は、目的地 → 立ち寄り先 → 出発地の指定ルートで距離を算定しています。";
  }

  function getReturnStopoverExplanation(routePlan, options){
    if(resolveReturnPlanType(routePlan, options) !== RETURN_WITH_STOP){
      return "";
    }
    const returnLeg = getReturnLeg(routePlan, options);
    const routeStructure = getReturnStopoverRouteStructureExplanation();
    if(isOverallRouteSelectionConfirmable(routePlan)){
      return routeStructure;
    }
    if(returnLeg && hasSingleNonConfirmableCandidate(returnLeg)){
      return routeStructure + "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。";
    }
    if(returnLeg && !isLegConfirmable(returnLeg)){
      return routeStructure + getSingleCandidateNotice();
    }
    return routeStructure;
  }

  function getOverallRoutePathLabel(routePlan){
    const overall = routePlan?.overallRouteSelection;
    if(!overall){
      return "";
    }
    const segments = Array.isArray(overall.commonSegments) ? overall.commonSegments : [];
    const outbound = segments.find(function(segment){
      return segment?.key === "outbound";
    });
    const returnCommon = segments.find(function(segment){
      return segment?.key === "return_common";
    });
    const home = String(outbound?.originAddress || "出発地").trim();
    const goal = String(outbound?.destinationAddress || "目的地").trim();
    const stop = String(
      returnCommon?.destinationAddress
      || overall.selectableSegment?.originAddress
      || "立ち寄り先"
    ).trim();
    return home + " → " + goal + " → " + stop + " → " + home;
  }

  function getOverallRouteSelectionStatusLabel(){
    return "全体走行予定ルート：事前確定運賃候補（選択済み）";
  }

  function getOverallRouteSelectionNote(){
    return "往路・立ち寄り区間を含む全体走行予定ルートで距離を算定しています。";
  }

  function buildOverallRouteSelectionStatusMessages(routePlan){
    const pathLabel = getOverallRoutePathLabel(routePlan);
    const messages = [
      { type: "overall_route_status", text: getOverallRouteSelectionStatusLabel() }
    ];
    if(pathLabel){
      messages.push({
        type: "overall_route_path",
        text: pathLabel + " の全体ルートを選択済みです。"
      });
    }
    messages.push({ type: "overall_route_note", text: getOverallRouteSelectionNote() });
    return messages;
  }

  function isStructuredRoundTrip(routePlan){
    return routePlan?.tripType === "round_trip" || Boolean(routePlan?.outboundRoutePlan);
  }

  function buildStatusMessages(routePlan, options){
    const messages = [];
    if(!routePlan){
      return messages;
    }

    if(shouldShowSingleCandidateNotice(routePlan, options)){
      messages.push({ type: "single_candidate_notice", text: getSingleCandidateNotice() });
    }

    if(isOverallRouteSelectionConfirmable(routePlan)){
      messages.push.apply(messages, buildOverallRouteSelectionStatusMessages(routePlan));
      return messages;
    }

    const outbound = getOutboundLeg(routePlan, options);
    const returnLeg = getReturnLeg(routePlan, options);
    const returnPlanType = resolveReturnPlanType(routePlan, options);

    if(isStructuredRoundTrip(routePlan)){
      messages.push({ type: "leg_status", text: "往路：" + getLegStatusLabel(outbound) });
      if(returnPlanType === RETURN_PLAN_PENDING){
        messages.push({ type: "leg_status", text: "復路：帰り未定のため確認対応" });
      }else if(returnLeg){
        messages.push({ type: "leg_status", text: "復路：" + getLegStatusLabel(returnLeg) });
      }
    }else if(outbound){
      messages.push({ type: "leg_status", text: getLegStatusLabel(outbound) });
    }

    const stopoverText = getReturnStopoverExplanation(routePlan, options);
    if(stopoverText){
      messages.push({ type: "stopover", text: stopoverText });
    }

    return messages;
  }

  function buildStatusHtml(routePlan, options){
    const opts = options || {};
    const escapeHtml = typeof opts.escapeHtml === "function"
      ? opts.escapeHtml
      : function(text){ return String(text ?? ""); };
    const messages = buildStatusMessages(routePlan, opts);
    if(!messages.length){
      return "";
    }

    const wrapperClass = String(opts.wrapperClass || "estimate-round-trip-status");
    const parts = messages.map(function(message){
      const className = message.type === "single_candidate_notice"
        ? "estimate-prefixed-fare-single-candidate-notice"
        : (message.type === "overall_route_status"
          ? "estimate-prefixed-fare-overall-route-status"
          : (message.type === "stopover" || message.type === "overall_route_note"
            ? "estimate-prefixed-fare-stopover-note"
            : ""));
      return "<p" + (className ? ' class="' + className + '"' : "") + ">" + escapeHtml(message.text) + "</p>";
    });
    return "<div class=\"" + escapeHtml(wrapperClass) + "\">" + parts.join("") + "</div>";
  }

  function buildStatusPdfHtml(routePlan, layout, options){
    const messages = buildStatusMessages(routePlan, options);
    if(!messages.length){
      return "";
    }
    const gap = Math.max(4, Number(layout?.routeMapTitleGap) || 6);
    const fontSize = Math.max(9, Number(layout?.metaFont) - 1 || 10);
    const parts = messages.map(function(message){
      const isReviewNotice = message.type === "single_candidate_notice";
      const isOverallStatus = message.type === "overall_route_status";
      const isOverallPath = message.type === "overall_route_path";
      const color = isReviewNotice ? "#8a6010" : (isOverallStatus || isOverallPath ? "#333" : "#5a4a2f");
      const weight = isReviewNotice || isOverallStatus ? "700" : (isOverallPath ? "600" : "400");
      return (
        "<p style=\"margin:0 0 " + gap + "px;font-size:" + fontSize + "px;line-height:1.55;" +
        "color:" + color + ";font-weight:" + weight + ";\">" +
        escapePdfText(message.text) +
        "</p>"
      );
    });
    return (
      "<div style=\"margin:0 0 " + gap + "px;\">" +
      parts.join("") +
      "</div>"
    );
  }

  function escapePdfText(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  global.PreFixedFareStatus = {
    RETURN_PLAN_PENDING: RETURN_PLAN_PENDING,
    RETURN_WITH_STOP: RETURN_WITH_STOP,
    getRouteCandidatesFromLeg: getRouteCandidatesFromLeg,
    isLegConfirmable: isLegConfirmable,
    getLegStatusLabel: getLegStatusLabel,
    hasSingleNonConfirmableCandidate: hasSingleNonConfirmableCandidate,
    getSingleCandidateNotice: getSingleCandidateNotice,
    isOverallRouteSelectionConfirmable: isOverallRouteSelectionConfirmable,
    getOverallRoutePathLabel: getOverallRoutePathLabel,
    getOverallRouteSelectionStatusLabel: getOverallRouteSelectionStatusLabel,
    shouldShowSingleCandidateNotice: shouldShowSingleCandidateNotice,
    getReturnStopoverExplanation: getReturnStopoverExplanation,
    getOutboundLeg: getOutboundLeg,
    getReturnLeg: getReturnLeg,
    resolveReturnPlanType: resolveReturnPlanType,
    buildStatusMessages: buildStatusMessages,
    buildStatusHtml: buildStatusHtml,
    buildStatusPdfHtml: buildStatusPdfHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
