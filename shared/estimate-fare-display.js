(function(global){
  const LP_FARE_MODE_LABELS = {
    estimate: "概算見積（距離＋所要時間）",
    pre_fixed_fare: "事前確定運賃（出発前に運賃確定）"
  };

  const LP_FARE_MODE_LEADS = {
    estimate: "ご利用内容と移動距離・所要時間の目安から、料金の概算をご確認いただけます。\n実際の料金は、当日の運行ルート・道路状況・介助内容などにより変動する場合があります。",
    pre_fixed_fare: "出発地・目的地が決まっている場合は、出発前に運賃を確定できます。\n介助・待機・付き添いなどの内容により、運賃以外の料金が加算される場合があります。"
  };

  function formatYen(amount){
    return (Number(amount) || 0).toLocaleString("ja-JP") + "円";
  }

  function resolveLpFareDisplayKey(fareMode){
    return String(fareMode || "") === "pre_fixed_fare" ? "pre_fixed_fare" : "estimate";
  }

  function getLpFareModeLabelFromFareMode(fareMode){
    const key = resolveLpFareDisplayKey(fareMode);
    return LP_FARE_MODE_LABELS[key] || LP_FARE_MODE_LABELS.estimate;
  }

  function getLpFareModeLeadFromFareMode(fareMode){
    const key = resolveLpFareDisplayKey(fareMode);
    return LP_FARE_MODE_LEADS[key] || LP_FARE_MODE_LEADS.estimate;
  }

  function getLpFareModeTitleFromFareMode(fareMode){
    const key = resolveLpFareDisplayKey(fareMode);
    if(key === "pre_fixed_fare"){
      return "かんたん料金確認（事前確定運賃）";
    }
    return "かんたん料金確認（距離・時間の概算見積）";
  }

  function mapUsageSummaryForLp(items, fareMode){
    const label = getLpFareModeLabelFromFareMode(fareMode);
    return (Array.isArray(items) ? items : []).map(function(line){
      if(line?.label === "運賃方式"){
        return Object.assign({}, line, { value: label });
      }
      return line;
    });
  }

  function getPrimaryRoute(routePlan){
    if(!routePlan){
      return null;
    }
    if(Array.isArray(routePlan.routes) && routePlan.routes.length){
      const selectedId = String(routePlan.selectedRouteId || "");
      const selected = routePlan.routes.find(function(route){
        return String(route?.routeId || route?.id || "") === selectedId;
      });
      return selected || routePlan.routes[0];
    }
    return {
      distanceMeters: Number(routePlan.distanceMeters) || 0,
      durationSeconds: Number(routePlan.durationSeconds) || 0
    };
  }

  function formatDistanceKm(snapshot, routePlan){
    const meters = Number(snapshot?.distanceMeters) || 0;
    if(meters > 0){
      return (meters / 1000).toFixed(1) + "km";
    }
    const km = Number(snapshot?.distanceKm) || 0;
    if(km > 0){
      return km.toFixed(1) + "km";
    }
    const primary = getPrimaryRoute(routePlan);
    if(primary && Number(primary.distanceMeters) > 0){
      return (Number(primary.distanceMeters) / 1000).toFixed(1) + "km";
    }
    return "-";
  }

  function formatDurationMinutes(snapshot, routePlan){
    const seconds = Number(snapshot?.durationSeconds) || 0;
    if(seconds > 0){
      return Math.max(1, Math.round(seconds / 60)) + "分";
    }
    const primary = getPrimaryRoute(routePlan);
    if(primary && Number(primary.durationSeconds) > 0){
      return Math.max(1, Math.round(Number(primary.durationSeconds) / 60)) + "分";
    }
    return "-";
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

  function getBreakdownAmount(rows, key){
    const row = (Array.isArray(rows) ? rows : []).find(function(item){
      return item?.key === key;
    });
    return Number(row?.amount) || 0;
  }

  function getServiceFeeAmount(serviceFees, keys){
    const keySet = new Set(keys);
    return (Array.isArray(serviceFees) ? serviceFees : []).reduce(function(sum, row){
      if(keySet.has(row?.key)){
        return sum + (Number(row.amount) || 0);
      }
      return sum;
    }, 0);
  }

  function getFixedFareSectionTitle(fareMode, labels){
    const configLabels = labels || {};
    if(fareMode === "pre_fixed_fare"){
      return configLabels.fixedFareSection || "事前確定運賃";
    }
    return configLabels.estimatedFareSection || "概算料金内訳";
  }

  function buildFareCalculationLines(options){
    const snapshot = options?.quoteSnapshot || {};
    const breakdown = options?.breakdown || {};
    const total = Number(options?.total) || Number(snapshot?.fixedFareTotal) || 0;
    const routePlan = options?.routePlan || null;
    const totalLabel = String(options?.totalLabel || "概算料金");

    const pickupFee = getBreakdownAmount(snapshot.fixedFareBreakdown, "pickupFee")
      || Number(breakdown.pickupFee) || 0;
    const specialVehicleFee = Number(snapshot.specialVehicleFeeAmount) || 0;
    const distanceFare = getBreakdownAmount(snapshot.fixedFareBreakdown, "distanceFare")
      || Number(breakdown.distanceFare) || 0;
    const timeAdjustment = getBreakdownAmount(snapshot.fixedFareBreakdown, "timeAdjustment") || 0;
    const assistanceFee = getServiceFeeAmount(snapshot.serviceFees, ["assistanceFee"])
      || Number(breakdown.assistanceFee) || 0;
    const stairFee = getServiceFeeAmount(snapshot.serviceFees, ["stairFee"])
      || Number(breakdown.stairFee) || 0;
    const waitingEscortFee = getServiceFeeAmount(snapshot.serviceFees, ["waitingFee", "escortFee"])
      || (Number(breakdown.waitingFee) || 0) + (Number(breakdown.escortFee) || 0);

    const routeLabel = String(options?.routeLabel || "ルート算出");
    const lines = [
      { label: "予定距離", value: formatDistanceKm(snapshot, routePlan) },
      { label: "予定時間", value: formatDurationMinutes(snapshot, routePlan) },
      { label: routeLabel, value: getRouteProviderLabel(snapshot.routeProvider) }
    ];
    lines.push({ label: "迎車料金", value: formatYen(pickupFee) });
    if(specialVehicleFee > 0 || snapshot.specialVehicleFeeEnabled){
      lines.push({ label: "特殊車両使用料", value: formatYen(specialVehicleFee) });
    }
    lines.push(
      { label: "距離運賃", value: formatYen(distanceFare) },
      { label: "時間加算", value: formatYen(timeAdjustment) },
      { label: "介助料金", value: formatYen(assistanceFee + stairFee) },
      { label: "待機・付き添い料金", value: formatYen(waitingEscortFee) },
      { label: totalLabel, value: formatYen(total) + "～", isTotal: true }
    );

    return lines;
  }

  function buildFareCalculationEmailText(options){
    if(!options?.quoteSnapshot){
      return "";
    }
    const lines = buildFareCalculationLines(options);
    const body = lines.map(function(line){
      return line.label + "：" + line.value;
    });
    return [
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "■ 料金計算情報",
      "",
      body.join("\n"),
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "※表示は予約時点の料金目安です。",
      "実際の料金は介助内容・待機時間・交通状況等により変動する場合があります。"
    ].join("\n");
  }

  global.EstimateFareDisplay = {
    formatYen: formatYen,
    formatDistanceKm: formatDistanceKm,
    formatDurationMinutes: formatDurationMinutes,
    getRouteProviderLabel: getRouteProviderLabel,
    getFixedFareSectionTitle: getFixedFareSectionTitle,
    buildFareCalculationLines: buildFareCalculationLines,
    buildFareCalculationEmailText: buildFareCalculationEmailText,
    getLpFareModeLabelFromFareMode: getLpFareModeLabelFromFareMode,
    getLpFareModeLeadFromFareMode: getLpFareModeLeadFromFareMode,
    getLpFareModeTitleFromFareMode: getLpFareModeTitleFromFareMode,
    mapUsageSummaryForLp: mapUsageSummaryForLp
  };
})(typeof window !== "undefined" ? window : globalThis);
