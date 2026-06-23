(function(global){
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

  function getDistanceMultiplier(config, state){
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

  function getCurrentFareMode(config){
    const mode = String(config?.fareMode || "").trim();
    if(mode === "time" || mode === "distance" || mode === "distance_time"){
      return mode;
    }
    return "time";
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
        { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" }
      ],
      distance: [
        { key: "baseFare", label: "基本運賃", calculator: "fixed_fee_ref", feeRef: "baseFare" },
        { key: "pickupFee", label: "迎車料金", calculator: "fixed_fee_ref", feeRef: "pickupFee" },
        { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" }
      ],
      distance_time: [
        { key: "baseFare", label: "基本運賃", calculator: "fixed_fee_ref", feeRef: "baseFare" },
        { key: "distanceFare", label: "距離運賃", calculator: "distance_pricing_ref", pricingRef: "distancePricing" },
        {
          key: "timeAdjustment",
          label: "時間加算",
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
    return Array.isArray(list) ? list : [];
  }

  function computeFixedFareBreakdown(config, state){
    const fareMode = getCurrentFareMode(config);
    const components = getFareComponents(config, fareMode);
    const distanceMultiplier = getDistanceMultiplier(config, state);
    const rideMinutes = Number(state?.routeCalcResult?.durationMinutes) || 0;
    const rows = [];

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
        amount = calcDistanceFare(state.distanceKm, pricing) * distanceMultiplier;
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
      fixedFareTotal: rows.reduce(function(sum, row){ return sum + row.amount; }, 0)
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
    }

    const fareMode = getCurrentFareMode(config);
    const fareModeLabelMap = {
      time: config.resultLabels?.fareModeTime || "時間制運賃",
      distance: config.resultLabels?.fareModeDistance || "距離制運賃",
      distance_time: config.resultLabels?.fareModeDistanceTime || "距離時間併用運賃"
    };
    lines.push({
      label: "運賃方式",
      value: fareModeLabelMap[fareMode] || fareModeLabelMap.time
    });

    const distanceLabel = config.page?.distanceLabel || "片道距離";
    const distance = Number(state.distanceKm);
    if(distance > 0){
      lines.push({ label: distanceLabel, value: distance.toFixed(1) + "km" });
    }

    return lines;
  }

  function computeEstimate(config, state){
    if(!config || !state){
      return { breakdown: {}, total: 0, usageSummary: [] };
    }

    const basic = config.basicFees || {};
    const baseFare = getFeeAmount(basic.baseFare);
    const reservationFee = getFeeAmount(basic.reservationFee);
    const pickupFee = getFeeAmount(basic.pickupFee);
    let distanceFare = calcDistanceFare(state.distanceKm, config.distancePricing);

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

    distanceFare = distanceFare * distanceMultiplier;

    const fixedFareData = computeFixedFareBreakdown(config, state);
    const serviceFees = [
      { key: "wheelchairFee", label: config.resultLabels?.wheelchairFee || "車いす料金", amount: wheelchairFee },
      { key: "assistanceFee", label: config.resultLabels?.assistanceFee || "介助料金", amount: assistanceFee },
      { key: "stairFee", label: config.resultLabels?.stairFee || "階段介助料金", amount: stairFee },
      { key: "waitingFee", label: config.resultLabels?.waitingFee || "待機料金", amount: waitingFee },
      { key: "escortFee", label: config.resultLabels?.escortFee || "付き添い料金", amount: escortFee }
    ].filter(function(row){
      return row.amount > 0;
    });
    const serviceTotal = serviceFees.reduce(function(sum, row){ return sum + row.amount; }, 0);

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
      reservationFee: reservationFee,
      pickupFee: pickupFee,
      distanceFare: distanceFare,
      wheelchairFee: wheelchairFee,
      assistanceFee: assistanceFee,
      stairFee: stairFee,
      waitingFee: waitingFee,
      escortFee: escortFee
    };
    const total = fixedFareData.fixedFareTotal + serviceTotal;
    const quoteSnapshot = {
      fareMode: fixedFareData.fareMode,
      fixedFareTotal: fixedFareData.fixedFareTotal,
      fixedFareBreakdown: fixedFareData.fixedFareBreakdown,
      serviceFees: serviceFees,
      expenses: expenses,
      roadType: String(state.roadType || "general") === "toll" ? "toll" : "general",
      distanceKm: Number(state.distanceKm) || 0,
      selectedRouteId: String(state.routePlan?.selectedRouteId || "")
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
    getAssistanceOptions: getAssistanceOptions,
    getMobilityAssistanceRule: getMobilityAssistanceRule,
    resolveAssistanceId: resolveAssistanceId,
    isRoundTripSelected: isRoundTripSelected,
    getTripTypeItems: getTripTypeItems,
    getRoundTripAddonItems: getRoundTripAddonItems
  };
})(typeof window !== "undefined" ? window : globalThis);
