/**
 * FAQ/carechan 料金金額の動的置換
 */
(function(global){
  function formatYen(n){
    return Number(n || 0).toLocaleString("ja-JP");
  }

  function replaceFareAmountsInText(text, amounts){
    if(!text || !amounts) return text;
    let out = String(text);
    const rules = [
      [/520円/g, formatYen(amounts.initialFare) + "円"],
      [/800円/g, formatYen(amounts.pickupFee) + "円"],
      [/1,?100円/g, formatYen(amounts.boardingAssist) + "円"],
      [/1,?600円/g, formatYen(amounts.bodyAssist) + "円"],
      [/4,?180円/g, formatYen(amounts.timeBlock) + "円"],
      [/3,?000円/g, formatYen(amounts.stairFrom) + "円"],
      [/30分800円/g, "30分" + formatYen(amounts.waiting30min) + "円"],
      [/30分1,?600円/g, "30分" + formatYen(amounts.escort30min) + "円"],
    ];
    for(const [pattern, replacement] of rules){
      out = out.replace(pattern, replacement);
    }
    return out;
  }

  function hydrateCarechanPricing(carechanData, faqAmounts){
    if(!carechanData || !faqAmounts) return carechanData;
    const cloned = JSON.parse(JSON.stringify(carechanData));
    const walk = (node) => {
      if(!node || typeof node !== "object") return;
      if(typeof node.text === "string") node.text = replaceFareAmountsInText(node.text, faqAmounts);
      if(typeof node.answer === "string") node.answer = replaceFareAmountsInText(node.answer, faqAmounts);
      if(typeof node.title === "string") node.title = replaceFareAmountsInText(node.title, faqAmounts);
      if(Array.isArray(node.questions)) node.questions.forEach(walk);
      if(Array.isArray(node.children)) node.children.forEach(walk);
      if(node.content && typeof node.content === "object") walk(node.content);
    };
    if(Array.isArray(cloned.questions)) cloned.questions.forEach(walk);
    if(cloned.faq && Array.isArray(cloned.faq.questions)) cloned.faq.questions.forEach(walk);
    return cloned;
  }

  async function loadFaqAmounts(apiBase){
    const url = String(apiBase || "").replace(/\/$/, "") + "/api/fare-master/display";
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("fare display HTTP " + res.status);
    const data = await res.json();
    return data.faqAmounts || {};
  }

  global.FareFaqSync = {
    hydrateCarechanPricing,
    loadFaqAmounts,
    replaceFareAmountsInText,
  };
})(typeof window !== "undefined" ? window : globalThis);
