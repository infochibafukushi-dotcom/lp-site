(function(global){
  const ESTIMATE_CALCULATION_VERSION = "v1";

  function visibleItems(list){
    if(!Array.isArray(list)) return [];
    return list
      .filter(function(item){ return item && item.visible !== false; })
      .sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
  }

  function findItem(list, id){
    if(!Array.isArray(list) || !id) return null;
    return list.find(function(item){ return item && item.id === id; }) || null;
  }

  function calcDistanceFare(distanceKm, distancePricing){
    const distance = Number(distanceKm);
    if(!distancePricing || !(distance > 0)) return 0;

    if(distancePricing.mode === "patternB"){
      const rate = Number(distancePricing.patternB?.perKmRate) || 0;
      return Math.round(distance * rate);
    }

    const pattern = distancePricing.patternA || {};
    const initialDistanceKm = Number(pattern.initialDistanceKm) || 0;
    const initialFare = Number(pattern.initialFare) || 0;
    const incrementDistanceKm = Number(pattern.incrementDistanceKm) || 0;
    const incrementFare = Number(pattern.incrementFare) || 0;

    if(distance <= initialDistanceKm){
      return initialFare;
    }
    if(!(incrementDistanceKm > 0)){
      return initialFare;
    }
    const excess = distance - initialDistanceKm;
    const increments = Math.ceil(excess / incrementDistanceKm);
    return initialFare + increments * incrementFare;
  }

  function calcTimeBlockFare(durationMinutes, params){
    const p = params || {};
    const minutes = Math.max(0, Number(durationMinutes) || 0);
    const baseMinutes = Math.max(0, Number(p.baseMinutes) || 0);
    const baseAmount = Math.max(0, Number(p.baseAmount) || 0);
    const perBlockMinutes = Math.max(0, Number(p.perBlockMinutes) || 0);
    const perBlockAmount = Math.max(0, Number(p.perBlockAmount) || 0);

    let amount = baseAmount;
    if(perBlockMinutes > 0 && perBlockAmount > 0 && minutes > baseMinutes){
      const extraMinutes = minutes - baseMinutes;
      amount += Math.ceil(extraMinutes / perBlockMinutes) * perBlockAmount;
    }
    return amount;
  }

  function getFeeAmount(feeObj){
    if(!feeObj || feeObj.visible === false) return 0;
    return Number(feeObj.amount) || 0;
  }

  function getMobilityAssistanceRule(config, mobilityId){
    const rules = config?.mappings?.mobilityAssistance || {};
    return rules[mobilityId] || null;
  }

  function getAssistanceOptions(config, mobilityId){
    const rule = getMobilityAssistanceRule(config, mobilityId);
    const allItems = config?.categories?.assistance?.items || [];
    if(!rule){
      return visibleItems(allItems);
    }
    if(rule.mode === "fixed"){
      const fixed = findItem(allItems, rule.assistanceId);
      return fixed ? [fixed] : [];
    }
    const ids = Array.isArray(rule.assistanceIds) ? rule.assistanceIds : [];
    return ids.map(function(id){ return findItem(allItems, id); }).filter(Boolean);
  }

  function resolveAssistanceId(config, state){
    const rule = getMobilityAssistanceRule(config, state.mobilityId);
    if(rule?.mode === "fixed"){
      return rule.assistanceId || "";
    }
    return state.assistanceId || "";
  }

  function isRoundTripSelected(config, state){
    const trip = findItem(config?.categories?.tripType?.items, state.tripTypeId);
    return trip?.id === "round-trip";
  }

  function getTripTypeItems(config){
    return visibleItems(config?.categories?.tripType?.items || []).filter(function(item){
      return item.showInSelector !== false;
    });
  }

  function getRoundTripAddonItems(config){
    return visibleItems(config?.categories?.roundTripAddon?.items || []);
  }

  const RETURN_PLAN_TYPES = {
    SAME_RETURN: "same_return",
    RETURN_WITH_STOP: "return_with_stop",
    DIFFERENT_RETURN: "different_return_destination",
    RETURN_PENDING: "return_pending"
  };

  function isStructuredRoutePlan(routePlan){
    return Boolean(routePlan && routePlan.outboundRoutePlan);
  }

  function getOutboundLegPlan(routePlan){
    if(!routePlan){
      return null;
    }
    if(routePlan.outboundRoutePlan){
      return routePlan.outboundRoutePlan;
    }
    return routePlan;
  }

  function getReturnLegPlan(routePlan){
    if(!routePlan || !routePlan.returnRoutePlan){
      return null;
    }
    return routePlan.returnRoutePlan;
  }

  function getLegPrimaryRoute(legPlan){
    if(!legPlan){
      return null;
    }
    if(Array.isArray(legPlan.routes) && legPlan.routes.length){
      const selectedId = String(legPlan.selectedRouteId || "");
      const selected = legPlan.routes.find(function(route){
        return String(route?.routeId || "") === selectedId;
      });
      return selected || legPlan.routes[0];
    }
    if(Array.isArray(legPlan.routeCandidates) && legPlan.routeCandidates.length){
      const selectedId = String(legPlan.selectedRouteId || "");
      const selected = legPlan.routeCandidates.find(function(route){
        return String(route?.routeId || "") === selectedId;
      });
      return selected || legPlan.routeCandidates[0];
    }
    return {
      distanceMeters: Number(legPlan.distanceMeters) || 0,
      durationSeconds: Number(legPlan.durationSeconds) || 0,
      encodedPolyline: String(legPlan.encodedPolyline || ""),
      routeId: String(legPlan.selectedRouteId || "route_0")
    };
  }

  function resolveReturnPlanType(state){
    const planType = String(state?.returnPlanType || "").trim();
    if(Object.values(RETURN_PLAN_TYPES).includes(planType)){
      return planType;
    }
    return RETURN_PLAN_TYPES.SAME_RETURN;
  }

  function usesSeparateReturnRoute(config, state){
    return isRoundTripSelected(config, state)
      && resolveReturnPlanType(state) !== RETURN_PLAN_TYPES.RETURN_PENDING;
  }

  function getDistanceMultiplier(config, state){
    if(usesSeparateReturnRoute(config, state) || isStructuredRoutePlan(state?.routePlan)){
      return 1;
    }
    const trip = findItem(config?.categories?.tripType?.items, state.tripTypeId);
    let distanceMultiplier = 1;
    if(trip){
      const rawMultiplier = Number(trip.distanceMultiplier);
      if(rawMultiplier > 0){
        distanceMultiplier = rawMultiplier;
      }
    }
    return distanceMultiplier;
  }

  function getEffectiveBilledDistanceKm(config, state){
    const routePlan = state?.routePlan;
    if(isStructuredRoutePlan(routePlan)){
      const totalMeters = Number(routePlan.totalDistanceMeters) || 0;
      if(totalMeters > 0){
        return Math.round((totalMeters / 1000) * 10) / 10;
      }
      const outbound = getOutboundLegPlan(routePlan);
      const outboundMeters = Number(getLegPrimaryRoute(outbound)?.distanceMeters || outbound?.distanceMeters) || 0;
      if(outboundMeters > 0){
        return Math.round((outboundMeters / 1000) * 10) / 10;
      }
    }
    const distance = Number(state?.distanceKm) || 0;
    return distance * getDistanceMultiplier(config, state);
  }

  function getEffectiveRideMinutes(state){
    const routePlan = state?.routePlan;
    if(isStructuredRoutePlan(routePlan)){
      const totalSeconds = Number(routePlan.totalDurationSeconds) || 0;
      if(totalSeconds > 0){
        return Math.max(1, Math.round(totalSeconds / 60));
      }
    }
    return Number(state?.routeCalcResult?.durationMinutes) || 0;
  }

  function getReturnPlanTypeLabel(planType){
    const labels = {
      same_return: "同じ場所へ戻る",
      return_with_stop: "帰りに立ち寄る",
      different_return_destination: "帰り先が違う",
      return_pending: "帰りは未定・診察後に相談"
    };
    return labels[String(planType || "")] || "";
  }

  function getReturnStopTypeLabel(stopType){
    const labels = {
      pharmacy: "薬局",
      supermarket: "スーパー・商業施設",
      facility: "施設",
      other: "その他"
    };
    return labels[String(stopType || "")] || "";
  }

  function getCurrentFareMode(config){
    const mode = String(config?.fareMode || "").trim();
    if(mode === "time" || mode === "distance" || mode === "distance_time" || mode === "pre_fixed_fare"){
      return mode;
    }
    return "time";
  }

  function isPreFixedFareMode(config){
    return getCurrentFareMode(config) === "pre_fixed_fare";
  }

  function resolveTrafficZone(config, state){
    const zoneId = String(
      state?.selectedTrafficZoneId
      || config?.preFixedFare?.trafficZoneId
      || ""
    ).trim();
    if(!zoneId){
      return null;
    }
    return findItem(config?.trafficZones?.items, zoneId) || null;
  }

  function resolveTrafficZoneDetection(config, state){
    if(global.EstimateTrafficZone && typeof global.EstimateTrafficZone.detectTrafficZone === "function"){
      return global.EstimateTrafficZone.detectTrafficZone(config, {
        originAddress: state?.originAddress || state?.routePlan?.pickup?.address || "",
        geocoding: state?.routePlan?.pickup?.geocoding || null
      });
    }
    const zoneId = String(config?.preFixedFare?.trafficZoneId || "").trim();
    const zone = findItem(config?.trafficZones?.items, zoneId);
    return {
      detectedMunicipality: null,
      selectedTrafficZoneId: zone?.id || zoneId || null,
      selectedTrafficZoneLabel: zone?.label || null,
      trafficZoneCoefficient: zone ? Number(zone.coefficient) || null : null,
      trafficZoneDetectionMethod: "fallback_config",
      trafficZoneDetectionSource: "origin_address"
    };
  }

  function applyTrafficZoneCoefficient(baseDistanceFareAmount, coefficient){
    const base = Math.max(0, Math.round(Number(baseDistanceFareAmount) || 0));
    const factor = Number(coefficient);
    if(!(base > 0) || !(factor > 0)){
      return base;
    }
    return Math.round(base * factor);
  }

  function pickupFeeComponent(config){
    return {
      key: "pickupFee",
      label: config?.resultLabels?.pickupFee || "迎車料金",
      calculator: "fixed_fee_ref",
      feeRef: "pickupFee"
    };
  }

  function specialVehicleFeeComponent(config){
    return {
      key: "specialVehicleFee",
      label: config?.resultLabels?.specialVehicleFee || "特殊車両使用料",
      calculator: "fixed_fee_ref",
      feeRef: "specialVehicleFee"
    };
  }

  function injectSpecialVehicleFeeComponent(config, components){
    if(!Array.isArray(components)){
      return components;
    }
    if(components.some(function(component){
      return String(component?.key || "") === "specialVehicleFee";
    })){
      return components;
    }
    const result = [];
    components.forEach(function(component){
      result.push(component);
      if(String(component?.key || "") === "pickupFee"){
        result.push(specialVehicleFeeComponent(config));
      }
    });
    return result;
  }

  function getDefaultFareComponents(config){
    return {
      time: [
        {
          key: "timeBaseFare",
          label: "時間制運賃",
          calculator: "time_block",
          params: {
            baseMinutes: 30,
            baseAmount: 5000,
            perBlockMinutes: 15,
            perBlockAmount: 1200
          }
        },
        pickupFeeComponent(config),
        specialVehicleFeeComponent(config)
      ],
      distance: [
        pickupFeeComponent(config),
        specialVehicleFeeComponent(config),
        { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" }
      ],
      distance_time: [
        pickupFeeComponent(config),
        specialVehicleFeeComponent(config),
        { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" },
        {
          key: "timeAdjustment",
          label: "予定時間加算（概算）",
          calculator: "time_block",
          params: {
            baseMinutes: 20,
            baseAmount: 0,
            perBlockMinutes: 10,
            perBlockAmount: 300
          }
        }
      ],
      pre_fixed_fare: [
        pickupFeeComponent(config),
        specialVehicleFeeComponent(config),
        { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" },
        {
          key: "timeAdjustment",
          label: "予定時間加算（概算）",
          calculator: "time_block",
          params: {
            baseMinutes: 20,
            baseAmount: 0,
            perBlockMinutes: 10,
            perBlockAmount: 300
          }
        }
      ]
    };
  }

  function getFareComponents(config, mode){
    const all = config?.fareComponents;
    const defaults = getDefaultFareComponents(config);
    const list = Array.isArray(all?.[mode]) ? all[mode] : defaults[mode];
    return injectSpecialVehicleFeeComponent(config, Array.isArray(list) ? list : []);
  }

  function formatDisplayKm(km){
    const n = Number(km) || 0;
    return n.toFixed(1) + "km";
  }

  function formatIncrementLabel(incrementKm){
    const n = Number(incrementKm) || 0;
    if(n > 0 && n < 1){
      return Math.round(n * 1000) + "m";
    }
    return n + "km";
  }

  function buildDistancePricingRules(pricing){
    if(!pricing){
      return [];
    }
    if(pricing.mode === "patternB"){
      const rate = Number(pricing.patternB?.perKmRate) || 0;
      return ["1km あたり " + rate + "円"];
    }
    const pattern = pricing.patternA || {};
    const initialDistanceKm = Number(pattern.initialDistanceKm) || 0;
    const initialFare = Number(pattern.initialFare) || 0;
    const incrementDistanceKm = Number(pattern.incrementDistanceKm) || 0;
    const incrementFare = Number(pattern.incrementFare) || 0;
    const rules = [];
    if(initialDistanceKm > 0 || initialFare > 0){
      rules.push("初乗 " + initialDistanceKm + "km まで " + initialFare + "円");
    }
    if(incrementDistanceKm > 0 && incrementFare > 0){
      rules.push("以後 " + formatIncrementLabel(incrementDistanceKm) + " ごとに " + incrementFare + "円加算");
    }
    return rules;
  }

  function buildTimeBlockRules(params){
    const p = params || {};
    const baseMinutes = Number(p.baseMinutes) || 0;
    const baseAmount = Number(p.baseAmount) || 0;
    const perBlockMinutes = Number(p.perBlockMinutes) || 0;
    const perBlockAmount = Number(p.perBlockAmount) || 0;
    const rules = [];
    if(baseMinutes > 0 || baseAmount > 0){
      rules.push("初回 " + baseMinutes + "分 " + baseAmount + "円");
    }
    if(perBlockMinutes > 0 && perBlockAmount > 0){
      rules.push("以後 " + perBlockMinutes + "分ごとに " + perBlockAmount + "円加算");
    }
    return rules;
  }

  function getFareModeLabel(config, fareMode){
    const labelMap = {
      time: config.resultLabels?.fareModeTime || "時間定額運賃",
      distance: config.resultLabels?.fareModeDistance || "距離定額運賃",
      distance_time: config.resultLabels?.fareModeDistanceTime || "距離＋予定時間加算（概算）",
      pre_fixed_fare: config.resultLabels?.fareModePreFixed || "事前確定運賃"
    };
    return labelMap[fareMode] || labelMap.time;
  }

  function getBreakdownAmount(rows, key){
    const row = Array.isArray(rows) ? rows.find(function(item){ return item && item.key === key; }) : null;
    return row ? Number(row.amount) || 0 : 0;
  }

  function buildDistanceUsageLines(config, state, distanceMultiplier){
    const routePlan = state?.routePlan;
    const trip = findItem(config?.categories?.tripType?.items, state.tripTypeId);
    const tripLabel = trip?.label || (distanceMultiplier > 1 ? "往復" : "片道");
    const lines = [
      { label: "送迎方法", value: tripLabel }
    ];

    if(isStructuredRoutePlan(routePlan)){
      const outbound = getOutboundLegPlan(routePlan);
      const returnLeg = getReturnLegPlan(routePlan);
      const outboundMeters = Number(getLegPrimaryRoute(outbound)?.distanceMeters || outbound?.distanceMeters) || 0;
      const returnMeters = returnLeg
        ? Number(getLegPrimaryRoute(returnLeg)?.distanceMeters || returnLeg?.distanceMeters) || 0
        : 0;
      const totalMeters = Number(routePlan.totalDistanceMeters) || (outboundMeters + returnMeters);

      if(outboundMeters > 0){
        lines.push({ label: "往路距離", value: formatDisplayKm(outboundMeters / 1000) });
      }
      if(returnMeters > 0){
        lines.push({ label: "復路距離", value: formatDisplayKm(returnMeters / 1000) });
      }
      if(routePlan.returnPlanType === RETURN_PLAN_TYPES.RETURN_PENDING){
        lines.push({ label: "復路", value: "確認対応（帰り未定）" });
      }
      if(totalMeters > 0){
        lines.push({ label: "計算対象距離", value: formatDisplayKm(totalMeters / 1000) });
      }
    }else{
      const distance = Number(state.distanceKm) || 0;
      if(!(distance > 0)){
        return { lines: [], usage: "" };
      }

      if(distanceMultiplier > 1){
        const billedDistance = distance * distanceMultiplier;
        const multiplierLabel = Number.isInteger(distanceMultiplier)
          ? String(distanceMultiplier)
          : String(distanceMultiplier);
        lines.push({ label: "片道距離", value: formatDisplayKm(distance) });
        lines.push({
          label: "計算対象距離",
          value: formatDisplayKm(billedDistance),
          note: formatDisplayKm(distance) + " × " + multiplierLabel
        });
      }else{
        lines.push({ label: "計算対象距離", value: formatDisplayKm(distance) });
      }
    }

    if(!lines.some(function(line){ return line.label === "計算対象距離"; })){
      const billedDistance = getEffectiveBilledDistanceKm(config, state);
      if(billedDistance > 0){
        lines.push({ label: "計算対象距離", value: formatDisplayKm(billedDistance) });
      }else{
        return { lines: [], usage: "" };
      }
    }

    const usage = lines.map(function(line){
      if(line.note){
        return line.label + "：" + line.value + "（" + line.note + "）";
      }
      return line.label + "：" + line.value;
    }).join("\n");

    return { lines: lines, usage: usage };
  }

  function buildDurationUsageLine(state, options){
    const opts = options || {};
    const minutes = getEffectiveRideMinutes(state);
    const routeEstimate = opts.routeEstimate === true;
    if(minutes > 0){
      if(routeEstimate){
        return "ルート予定時間: " + minutes + "分（Google Routes API の概算。認可メーターの低速走行加算とは異なります）";
      }
      return "使用時間: " + minutes + "分（ルート予定時間）";
    }
    if(routeEstimate){
      return "ルート予定時間: 未取得（住所検索で距離を計算すると予定時間が設定されます）";
    }
    return "使用時間: 未取得（住所検索で距離を計算すると予定時間が設定されます）";
  }

  function buildFareBasisNotices(fareMode, preFixedFareMeta){
    const notices = ["表示は見積時点の運賃設定に基づく計算根拠です。"];
    if(fareMode === "distance_time" || fareMode === "pre_fixed_fare"){
      notices.push("時間加算はルート予定時間に基づく概算です。実走行では認可メーター（低速走行時の時間距離併用）が適用されます。");
      notices.push("待機時間は運賃計算に含まれません。");
    }else{
      notices.push("待機時間・低速走行時間は運賃計算に含まれません。");
    }
    if(fareMode === "pre_fixed_fare" && preFixedFareMeta?.trafficZoneCoefficient > 0){
      notices.push(
        "距離運賃には交通圏平準化係数（"
        + preFixedFareMeta.trafficZoneCoefficient
        + "）を適用しています。介助料・待機料・実費には適用しません。"
      );
    }
    return notices;
  }

  function buildFareBasis(config, state, fixedFareData){
    const fareMode = fixedFareData.fareMode;
    const rows = fixedFareData.fixedFareBreakdown || [];
    const distanceMultiplier = getDistanceMultiplier(config, state);
    const pricing = config.distancePricing;
    const components = getFareComponents(config, fareMode);
    const sections = [];
    const notices = buildFareBasisNotices(fareMode, fixedFareData.preFixedFareMeta);
    const rideMinutes = getEffectiveRideMinutes(state);
    let hasTimeBlock = false;

    components.forEach(function(component){
      const calculator = String(component?.calculator || "").trim();
      const key = String(component?.key || "");
      const amount = getBreakdownAmount(rows, key);

      if(calculator === "fixed_fee_ref"){
        const feeRef = String(component?.feeRef || "").trim();
        const feeAmount = getFeeAmount(config?.basicFees?.[feeRef]);
        sections.push({
          key: key,
          title: String(component.label || key),
          rules: [String(component.label || key) + " " + feeAmount + "円"],
          usage: "",
          amountLabel: String(component.label || key),
          amount: amount
        });
        return;
      }

      if(calculator === "distance_pricing_ref"){
        const distanceUsage = buildDistanceUsageLines(config, state, distanceMultiplier);
        const rules = buildDistancePricingRules(pricing);
        const preFixedMeta = fixedFareData.preFixedFareMeta;
        if(
          fareMode === "pre_fixed_fare"
          && preFixedMeta
          && preFixedMeta.trafficZoneCoefficient > 0
          && preFixedMeta.baseDistanceFareAmount > 0
        ){
          rules.push(
            "認可距離制運賃 "
            + preFixedMeta.baseDistanceFareAmount
            + "円 × 平準化係数 "
            + preFixedMeta.trafficZoneCoefficient
            + " = "
            + preFixedMeta.adjustedDistanceFareAmount
            + "円"
          );
        }
        sections.push({
          key: key,
          title: fareMode === "distance_time" || fareMode === "pre_fixed_fare" ? "距離部分" : "距離定額",
          rules: rules,
          usage: distanceUsage.usage,
          usageLines: distanceUsage.lines,
          amountLabel: String(component.label || "距離運賃"),
          amount: amount
        });
        return;
      }

      if(calculator === "time_block"){
        hasTimeBlock = true;
        const isAdjustment = key === "timeAdjustment";
        sections.push({
          key: key,
          title: isAdjustment ? "予定時間加算（概算）" : "時間定額",
          rules: buildTimeBlockRules(component?.params),
          usage: buildDurationUsageLine(state, { routeEstimate: isAdjustment }),
          amountLabel: String(component.label || (isAdjustment ? "予定時間加算（概算）" : "時間定額運賃")),
          amount: amount
        });
      }
    });

    if(hasTimeBlock && rideMinutes <= 0){
      notices.push("予定時間が未取得のため、時間に基づく運賃は算出できていない可能性があります。");
    }

    return {
      fareMode: fareMode,
      fareModeLabel: getFareModeLabel(config, fareMode),
      durationMinutes: rideMinutes,
      distanceKm: getEffectiveBilledDistanceKm(config, state),
      distanceMultiplier: distanceMultiplier,
      sections: sections,
      notices: notices
    };
  }

  function computeFixedFareBreakdown(config, state){
    const fareMode = getCurrentFareMode(config);
    const components = getFareComponents(config, fareMode);
    const distanceMultiplier = getDistanceMultiplier(config, state);
    const rideMinutes = getEffectiveRideMinutes(state);
    const rows = [];

    let baseDistanceFareAmount = 0;
    let adjustedDistanceFareAmount = 0;
    let preFixedFareMeta = null;

    components.forEach(function(component, index){
      const calculator = String(component?.calculator || "").trim();
      const key = String(component?.key || "component-" + index);
      const label = String(component?.label || key);
      let amount = 0;
      if(calculator === "fixed_fee_ref"){
        const feeRef = String(component?.feeRef || "").trim();
        amount = getFeeAmount(config?.basicFees?.[feeRef]);
      }else if(calculator === "distance_pricing_ref"){
        const pricingRef = String(component?.pricingRef || "").trim() || "distancePricing";
        const pricing = config?.[pricingRef] || config?.distancePricing;
        amount = calcDistanceFare(getEffectiveBilledDistanceKm(config, state), pricing);
        if(isPreFixedFareMode(config)){
          baseDistanceFareAmount = Math.max(0, Math.round(Number(amount) || 0));
          const trafficZone = resolveTrafficZone(config, state);
          const coefficient = trafficZone ? Number(trafficZone.coefficient) : 0;
          adjustedDistanceFareAmount = applyTrafficZoneCoefficient(baseDistanceFareAmount, coefficient);
          amount = adjustedDistanceFareAmount;
          preFixedFareMeta = {
            baseDistanceFareAmount: baseDistanceFareAmount,
            adjustedDistanceFareAmount: adjustedDistanceFareAmount,
            selectedTrafficZoneId: trafficZone?.id || null,
            selectedTrafficZoneLabel: trafficZone?.label || null,
            trafficZoneCoefficient: coefficient > 0 ? coefficient : null
          };
        }
      }else if(calculator === "time_block"){
        amount = calcTimeBlockFare(rideMinutes, component?.params);
      }
      const n = Math.max(0, Math.round(Number(amount) || 0));
      if(n > 0){
        rows.push({ key: key, label: label, amount: n, calculator: calculator });
      }
    });

    return {
      fareMode: fareMode,
      fixedFareBreakdown: rows,
      fixedFareTotal: rows.reduce(function(sum, row){ return sum + row.amount; }, 0),
      preFixedFareMeta: preFixedFareMeta
    };
  }

  function buildUsageSummary(config, state){
    const lines = [];
    const mobility = findItem(config.categories?.mobility?.items, state.mobilityId);
    if(mobility){
      lines.push({ label: config.categories.mobility.label || "移動方法", value: mobility.label });
    }

    const assistance = findItem(config.categories?.assistance?.items, resolveAssistanceId(config, state));
    if(assistance){
      lines.push({ label: config.categories.assistance.label || "介助内容", value: assistance.label });
    }

    const stair = findItem(config.categories?.stairAssist?.items, state.stairId);
    if(stair){
      lines.push({ label: config.categories.stairAssist.label || "階段介助", value: stair.label });
    }

    const trip = findItem(config.categories?.tripType?.items, state.tripTypeId);
    if(trip){
      lines.push({ label: config.categories.tripType.label || "送迎方法", value: trip.label });
    }

    if(isRoundTripSelected(config, state)){
      const addon = findItem(config.categories?.roundTripAddon?.items, state.roundTripAddonId);
      if(addon){
        lines.push({
          label: config.categories.roundTripAddon?.label || "待機・付き添い",
          value: addon.label
        });
      }
      const returnPlanLabel = getReturnPlanTypeLabel(resolveReturnPlanType(state));
      if(returnPlanLabel){
        lines.push({ label: "帰りの予定", value: returnPlanLabel });
      }
      if(resolveReturnPlanType(state) === RETURN_PLAN_TYPES.RETURN_WITH_STOP){
        const stopLabel = getReturnStopTypeLabel(state.returnStopType);
        const stopAddress = String(state.returnStopAddress || "").trim();
        if(stopLabel){
          lines.push({ label: "立ち寄り先種別", value: stopLabel });
        }
        if(stopAddress){
          lines.push({ label: "立ち寄り先", value: stopAddress });
        }
      }
      if(resolveReturnPlanType(state) === RETURN_PLAN_TYPES.DIFFERENT_RETURN){
        const returnAddress = String(state.differentReturnAddress || "").trim();
        if(returnAddress){
          lines.push({ label: "帰り先", value: returnAddress });
        }
      }
    }

    const fareMode = getCurrentFareMode(config);
    const fareModeLabelMap = {
      time: config.resultLabels?.fareModeTime || "時間定額運賃",
      distance: config.resultLabels?.fareModeDistance || "距離定額運賃",
      distance_time: config.resultLabels?.fareModeDistanceTime || "距離＋予定時間加算（概算）",
      pre_fixed_fare: config.resultLabels?.fareModePreFixed || "事前確定運賃"
    };
    lines.push({
      label: "運賃方式",
      value: fareModeLabelMap[fareMode] || fareModeLabelMap.time
    });

    const distanceLabel = config.page?.distanceLabel || "片道距離";
    const billedDistance = getEffectiveBilledDistanceKm(config, state);
    if(billedDistance > 0){
      if(isStructuredRoutePlan(state.routePlan)){
        lines.push({ label: "計算対象距離", value: billedDistance.toFixed(1) + "km" });
      }else{
        lines.push({ label: distanceLabel, value: billedDistance.toFixed(1) + "km" });
      }
    }

    return lines;
  }

  function getRoutePlanPrimaryRoute(routePlan){
    const outbound = getOutboundLegPlan(routePlan);
    return getLegPrimaryRoute(outbound);
  }

  function buildLegRouteSnapshot(legPlan){
    if(!legPlan){
      return {};
    }
    const routes = Array.isArray(legPlan.routes) ? legPlan.routes
      : (Array.isArray(legPlan.routeCandidates) ? legPlan.routeCandidates : []);
    const selectedId = String(legPlan.selectedRouteId || "");
    const selectedIndex = routes.findIndex(function(route){
      return String(route?.routeId || "") === selectedId;
    });
    const selected = selectedIndex >= 0
      ? routes[selectedIndex]
      : getLegPrimaryRoute(legPlan);
    const label = selected
      ? formatRouteLabel(selected, selectedIndex >= 0 ? selectedIndex : 0)
      : "";
    const confirmable = legPlan.preFixedFareConfirmable === true;
    const routeCandidates = routes.map(buildRouteCandidateSnapshot);

    return {
      origin: legPlan.origin || null,
      destination: legPlan.destination || null,
      waypoint: legPlan.waypoint || null,
      distanceMeters: Number(selected?.distanceMeters || legPlan.distanceMeters) || 0,
      durationSeconds: Number(selected?.durationSeconds || legPlan.durationSeconds) || 0,
      selectedRouteId: selectedId || String(selected?.routeId || ""),
      selectedRoute: selected || null,
      selectedRouteLabel: label || null,
      selectedRouteIndex: selectedIndex >= 0 ? selectedIndex : 0,
      selectedRouteStrategy: selected?.routeStrategy || null,
      selectedRouteSource: selected?.routeSource || legPlan.provider || null,
      encodedPolyline: String(selected?.encodedPolyline || legPlan.encodedPolyline || ""),
      routeToken: String(selected?.routeToken || legPlan.routeToken || ""),
      routeSummary: String(selected?.routeSummary || label || "").trim() || null,
      tollInfo: selected?.tollInfo ?? legPlan.tollInfo ?? null,
      tollPreference: selected?.tollPreference || null,
      tollExcludedFromFare: selected?.tollExcludedFromFare === true,
      intermediateWaypoint: selected?.intermediateWaypoint || legPlan.waypoint || null,
      roadType: String(selected?.roadType || legPlan.roadType || "general") === "toll" ? "toll" : "general",
      routeCandidates: routeCandidates,
      preFixedFareConfirmable: confirmable,
      routeCandidateCount: routes.length,
      distinctRouteCount: Number(legPlan.distinctRouteCount) || routes.length,
      fallbackReason: legPlan.fallbackReason || null,
      selectedAt: legPlan.selectedAt || null
    };
  }

  function buildStructuredRoutePlanSnapshot(state){
    const routePlan = state?.routePlan;
    if(!isStructuredRoutePlan(routePlan)){
      return null;
    }
    const outbound = buildLegRouteSnapshot(getOutboundLegPlan(routePlan));
    const returnLeg = getReturnLegPlan(routePlan);
    const returnSnapshot = returnLeg ? buildLegRouteSnapshot(returnLeg) : null;
    return {
      tripType: routePlan.tripType || "one_way",
      returnPlanType: routePlan.returnPlanType || null,
      outboundRoutePlan: outbound,
      returnRoutePlan: returnSnapshot,
      totalDistanceMeters: Number(routePlan.totalDistanceMeters) || 0,
      totalDurationSeconds: Number(routePlan.totalDurationSeconds) || 0,
      preFixedFareScope: routePlan.preFixedFareScope || "outbound_only",
      returnFareStatus: routePlan.returnFareStatus || null
    };
  }

  function resolveRouteProvider(state){
    const provider = String(state?.routePlan?.provider || "").trim();
    if(provider === "google_routes"){
      return "google_routes";
    }
    if(String(state?.distanceInputMode || "") === "manual" || !state?.routePlan){
      return "manual_distance";
    }
    return provider || "manual_distance";
  }

  function resolveDistanceMeters(state){
    const routePlan = state?.routePlan;
    if(isStructuredRoutePlan(routePlan)){
      const total = Number(routePlan.totalDistanceMeters) || 0;
      if(total > 0){
        return total;
      }
    }
    if(routePlan){
      const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
      const meters = Number(primaryRoute?.distanceMeters || routePlan.distanceMeters) || 0;
      if(meters > 0){
        return meters;
      }
    }
    const km = Number(state?.distanceKm) || 0;
    return km > 0 ? Math.round(km * 1000) : 0;
  }

  function resolveDurationSeconds(state){
    const routePlan = state?.routePlan;
    if(isStructuredRoutePlan(routePlan)){
      const total = Number(routePlan.totalDurationSeconds) || 0;
      if(total > 0){
        return total;
      }
    }
    if(routePlan){
      const primaryRoute = getRoutePlanPrimaryRoute(routePlan);
      const seconds = Number(primaryRoute?.durationSeconds || routePlan.durationSeconds) || 0;
      if(seconds > 0){
        return seconds;
      }
    }
    const minutes = getEffectiveRideMinutes(state);
    return minutes > 0 ? Math.round(minutes * 60) : 0;
  }

  function formatRouteLabel(route, index){
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

  function buildRouteCandidateSnapshot(route, index){
    return {
      routeId: String(route.routeId || ""),
      routeIndex: index,
      label: formatRouteLabel(route, index),
      routeLabel: String(route.routeLabel || formatRouteLabel(route, index)),
      routeDescription: String(route.routeDescription || ""),
      routeStrategy: route.routeStrategy || null,
      routeSource: route.routeSource || null,
      distanceMeters: Number(route.distanceMeters) || 0,
      durationSeconds: Number(route.durationSeconds) || 0,
      distanceKm: Number(route.distanceKm) || 0,
      encodedPolyline: String(route.encodedPolyline || ""),
      routeToken: String(route.routeToken || ""),
      routeSummary: String(route.routeSummary || "").trim() || null,
      roadType: String(route.roadType || "") === "toll" ? "toll" : "general",
      avoidTolls: route.avoidTolls === true,
      avoidHighways: route.avoidHighways === true,
      tollInfo: route.tollInfo || null,
      tollPreference: route.tollPreference || null,
      tollExcludedFromFare: route.tollExcludedFromFare === true,
      intermediateWaypoint: route.intermediateWaypoint || null
    };
  }

  function buildSelectedRouteSnapshot(state){
    const structured = buildStructuredRoutePlanSnapshot(state);
    if(structured){
      const outbound = structured.outboundRoutePlan || {};
      const returnLeg = structured.returnRoutePlan;
      const confirmable = structured.preFixedFareScope === "outbound_and_return"
        ? outbound.preFixedFareConfirmable === true && returnLeg?.preFixedFareConfirmable === true
        : outbound.preFixedFareConfirmable === true;
      return Object.assign({}, outbound, {
        routePlan: structured,
        outboundRoutePlan: structured.outboundRoutePlan,
        returnRoutePlan: structured.returnRoutePlan,
        tripType: structured.tripType,
        returnPlanType: structured.returnPlanType,
        totalDistanceMeters: structured.totalDistanceMeters,
        totalDurationSeconds: structured.totalDurationSeconds,
        preFixedFareScope: structured.preFixedFareScope,
        returnFareStatus: structured.returnFareStatus,
        routeCandidates: outbound.routeCandidates || [],
        alternativeRoutes: outbound.routeCandidates || [],
        alternativeRouteCount: outbound.routeCandidateCount ?? 0,
        multipleRoutesAvailable: confirmable,
        preFixedFareConfirmable: confirmable,
        routeDedupedCount: outbound.distinctRouteCount ?? 0,
        routeGenerationStrategies: [],
        fallbackReason: outbound.fallbackReason || null
      });
    }

    const routePlan = state?.routePlan;
    if(!routePlan){
      return {};
    }
    const routes = Array.isArray(routePlan.routes) ? routePlan.routes : [];
    const selectedId = String(routePlan.selectedRouteId || "");
    const selectedIndex = routes.findIndex(function(route){
      return String(route?.routeId || "") === selectedId;
    });
    const selected = selectedIndex >= 0
      ? routes[selectedIndex]
      : getRoutePlanPrimaryRoute(routePlan);
    const label = selected
      ? formatRouteLabel(selected, selectedIndex >= 0 ? selectedIndex : 0)
      : "";
    const confirmable = routePlan.preFixedFareConfirmable === true;
    const routeCandidates = routes.map(buildRouteCandidateSnapshot);

    return {
      selectedRouteId: selectedId || String(selected?.routeId || ""),
      selectedRouteLabel: label || null,
      selectedRouteIndex: selectedIndex >= 0 ? selectedIndex : 0,
      selectedRouteStrategy: selected?.routeStrategy || null,
      selectedRouteSource: selected?.routeSource || routePlan.provider || null,
      encodedPolyline: String(selected?.encodedPolyline || routePlan.encodedPolyline || ""),
      routeToken: String(selected?.routeToken || routePlan.routeToken || ""),
      routeSummary: String(selected?.routeSummary || label || "").trim() || null,
      tollInfo: selected?.tollInfo ?? routePlan.tollInfo ?? null,
      tollPreference: selected?.tollPreference || null,
      tollExcludedFromFare: selected?.tollExcludedFromFare === true,
      intermediateWaypoint: selected?.intermediateWaypoint || null,
      roadType: String(selected?.roadType || routePlan.roadType || state.roadType || "general") === "toll" ? "toll" : "general",
      routeCandidates: routeCandidates,
      alternativeRoutes: routeCandidates,
      routeCandidateCount: routes.length,
      distinctRouteCount: Number(routePlan.distinctRouteCount) || routes.length,
      alternativeRouteCount: routes.length,
      multipleRoutesAvailable: confirmable,
      preFixedFareConfirmable: confirmable,
      routeDedupedCount: Number(routePlan.routeDedupedCount) || routes.length,
      routeGenerationStrategies: Array.isArray(routePlan.routeGenerationStrategies)
        ? routePlan.routeGenerationStrategies.slice()
        : [],
      fallbackReason: routePlan.fallbackReason || null,
      selectedAt: routePlan.selectedAt || null
    };
  }

  function computeEstimate(config, state){
    if(!config || !state){
      return { breakdown: {}, total: 0, usageSummary: [] };
    }

    const basic = config.basicFees || {};
    const baseFare = getFeeAmount(basic.baseFare);
    const pickupFee = getFeeAmount(basic.pickupFee);
    const specialVehicleFee = getFeeAmount(basic.specialVehicleFee);
    const specialVehicleFeeEnabled = basic.specialVehicleFee?.visible !== false;
    let distanceFare = calcDistanceFare(getEffectiveBilledDistanceKm(config, state), config.distancePricing);

    const mobility = findItem(config.categories?.mobility?.items, state.mobilityId);
    const wheelchairFee = mobility ? getFeeAmount(mobility) : 0;

    const assistance = findItem(
      config.categories?.assistance?.items,
      resolveAssistanceId(config, state)
    );
    const assistanceFee = assistance ? getFeeAmount(assistance) : 0;

    const stair = findItem(config.categories?.stairAssist?.items, state.stairId);
    const stairFee = stair ? getFeeAmount(stair) : 0;

    const trip = findItem(config.categories?.tripType?.items, state.tripTypeId);
    let waitingFee = 0;
    let escortFee = 0;
    const distanceMultiplier = getDistanceMultiplier(config, state);

    if(isRoundTripSelected(config, state)){
      const addon = findItem(config.categories?.roundTripAddon?.items, state.roundTripAddonId);
      if(addon){
        const waitingRef = String(addon.waitingFeeRef || "").trim();
        if(waitingRef && config.waitingFees?.[waitingRef]){
          waitingFee = getFeeAmount(config.waitingFees[waitingRef]);
        }
        const escortRef = String(addon.escortFeeRef || "").trim();
        if(escortRef && config.waitingFees?.[escortRef]){
          escortFee = getFeeAmount(config.waitingFees[escortRef]);
        }
      }
    }

    distanceFare = calcDistanceFare(getEffectiveBilledDistanceKm(config, state), config.distancePricing);

    let trafficZoneDetection = null;
    let computeState = state;
    if(isPreFixedFareMode(config)){
      trafficZoneDetection = resolveTrafficZoneDetection(config, state);
      computeState = Object.assign({}, state, {
        selectedTrafficZoneId: trafficZoneDetection.selectedTrafficZoneId
      });
    }

    const fixedFareData = computeFixedFareBreakdown(config, computeState);
    if(fixedFareData.preFixedFareMeta?.adjustedDistanceFareAmount > 0){
      distanceFare = fixedFareData.preFixedFareMeta.adjustedDistanceFareAmount;
    }
    const serviceFees = [
      {
        key: "specialVehicleFee",
        label: config.resultLabels?.specialVehicleFee || "特殊車両使用料",
        amount: specialVehicleFee
      },
      { key: "wheelchairFee", label: config.resultLabels?.wheelchairFee || "車いす料金", amount: wheelchairFee },
      { key: "assistanceFee", label: config.resultLabels?.assistanceFee || "介助料金", amount: assistanceFee },
      { key: "stairFee", label: config.resultLabels?.stairFee || "階段介助料金", amount: stairFee },
      { key: "waitingFee", label: config.resultLabels?.waitingFee || "待機料金", amount: waitingFee },
      { key: "escortFee", label: config.resultLabels?.escortFee || "付き添い料金", amount: escortFee }
    ].filter(function(row){
      return row.amount > 0;
    });
    const serviceTotal = serviceFees.reduce(function(sum, row){
      if(row.key === "specialVehicleFee"){
        return sum;
      }
      return sum + row.amount;
    }, 0);

    const expenses = [];
    if(String(state.roadType || "") === "toll"){
      expenses.push({
        key: "tollRoadExpense",
        label: config.resultLabels?.tollRoadExpense || "有料道路・高速道路通行料金",
        note: config.page?.tollRoadNote || "通行料金は実費負担となります。"
      });
    }

    const breakdown = {
      baseFare: baseFare,
      pickupFee: pickupFee,
      specialVehicleFee: specialVehicleFee,
      distanceFare: distanceFare,
      wheelchairFee: wheelchairFee,
      assistanceFee: assistanceFee,
      stairFee: stairFee,
      waitingFee: waitingFee,
      escortFee: escortFee
    };
    const total = fixedFareData.fixedFareTotal + serviceTotal;
    const fareBasis = buildFareBasis(config, state, fixedFareData);
    const preFixedMeta = fixedFareData.preFixedFareMeta;
    const routeSnapshot = buildSelectedRouteSnapshot(state);
    const quoteSnapshot = {
      fareMode: fixedFareData.fareMode,
      distancePricing: config.distancePricing ? JSON.parse(JSON.stringify(config.distancePricing)) : null,
      fareComponents: config.fareComponents ? JSON.parse(JSON.stringify(config.fareComponents)) : null,
      fareBasis: fareBasis,
      fixedFareTotal: fixedFareData.fixedFareTotal,
      fixedFareBreakdown: fixedFareData.fixedFareBreakdown,
      pickupFee: pickupFee,
      specialVehicleFeeEnabled: specialVehicleFeeEnabled,
      specialVehicleFeeAmount: specialVehicleFee,
      serviceFees: serviceFees,
      expenses: expenses,
      roadType: routeSnapshot.roadType || (String(state.roadType || "general") === "toll" ? "toll" : "general"),
      distanceKm: getEffectiveBilledDistanceKm(config, state),
      billedDistanceKm: getEffectiveBilledDistanceKm(config, state),
      routePlan: routeSnapshot.routePlan || buildStructuredRoutePlanSnapshot(state) || null,
      tripType: routeSnapshot.tripType || (isRoundTripSelected(config, state) ? "round_trip" : "one_way"),
      returnPlanType: routeSnapshot.returnPlanType || (isRoundTripSelected(config, state) ? resolveReturnPlanType(state) : null),
      outboundRoutePlan: routeSnapshot.outboundRoutePlan || null,
      returnRoutePlan: routeSnapshot.returnRoutePlan || null,
      totalDistanceMeters: routeSnapshot.totalDistanceMeters ?? resolveDistanceMeters(state),
      totalDurationSeconds: routeSnapshot.totalDurationSeconds ?? resolveDurationSeconds(state),
      preFixedFareScope: routeSnapshot.preFixedFareScope || null,
      returnFareStatus: routeSnapshot.returnFareStatus || null,
      selectedRouteId: routeSnapshot.selectedRouteId || "",
      selectedRouteLabel: routeSnapshot.selectedRouteLabel || null,
      selectedRouteIndex: routeSnapshot.selectedRouteIndex ?? null,
      selectedRouteStrategy: routeSnapshot.selectedRouteStrategy || null,
      selectedRouteSource: routeSnapshot.selectedRouteSource || null,
      encodedPolyline: routeSnapshot.encodedPolyline || "",
      routeToken: routeSnapshot.routeToken || "",
      routeSummary: routeSnapshot.routeSummary || null,
      tollInfo: routeSnapshot.tollInfo || null,
      tollPreference: routeSnapshot.tollPreference || null,
      tollExcludedFromFare: routeSnapshot.tollExcludedFromFare === true,
      intermediateWaypoint: routeSnapshot.intermediateWaypoint || null,
      routeCandidates: routeSnapshot.routeCandidates || [],
      alternativeRoutes: routeSnapshot.alternativeRoutes || routeSnapshot.routeCandidates || [],
      routeCandidateCount: routeSnapshot.routeCandidateCount ?? 0,
      distinctRouteCount: routeSnapshot.distinctRouteCount ?? 0,
      alternativeRouteCount: routeSnapshot.alternativeRouteCount ?? 0,
      multipleRoutesAvailable: routeSnapshot.multipleRoutesAvailable === true,
      preFixedFareConfirmable: routeSnapshot.preFixedFareConfirmable === true,
      routeDedupedCount: routeSnapshot.routeDedupedCount ?? 0,
      routeGenerationStrategies: routeSnapshot.routeGenerationStrategies || [],
      fallbackReason: routeSnapshot.fallbackReason || null,
      selectedAt: routeSnapshot.selectedAt || null,
      selectedTrafficZoneId: preFixedMeta?.selectedTrafficZoneId || trafficZoneDetection?.selectedTrafficZoneId || null,
      selectedTrafficZoneLabel: preFixedMeta?.selectedTrafficZoneLabel || trafficZoneDetection?.selectedTrafficZoneLabel || null,
      trafficZoneCoefficient: preFixedMeta?.trafficZoneCoefficient ?? trafficZoneDetection?.trafficZoneCoefficient ?? null,
      detectedMunicipality: trafficZoneDetection?.detectedMunicipality || null,
      trafficZoneDetectionMethod: trafficZoneDetection?.trafficZoneDetectionMethod || null,
      trafficZoneDetectionSource: trafficZoneDetection?.trafficZoneDetectionSource || null,
      baseDistanceFareAmount: preFixedMeta?.baseDistanceFareAmount ?? null,
      adjustedDistanceFareAmount: preFixedMeta?.adjustedDistanceFareAmount ?? null,
      preFixedFareMode: isPreFixedFareMode(config),
      routeProvider: resolveRouteProvider(state),
      distanceMeters: resolveDistanceMeters(state),
      durationSeconds: resolveDurationSeconds(state),
      estimateCalculationVersion: ESTIMATE_CALCULATION_VERSION
    };

    return {
      breakdown: breakdown,
      total: total,
      usageSummary: buildUsageSummary(config, state),
      quoteSnapshot: quoteSnapshot,
      routePlan: state.routePlan || null
    };
  }

  global.EstimateCalc = {
    visibleItems: visibleItems,
    findItem: findItem,
    calcDistanceFare: calcDistanceFare,
    computeEstimate: computeEstimate,
    buildUsageSummary: buildUsageSummary,
    buildFareBasis: buildFareBasis,
    getAssistanceOptions: getAssistanceOptions,
    getMobilityAssistanceRule: getMobilityAssistanceRule,
    resolveAssistanceId: resolveAssistanceId,
    isRoundTripSelected: isRoundTripSelected,
    getTripTypeItems: getTripTypeItems,
    getRoundTripAddonItems: getRoundTripAddonItems,
    RETURN_PLAN_TYPES: RETURN_PLAN_TYPES,
    isStructuredRoutePlan: isStructuredRoutePlan,
    getOutboundLegPlan: getOutboundLegPlan,
    getReturnLegPlan: getReturnLegPlan,
    getLegPrimaryRoute: getLegPrimaryRoute,
    resolveReturnPlanType: resolveReturnPlanType,
    usesSeparateReturnRoute: usesSeparateReturnRoute,
    getDistanceMultiplier: getDistanceMultiplier,
    getEffectiveBilledDistanceKm: getEffectiveBilledDistanceKm,
    getEffectiveRideMinutes: getEffectiveRideMinutes,
    getReturnPlanTypeLabel: getReturnPlanTypeLabel,
    getReturnStopTypeLabel: getReturnStopTypeLabel,
    buildStructuredRoutePlanSnapshot: buildStructuredRoutePlanSnapshot
  };
})(typeof window !== "undefined" ? window : globalThis);
