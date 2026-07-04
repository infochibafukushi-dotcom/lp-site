(function(global){
  const CONFIG_PATH = "./data/config.json";
  const ESTIMATE_CONFIG_PATH = "./data/estimate-config.json";

  function setRegulatoryStatus(message, type){
    const box = document.getElementById("preFixedFareReportResult");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function setApprovalSummaryStatus(message, type){
    const box = document.getElementById("preFixedFareApprovalSummaryStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function setOperationsSummaryStatus(message, type){
    const box = document.getElementById("preFixedFareOperationsSummaryStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function setIntegratedSummaryStatus(message, type){
    const box = document.getElementById("preFixedFareIntegratedSummaryStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function setOnePageSummaryStatus(message, type){
    const box = document.getElementById("preFixedFareOnePageSummaryStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function setQaStatus(message, type){
    const box = document.getElementById("preFixedFareQaStatus");
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

  async function generatePreFixedFareOnePageSummaryPdf(){
    if(!global.PreFixedFareOnePageSummaryPdf){
      throw new Error("事前確定運賃 認可説明1枚資料PDFモジュールの読み込みに失敗しました。");
    }
    await global.PreFixedFareOnePageSummaryPdf.generatePreFixedFareOnePageSummaryPdf();
  }

  async function exportOnePageSummaryPdf(){
    setOnePageSummaryStatus("PDFを作成しています...", "warn");
    await generatePreFixedFareOnePageSummaryPdf();
    setOnePageSummaryStatus("PDFを保存しました。", "success");
  }

  async function generatePreFixedFareQaPdf(){
    if(!global.PreFixedFareQaPdf){
      throw new Error("事前確定運賃 認可説明Q&A PDFモジュールの読み込みに失敗しました。");
    }
    await global.PreFixedFareQaPdf.exportPdf();
  }

  async function exportQaPdf(){
    setQaStatus("PDFを作成しています...", "warn");
    await generatePreFixedFareQaPdf();
    setQaStatus("PDFを保存しました。", "success");
  }

  async function exportRegulatoryReportPdf(){
    if(!global.PreFixedFareReportData || !global.PreFixedFareReportPdf){
      throw new Error("認可説明資料PDFモジュールの読み込みに失敗しました。");
    }

    setRegulatoryStatus("設定を読み込み中...", "warn");

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

    setRegulatoryStatus("PDFを生成中...", "warn");
    await global.PreFixedFareReportPdf.savePdf(reportData);
    setRegulatoryStatus("PDFを出力しました。", "success");
  }

  async function generatePreFixedFareApprovalSummaryPdf(){
    if(!global.PreFixedFareApprovalSummaryPdf){
      throw new Error("事前確定運賃システム説明資料PDFモジュールの読み込みに失敗しました。");
    }
    await global.PreFixedFareApprovalSummaryPdf.generatePreFixedFareApprovalSummaryPdf();
  }

  async function exportApprovalSummaryPdf(){
    setApprovalSummaryStatus("PDFを作成しています...", "warn");
    await generatePreFixedFareApprovalSummaryPdf();
    setApprovalSummaryStatus("PDFを保存しました。", "success");
  }

  async function generatePreFixedFareOperationsSummaryPdf(){
    if(!global.PreFixedFareOperationsSummaryPdf){
      throw new Error("事前確定運賃M 運用・監査説明資料PDFモジュールの読み込みに失敗しました。");
    }
    await global.PreFixedFareOperationsSummaryPdf.generatePreFixedFareOperationsSummaryPdf();
  }

  async function exportOperationsSummaryPdf(){
    setOperationsSummaryStatus("PDFを作成しています...", "warn");
    await generatePreFixedFareOperationsSummaryPdf();
    setOperationsSummaryStatus("PDFを保存しました。", "success");
  }

  async function generatePreFixedFareIntegratedSummaryPdf(){
    if(!global.PreFixedFareIntegratedSummaryPdf){
      throw new Error("事前確定運賃システム 統合説明資料PDFモジュールの読み込みに失敗しました。");
    }

    const [config, estimateConfigFromFile] = await Promise.all([
      fetchJson(CONFIG_PATH).catch(function(){ return {}; }),
      fetchJson(ESTIMATE_CONFIG_PATH).catch(function(){ return {}; })
    ]);
    const estimateConfig = getEstimateConfigFromEditor() || estimateConfigFromFile;

    await global.PreFixedFareIntegratedSummaryPdf.generatePreFixedFareIntegratedSummaryPdf({
      config: config,
      estimateConfig: estimateConfig
    });
  }

  async function exportIntegratedSummaryPdf(){
    setIntegratedSummaryStatus("PDFを作成しています...", "warn");
    await generatePreFixedFareIntegratedSummaryPdf();
    setIntegratedSummaryStatus("PDFを保存しました。", "success");
  }

  async function generatePreFixedFareIntegratedSummaryWord(){
    if(!global.PreFixedFareIntegratedSummaryWord){
      throw new Error("事前確定運賃システム 統合説明資料 Wordモジュールの読み込みに失敗しました。");
    }

    const [config, estimateConfigFromFile] = await Promise.all([
      fetchJson(CONFIG_PATH).catch(function(){ return {}; }),
      fetchJson(ESTIMATE_CONFIG_PATH).catch(function(){ return {}; })
    ]);
    const estimateConfig = getEstimateConfigFromEditor() || estimateConfigFromFile;

    return global.PreFixedFareIntegratedSummaryWord.generatePreFixedFareIntegratedSummaryWord({
      config: config,
      estimateConfig: estimateConfig
    });
  }

  async function exportIntegratedSummaryWord(){
    setIntegratedSummaryStatus("Word編集用HTMLを作成しています...", "warn");
    const result = await generatePreFixedFareIntegratedSummaryWord();
    setIntegratedSummaryStatus("Word編集用HTMLを保存しました。（" + String(result?.filename || "") + "）", "success");
  }

  function bindRegulatoryButton(){
    const button = document.getElementById("preFixedFareReportExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportRegulatoryReportPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
        ){
          setRegulatoryStatus(reason, "error");
        }else{
          setRegulatoryStatus("PDF生成に失敗しました。Consoleを確認してください。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  function bindOnePageSummaryButton(){
    const button = document.getElementById("preFixedFareOnePageSummaryExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportOnePageSummaryPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
          || reason.includes("読み込みに失敗")
          || reason.includes("認可ルート")
        ){
          setOnePageSummaryStatus(reason, "error");
        }else{
          setOnePageSummaryStatus("PDF作成に失敗しました。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  function bindQaButton(){
    const button = document.getElementById("preFixedFareQaExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportQaPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
          || reason.includes("読み込みに失敗")
          || reason.includes("認可ルート")
          || reason.includes("14問")
        ){
          setQaStatus(reason, "error");
        }else{
          setQaStatus("PDF作成に失敗しました。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  function bindApprovalSummaryButton(){
    const button = document.getElementById("preFixedFareApprovalSummaryExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportApprovalSummaryPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
          || reason.includes("読み込みに失敗")
        ){
          setApprovalSummaryStatus(reason, "error");
        }else{
          setApprovalSummaryStatus("PDF作成に失敗しました。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  function bindOperationsSummaryButton(){
    const button = document.getElementById("preFixedFareOperationsSummaryExportBtn");
    if(!button) return;
    button.addEventListener("click", async function(){
      button.disabled = true;
      try{
        await exportOperationsSummaryPdf();
      }catch(error){
        console.error(error);
        const reason = String(error?.message || "");
        if(
          reason.includes("生成対象HTMLが空")
          || reason.includes("組み立てに失敗")
          || reason.includes("読み込みに失敗")
        ){
          setOperationsSummaryStatus(reason, "error");
        }else{
          setOperationsSummaryStatus("PDF作成に失敗しました。", "error");
        }
      }finally{
        button.disabled = false;
      }
    });
  }

  function bindIntegratedSummaryButton(){
    const pdfButton = document.getElementById("preFixedFareIntegratedSummaryExportBtn");
    if(pdfButton){
      pdfButton.addEventListener("click", async function(){
        pdfButton.disabled = true;
        try{
          await exportIntegratedSummaryPdf();
        }catch(error){
          console.error(error);
          const reason = String(error?.message || "");
          if(
            reason.includes("生成対象HTMLが空")
            || reason.includes("組み立てに失敗")
            || reason.includes("読み込みに失敗")
          ){
            setIntegratedSummaryStatus(reason, "error");
          }else{
            setIntegratedSummaryStatus("PDF作成に失敗しました。", "error");
          }
        }finally{
          pdfButton.disabled = false;
        }
      });
    }

    const wordButton = document.getElementById("preFixedFareIntegratedSummaryWordExportBtn");
    if(wordButton){
      wordButton.addEventListener("click", async function(){
        wordButton.disabled = true;
        try{
          await exportIntegratedSummaryWord();
        }catch(error){
          console.error(error);
          const reason = String(error?.message || "");
          if(
            reason.includes("組み立てに失敗")
            || reason.includes("読み込みに失敗")
            || reason.includes("生成に失敗")
          ){
            setIntegratedSummaryStatus(reason, "error");
          }else{
            setIntegratedSummaryStatus("Word編集用HTMLの作成に失敗しました。", "error");
          }
        }finally{
          wordButton.disabled = false;
        }
      });
    }
  }

  function bind(){
    bindRegulatoryButton();
    bindOnePageSummaryButton();
    bindQaButton();
    bindApprovalSummaryButton();
    bindOperationsSummaryButton();
    bindIntegratedSummaryButton();
  }

  function bindOnce(){
    if(global.__preFixedFareReportButtonsBound){
      return;
    }
    global.__preFixedFareReportButtonsBound = true;
    bind();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindOnce);
  }else{
    bindOnce();
  }
  window.addEventListener("load", bindOnce);
})(typeof window !== "undefined" ? window : globalThis);
