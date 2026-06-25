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

  function getSingleCandidateNotice(){
    return "ルート候補が1件のみのため、事前確定運賃としては確定せず、予約後に確認対応となります。";
  }

  function shouldShowSingleCandidateNotice(routePlan, options){
    if(!routePlan){
      return false;
    }
    const outbound = routePlan.outboundRoutePlan || routePlan;
    if(hasSingleNonConfirmableCandidate(outbound)){
      return true;
    }
    const returnPlanType = resolveReturnPlanType(routePlan, options);
    if(returnPlanType !== RETURN_PLAN_PENDING){
      const returnLeg = routePlan.returnRoutePlan || null;
      if(hasSingleNonConfirmableCandidate(returnLeg)){
        return true;
      }
    }
    return false;
  }

  function getReturnStopoverExplanation(routePlan, options){
    if(resolveReturnPlanType(routePlan, options) !== RETURN_WITH_STOP){
      return "";
    }
    const returnLeg = routePlan?.returnRoutePlan || null;
    if(returnLeg && hasSingleNonConfirmableCandidate(returnLeg)){
      return "復路は立ち寄り地点を含む指定ルートで算定しています。候補が1件のみのため確認対応となります。";
    }
    return "復路は、目的地 → 立ち寄り先 → 出発地の指定ルートで距離を算定しています。";
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

    const outbound = routePlan.outboundRoutePlan || routePlan;
    const returnLeg = routePlan.returnRoutePlan || null;
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
    shouldShowSingleCandidateNotice: shouldShowSingleCandidateNotice,
    getReturnStopoverExplanation: getReturnStopoverExplanation,
    resolveReturnPlanType: resolveReturnPlanType,
    buildStatusMessages: buildStatusMessages,
    buildStatusHtml: buildStatusHtml,
    buildStatusPdfHtml: buildStatusPdfHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
