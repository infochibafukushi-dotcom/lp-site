(function(global){
  const PDF_LIB_CDN = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  const SUBMISSION_DIR = "./docs/submission/20260705/";
  const FULL_SET_FILENAME = "pre-fixed-fare-submission-full-set-v1-candidate.pdf";
  const FULL_SET_PATH = SUBMISSION_DIR + FULL_SET_FILENAME;
  const FINAL_SET_FILENAME = "pre-fixed-fare-submission-full-set-v1-final-candidate.pdf";
  const FINAL_SET_PATH = SUBMISSION_DIR + FINAL_SET_FILENAME;

  const SOURCE_FILES = [
    {
      order: 1,
      label: "申請書様式2",
      filename: "pre-fixed-fare-application-form-style2-v1-candidate.pdf"
    },
    {
      order: 2,
      label: "画面証跡資料",
      filename: "pre-fixed-fare-screen-evidence-v1-candidate.pdf"
    },
    {
      order: 3,
      label: "配車アプリ概要・統合説明資料",
      filename: "pre-fixed-fare-integrated-summary-v1-candidate.pdf"
    },
    {
      order: 4,
      label: "運用フロー資料",
      filename: "pre-fixed-fare-operations-summary-v1-candidate.pdf"
    },
    {
      order: 5,
      label: "Q&A資料",
      filename: "pre-fixed-fare-qa-v1-candidate.pdf"
    },
    {
      order: 6,
      label: "追加資料・別紙セット",
      filename: "pre-fixed-fare-submission-appendix-set-v1-candidate.pdf"
    }
  ];

  function setSubmissionSetStatus(message, type){
    const box = document.getElementById("preFixedFareSubmissionFullSetStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function ensurePdfLib(){
    if(global.PDFLib && global.PDFLib.PDFDocument){
      return Promise.resolve(global.PDFLib.PDFDocument);
    }
    return new Promise(function(resolve, reject){
      const existing = document.querySelector("script[data-pre-fixed-fare-pdf-lib='1']");
      if(existing){
        existing.addEventListener("load", function(){
          if(global.PDFLib && global.PDFLib.PDFDocument){
            resolve(global.PDFLib.PDFDocument);
            return;
          }
          reject(new Error("pdf-lib の読み込みに失敗しました。"));
        }, { once: true });
        existing.addEventListener("error", function(){
          reject(new Error("pdf-lib の読み込みに失敗しました。"));
        }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = PDF_LIB_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-pdf-lib", "1");
      script.onload = function(){
        if(global.PDFLib && global.PDFLib.PDFDocument){
          resolve(global.PDFLib.PDFDocument);
          return;
        }
        reject(new Error("pdf-lib の読み込みに失敗しました。"));
      };
      script.onerror = function(){
        reject(new Error("pdf-lib の読み込みに失敗しました。"));
      };
      document.head.appendChild(script);
    });
  }

  function triggerDownload(bytes, filename){
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function buildSubmissionFullSetPdf(){
    const PDFDocument = await ensurePdfLib();
    const mergedPdf = await PDFDocument.create();
    const partSummaries = [];
    let totalPages = 0;

    for(const source of SOURCE_FILES){
      const response = await fetch(SUBMISSION_DIR + source.filename + "?" + Date.now(), { cache: "no-store" });
      if(!response.ok){
        throw new Error(source.filename + " の取得に失敗しました (HTTP " + response.status + ")");
      }
      const bytes = await response.arrayBuffer();
      const partPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pageCount = partPdf.getPageCount();
      if(pageCount < 1){
        throw new Error(source.filename + " のページ数が0です");
      }
      const copiedPages = await mergedPdf.copyPages(partPdf, partPdf.getPageIndices());
      copiedPages.forEach(function(page){
        mergedPdf.addPage(page);
      });
      totalPages += pageCount;
      partSummaries.push(source.order + ". " + source.label + "（" + pageCount + "ページ）");
    }

    const mergedBytes = await mergedPdf.save();
    triggerDownload(mergedBytes, FULL_SET_FILENAME);
    return {
      totalPages: totalPages,
      partSummaries: partSummaries,
      size: mergedBytes.byteLength
    };
  }

  async function handleBuildSubmissionFullSet(){
    const button = document.getElementById("preFixedFareSubmissionFullSetBuildBtn");
    if(button){
      button.disabled = true;
    }
    setSubmissionSetStatus("提出セット一括PDFを結合しています…");
    try{
      const result = await buildSubmissionFullSetPdf();
      setSubmissionSetStatus(
        "提出セット一括PDFを作成しました（全" + result.totalPages + "ページ、" +
        Math.round(result.size / 1024) + " KB）。ダウンロードを開始しました。結合順: " +
        result.partSummaries.join(" → ") +
        "。リポジトリ保存版は " + FULL_SET_PATH + " です。",
        "ok"
      );
    }catch(error){
      console.error("[PreFixedFareSubmissionSet]", error);
      setSubmissionSetStatus(
        "提出セット一括PDFの作成に失敗しました: " + (error && error.message ? error.message : String(error)) +
        "。ローカルでは node scripts/build-pre-fixed-fare-submission-full-set.mjs でも作成できます。",
        "error"
      );
    }finally{
      if(button){
        button.disabled = false;
      }
    }
  }

  function handleOpenSubmissionFullSet(){
    const opened = window.open(FULL_SET_PATH + "?" + Date.now(), "_blank", "noopener");
    if(!opened){
      setSubmissionSetStatus("提出セット一括PDFを開けませんでした。ポップアップブロックを解除してください。", "error");
      return;
    }
    setSubmissionSetStatus("提出セット一括PDF（candidate）を開きました: " + FULL_SET_PATH, "ok");
  }

  function handleOpenSubmissionFinalSet(){
    const opened = window.open(FINAL_SET_PATH + "?" + Date.now(), "_blank", "noopener");
    if(!opened){
      setSubmissionSetStatus("final-candidate PDFを開けませんでした。ポップアップブロックを解除してください。", "error");
      return;
    }
    setSubmissionSetStatus("審査向け final-candidate PDFを開きました: " + FINAL_SET_PATH, "ok");
  }

  function initPreFixedFareSubmissionSet(){
    const buildBtn = document.getElementById("preFixedFareSubmissionFullSetBuildBtn");
    const openBtn = document.getElementById("preFixedFareSubmissionFullSetOpenBtn");
    const finalOpenBtn = document.getElementById("preFixedFareSubmissionFinalSetOpenBtn");
    if(buildBtn){
      buildBtn.addEventListener("click", handleBuildSubmissionFullSet);
    }
    if(openBtn){
      openBtn.addEventListener("click", handleOpenSubmissionFullSet);
    }
    if(finalOpenBtn){
      finalOpenBtn.addEventListener("click", handleOpenSubmissionFinalSet);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initPreFixedFareSubmissionSet);
  }else{
    initPreFixedFareSubmissionSet();
  }

  global.PreFixedFareSubmissionSetAdmin = {
    SOURCE_FILES: SOURCE_FILES,
    FULL_SET_PATH: FULL_SET_PATH,
    buildSubmissionFullSetPdf: buildSubmissionFullSetPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
