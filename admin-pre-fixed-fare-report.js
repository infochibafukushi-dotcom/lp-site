(function(global){
  const CONFIG_PATH = "./data/config.json";
  const ESTIMATE_CONFIG_PATH = "./data/estimate-config.json";

  function setStatus(message, type){
    const box = document.getElementById("preFixedFareReportResult");
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
        console.warn("[PreFixedFareReport] using file config due to editor state error:", error);
      }
    }
    return null;
  }

  async function exportReportPdf(){
    if(!global.PreFixedFareReportData || !global.PreFixedFareReportPdf){
      throw new Error("認可説明資料PDFモジュールの読み込みに失敗しました。");
    }

    setStatus("設定を読み込み中...", "warn");

    const [config, estimateConfigFromFile] = await Promise.all([
      fetchJson(CONFIG_PATH).catch(function(){ return {}; }),
      fetchJson(ESTIMATE_CONFIG_PATH)
    ]);

    const estimateConfig = getEstimateConfigFromEditor() || estimateConfigFromFile;
    const reportData = global.PreFixedFareReportData.buildReportData({
      config: config,
      estimateConfig: estimateConfig
    });
    if(!reportData || typeof reportData !== "object"){
      throw new Error("pre-fixed-fare-report-data の組み立てに失敗しました");
    }
    if(!String(reportData.title || "").trim()){
      throw new Error("pre-fixed-fare-report-data の組み立てに失敗しました");
    }

    setStatus("PDFを生成中...", "warn");
    await global.PreFixedFareReportPdf.savePdf(reportData);
    setStatus("PDFを出力しました。", "success");
  }

  function bind(){
    const button = document.getElementById("preFixedFareReportExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportReportPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
        ){
          setStatus(reason, "error");
        }else{
          setStatus("PDF生成に失敗しました。Consoleを確認してください。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(typeof window !== "undefined" ? window : globalThis);
