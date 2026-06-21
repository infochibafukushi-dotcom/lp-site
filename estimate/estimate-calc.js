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
    let distanceMultiplier = 1;

    if(trip){
      const rawMultiplier = Number(trip.distanceMultiplier);
      if(rawMultiplier > 0){
        distanceMultiplier = rawMultiplier;
      }
    }

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

    const total = Object.keys(breakdown).reduce(function(sum, key){
      return sum + (Number(breakdown[key]) || 0);
    }, 0);

    return {
      breakdown: breakdown,
      total: total,
      usageSummary: buildUsageSummary(config, state)
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
