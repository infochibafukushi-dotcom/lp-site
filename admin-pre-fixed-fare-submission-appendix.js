(function(global){
  const CONFIG_PATH = "./data/config.json";
  const ESTIMATE_CONFIG_PATH = "./data/estimate-config.json";

  const EXPORT_BUTTONS = [
    { buttonId: "preFixedFareAppendixApplicationHelperBtn", documentId: "application-helper", label: "記入補助シート" },
    { buttonId: "preFixedFareAppendixDistanceFareBtn", documentId: "distance-fare-table", label: "距離制運賃表" },
    { buttonId: "preFixedFareAppendixServiceFeeBtn", documentId: "service-fee-table", label: "料金表" },
    { buttonId: "preFixedFareAppendixDeviceChecklistBtn", documentId: "device-checklist", label: "実機目視確認チェックリスト" },
    { buttonId: "preFixedFareAppendixScreenshotSheetBtn", documentId: "screenshot-sheet", label: "画面スクリーンショット台紙" },
    { buttonId: "preFixedFareAppendixFullSetBtn", documentId: "submission-appendix-set", label: "提出用別紙セット" }
  ];

  function setStatus(message, type){
    const box = document.getElementById("preFixedFareSubmissionAppendixStatus");
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
        console.warn("[PreFixedFareSubmissionAppendix] editor config fallback:", error);
      }
    }
    return null;
  }

  async function buildExportOptions(){
    const [config, estimateConfigFromFile] = await Promise.all([
      fetchJson(CONFIG_PATH).catch(function(){ return {}; }),
      fetchJson(ESTIMATE_CONFIG_PATH).catch(function(){ return {}; })
    ]);
    return {
      config: config,
      estimateConfig: getEstimateConfigFromEditor() || estimateConfigFromFile
    };
  }

  async function exportWordDocument(documentId, label){
    if(!global.PreFixedFareSubmissionAppendixWord){
      throw new Error("別紙資料Wordモジュールの読み込みに失敗しました。");
    }
    setStatus(label + "のWord編集用HTMLを作成しています...", "warn");
    const options = await buildExportOptions();
    const result = global.PreFixedFareSubmissionAppendixWord.downloadWordHtml(documentId, options);
    setStatus(label + "のWord編集用HTMLを保存しました。（" + result.filename + "）", "success");
    return result;
  }

  function bindButtons(){
    EXPORT_BUTTONS.forEach(function(item){
      const button = document.getElementById(item.buttonId);
      if(!button) return;
      button.addEventListener("click", async function(){
        button.disabled = true;
        try{
          await exportWordDocument(item.documentId, item.label);
        }catch(error){
          console.error(error);
          setStatus(String(error?.message || error) || "別紙資料の出力に失敗しました。", "error");
        }finally{
          button.disabled = false;
        }
      });
    });
  }

  function bindOnce(){
    if(global.__preFixedFareSubmissionAppendixBound){
      return;
    }
    global.__preFixedFareSubmissionAppendixBound = true;
    bindButtons();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindOnce);
  }else{
    bindOnce();
  }
  window.addEventListener("load", bindOnce);
})(typeof window !== "undefined" ? window : globalThis);
