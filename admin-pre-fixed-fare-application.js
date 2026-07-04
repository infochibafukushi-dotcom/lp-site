(function(global){
  const APPLICATION_PATH = "data/pre-fixed-fare-application.json";
  const CONFIG_PATH = "./data/config.json";
  const ESTIMATE_CONFIG_PATH = "./data/estimate-config.json";

  let applicationDraft = null;
  let applicationLoaded = false;

  function setStatus(message, type){
    const box = document.getElementById("preFixedFareApplicationStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  async function fetchJson(path){
    const response = await fetch(path + "?" + Date.now(), { cache: "no-store" });
    if(!response.ok){
      throw new Error(path + " の取得に失敗しました (HTTP " + response.status + ")");
    }
    return response.json();
  }

  function getEstimateConfigFromEditor(){
    if(typeof global.getEstimateDraftForSave === "function"){
      try{
        return global.getEstimateDraftForSave();
      }catch(error){
        console.warn("[PreFixedFareApplication] editor config fallback:", error);
      }
    }
    return null;
  }

  async function buildBootstrapOptions(){
    const [config, estimateConfigFromFile] = await Promise.all([
      fetchJson(CONFIG_PATH).catch(function(){ return {}; }),
      fetchJson(ESTIMATE_CONFIG_PATH).catch(function(){ return {}; })
    ]);
    return {
      config: config,
      estimateConfig: getEstimateConfigFromEditor() || estimateConfigFromFile
    };
  }

  function fieldValue(id){
    return String(document.getElementById(id)?.value || "").trim();
  }

  function collectDraftFromForm(){
    if(!global.PreFixedFareApplicationPrint){
      throw new Error("申請書印刷モジュールの読み込みに失敗しました。");
    }
    applicationDraft = global.PreFixedFareApplicationPrint.normalizeFormData({
      applicationDate: fieldValue("pffaApplicationDate"),
      applicantAddress: fieldValue("pffaApplicantAddress"),
      applicantName: fieldValue("pffaApplicantName"),
      representativeName: fieldValue("pffaRepresentativeName"),
      contact: fieldValue("pffaContact"),
      operatingArea: fieldValue("pffaOperatingArea"),
      dispatchAppName: fieldValue("pffaDispatchAppName")
    });
    return applicationDraft;
  }

  function renderForm(data){
    const form = global.PreFixedFareApplicationPrint.normalizeFormData(data);
    const setValue = function(id, value){
      const input = document.getElementById(id);
      if(input) input.value = value || "";
    };
    setValue("pffaApplicationDate", form.applicationDate);
    setValue("pffaApplicantAddress", form.applicantAddress);
    setValue("pffaApplicantName", form.applicantName);
    setValue("pffaRepresentativeName", form.representativeName);
    setValue("pffaContact", form.contact);
    setValue("pffaOperatingArea", form.operatingArea);
    setValue("pffaDispatchAppName", form.dispatchAppName);
    applicationDraft = form;
  }

  async function loadApplicationDraft(){
    const options = await buildBootstrapOptions();
    let saved = null;
    try{
      saved = await fetchJson("./" + APPLICATION_PATH);
    }catch(error){
      console.warn("[PreFixedFareApplication] saved json not found, using defaults:", error);
    }
    const merged = global.PreFixedFareApplicationPrint.normalizeFormData(saved || {}, options);
    renderForm(merged);
    applicationLoaded = true;
    setStatus("申請書入力内容を読み込みました。", "success");
    return merged;
  }

  async function saveApplicationToGitHub(isSilent){
    try{
      if(!isSilent) setStatus("保存中...", "warn");
      collectDraftFromForm();
      if(typeof global.saveFileToGitHub !== "function"){
        throw new Error("GitHub保存機能が利用できません。admin.html の保存設定を確認してください。");
      }
      await global.saveFileToGitHub(APPLICATION_PATH, JSON.stringify(applicationDraft, null, 2) + "\n");
      if(!isSilent){
        setStatus("pre-fixed-fare-application.json の保存が完了しました。", "success");
      }
      return true;
    }catch(error){
      console.error("[PreFixedFareApplication] save failed:", error);
      if(!isSilent) setStatus("保存失敗: " + error.message, "error");
      return false;
    }
  }

  async function openPreview(){
    if(!global.PreFixedFareApplicationPrint){
      throw new Error("申請書印刷モジュールの読み込みに失敗しました。");
    }
    const options = await buildBootstrapOptions();
    const formData = collectDraftFromForm();
    global.PreFixedFareApplicationPrint.openPreviewPage(formData, options);
    setStatus("申請書プレビューを開きました。", "success");
  }

  async function openPrint(){
    if(!global.PreFixedFareApplicationPrint){
      throw new Error("申請書印刷モジュールの読み込みに失敗しました。");
    }
    const options = await buildBootstrapOptions();
    const formData = collectDraftFromForm();
    global.PreFixedFareApplicationPrint.openPrintPage(formData, options);
    setStatus("申請書の印刷画面を開きました。", "success");
  }

  function bindButtons(){
    document.getElementById("pffaSaveBtn")?.addEventListener("click", function(){
      saveApplicationToGitHub(false);
    });
    document.getElementById("pffaPreviewBtn")?.addEventListener("click", async function(){
      const button = document.getElementById("pffaPreviewBtn");
      if(button) button.disabled = true;
      try{
        await openPreview();
      }catch(error){
        console.error(error);
        setStatus(String(error?.message || error) || "プレビューの表示に失敗しました。", "error");
      }finally{
        if(button) button.disabled = false;
      }
    });
    document.getElementById("pffaPrintBtn")?.addEventListener("click", async function(){
      const button = document.getElementById("pffaPrintBtn");
      if(button) button.disabled = true;
      try{
        await openPrint();
      }catch(error){
        console.error(error);
        setStatus(String(error?.message || error) || "印刷画面の表示に失敗しました。", "error");
      }finally{
        if(button) button.disabled = false;
      }
    });
    document.getElementById("pffaReloadBtn")?.addEventListener("click", function(){
      loadApplicationDraft().catch(function(error){
        setStatus(error.message, "error");
      });
    });
  }

  function bindOnce(){
    if(global.__preFixedFareApplicationBound){
      return;
    }
    global.__preFixedFareApplicationBound = true;
    bindButtons();
    loadApplicationDraft().catch(function(error){
      if(global.PreFixedFareApplicationPrint){
        renderForm(global.PreFixedFareApplicationPrint.buildDefaults({}));
      }
      setStatus("申請書データの読み込みに失敗しました。初期値を表示しています。（" + error.message + "）", "warn");
    });
  }

  global.savePreFixedFareApplicationToGitHub = saveApplicationToGitHub;
  global.loadPreFixedFareApplicationDraft = loadApplicationDraft;
  global.collectPreFixedFareApplicationDraft = collectDraftFromForm;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindOnce);
  }else{
    bindOnce();
  }
  window.addEventListener("load", bindOnce);
})(typeof window !== "undefined" ? window : globalThis);
