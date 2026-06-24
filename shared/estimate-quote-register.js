(function(global){
  const REGISTER_PATH = "/api/quotes/register";
  const REGISTER_WARN_MESSAGE =
    "見積のサーバー登録に失敗しました。予約は可能ですが、表示内容が最新でない場合があります。お困りの際はお電話ください。";

  function getConfig(){
    return global.EstimateQuoteConfig || {};
  }

  function buildRegisterPayload(handoff){
    const tenant = global.TenantDefaults || {};
    return {
      estimateNo: String(handoff?.estimateNumber || "").trim(),
      total: Number(handoff?.total) || 0,
      fareType: "fixed",
      quoteSnapshot: handoff?.quoteSnapshot || null,
      routePlan: handoff?.routePlan || null,
      usageSummary: handoff?.usageSummary || null,
      handoffSource: String(handoff?.handoffSource || "lp-site-estimate").trim() || "lp-site-estimate",
      dtoVersion: Number(handoff?.dtoVersion) || 2,
      franchiseeId: String(tenant.franchiseeId || "").trim(),
      storeId: String(tenant.storeId || "").trim()
    };
  }

  async function registerQuoteFromHandoff(handoff){
    const cfg = getConfig();
    if(cfg.REGISTER_ENABLED === false){
      return { ok: true, skipped: true, reason: "disabled" };
    }
    const base = String(cfg.API_BASE || "").replace(/\/$/, "");
    if(!base){
      return { ok: false, message: "API_BASE が未設定です", userMessage: REGISTER_WARN_MESSAGE };
    }
    const payload = buildRegisterPayload(handoff);
    if(!payload.estimateNo || !payload.quoteSnapshot || payload.total <= 0){
      return { ok: false, message: "register payload invalid", userMessage: REGISTER_WARN_MESSAGE };
    }

    let response;
    try{
      response = await fetch(base + REGISTER_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }catch(error){
      return {
        ok: false,
        message: String(error?.message || error),
        userMessage: REGISTER_WARN_MESSAGE
      };
    }

    let data = {};
    try{
      data = await response.json();
    }catch(error){
      data = {};
    }

    if(response.ok && data.success){
      return { ok: true, data: data, duplicate: false };
    }
    if(response.status === 409){
      return { ok: true, data: data, duplicate: true };
    }

    return {
      ok: false,
      status: response.status,
      message: String(data?.message || "register failed"),
      userMessage: REGISTER_WARN_MESSAGE
    };
  }

  global.EstimateQuoteRegister = {
    REGISTER_WARN_MESSAGE: REGISTER_WARN_MESSAGE,
    buildRegisterPayload: buildRegisterPayload,
    registerQuoteFromHandoff: registerQuoteFromHandoff
  };
})(typeof window !== "undefined" ? window : globalThis);
