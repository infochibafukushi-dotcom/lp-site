(function(global){
  function isObject(value){
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function pushError(errors, message){
    errors.push(message);
  }

  function validateCategoryItems(errors, prefix, items, requireTripBehavior){
    if(!Array.isArray(items)){
      pushError(errors, prefix + " must be an array");
      return;
    }
    items.forEach(function(item, index){
      const path = prefix + "[" + index + "]";
      if(!isObject(item)){
        pushError(errors, path + " must be an object");
        return;
      }
      if(!item.id || typeof item.id !== "string"){
        pushError(errors, path + ".id is required");
      }
      if(!item.label || typeof item.label !== "string"){
        pushError(errors, path + ".label is required");
      }
      if(item.amount != null && typeof item.amount !== "number"){
        pushError(errors, path + ".amount must be a number");
      }
      if(requireTripBehavior){
        if(item.distanceMultiplier != null && !(Number(item.distanceMultiplier) > 0)){
          pushError(errors, path + ".distanceMultiplier must be a number greater than 0");
        }
        if(item.waitingFeeRef != null && typeof item.waitingFeeRef !== "string"){
          pushError(errors, path + ".waitingFeeRef must be a string");
        }
        if(item.escortFeeRef != null && typeof item.escortFeeRef !== "string"){
          pushError(errors, path + ".escortFeeRef must be a string");
        }
      }
    });
  }

  function validateEstimateConfig(data){
    const errors = [];

    if(!isObject(data)){
      return { ok: false, errors: ["root must be an object"] };
    }

    if(typeof data.enabled !== "boolean"){
      pushError(errors, "enabled must be a boolean");
    }
    if(typeof data.version !== "number"){
      pushError(errors, "version must be a number");
    }
    if(!data.storeId || typeof data.storeId !== "string"){
      pushError(errors, "storeId is required");
    }

    if(!isObject(data.page)){
      pushError(errors, "page is required");
    }else{
      ["title", "description", "disclaimer"].forEach(function(key){
        if(typeof data.page[key] !== "string"){
          pushError(errors, "page." + key + " must be a string");
        }
      });
    }

    if(!isObject(data.basicFees)){
      pushError(errors, "basicFees is required");
    }

    if(!isObject(data.distancePricing)){
      pushError(errors, "distancePricing is required");
    }else if(data.distancePricing.mode !== "patternA" && data.distancePricing.mode !== "patternB"){
      pushError(errors, 'distancePricing.mode must be "patternA" or "patternB"');
    }

    if(!isObject(data.categories)){
      pushError(errors, "categories is required");
    }else{
      ["mobility", "assistance", "stairAssist", "tripType"].forEach(function(key){
        const category = data.categories[key];
        if(!isObject(category)){
          pushError(errors, "categories." + key + " is required");
          return;
        }
        validateCategoryItems(
          errors,
          "categories." + key + ".items",
          category.items,
          key === "tripType"
        );
      });
    }

    if(data.historySettings != null){
      if(!isObject(data.historySettings)){
        pushError(errors, "historySettings must be an object");
      }else if(typeof data.historySettings.saveHistory !== "boolean"){
        pushError(errors, "historySettings.saveHistory must be a boolean");
      }
    }

    return {
      ok: errors.length === 0,
      errors: errors
    };
  }

  global.EstimateValidate = {
    validateEstimateConfig: validateEstimateConfig
  };
})(typeof window !== "undefined" ? window : globalThis);
