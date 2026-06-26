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
    return "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。";
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
        : (message.type === "stopover" ? "estimate-prefixed-fare-stopover-note" : "");
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
      const color = message.type === "single_candidate_notice" ? "#8a6010" : "#5a4a2f";
      const weight = message.type === "single_candidate_notice" ? "700" : "400";
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
