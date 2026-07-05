(function(global){
  const SUBMISSION_DIR = "./docs/submission/20260705/";
  const FULL_SET_DOCX = "pre-fixed-fare-submission-full-set-v1-candidate.docx";
  const FINAL_SET_DOCX = "pre-fixed-fare-submission-full-set-v1-final-candidate.docx";
  const APPENDIX_SET_DOCX = "pre-fixed-fare-submission-appendix-set-v1-candidate.docx";
  const FULL_SET_PATH = SUBMISSION_DIR + FULL_SET_DOCX;
  const FINAL_SET_PATH = SUBMISSION_DIR + FINAL_SET_DOCX + "?v=9f20bb1";
  const APPENDIX_SET_PATH = SUBMISSION_DIR + APPENDIX_SET_DOCX;

  function setWordStatus(message, type){
    const box = document.getElementById("preFixedFareSubmissionWordStatus");
    if(!box) return;
    box.className = "preview" + (type ? " " + type : "");
    box.textContent = message || "";
  }

  function triggerDownload(url, filename){
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleOpenSubmissionWord(){
    const opened = window.open(FULL_SET_PATH + "?" + Date.now(), "_blank", "noopener");
    if(!opened){
      setWordStatus("提出セットWord版（旧candidate）を開けませんでした。ポップアップブロックを解除してください。", "error");
      return;
    }
    setWordStatus("提出セットWord版（旧candidate）を開きました: " + FULL_SET_PATH, "ok");
  }

  function handleDownloadSubmissionWord(){
    const url = FULL_SET_PATH + "?" + Date.now();
    triggerDownload(url, FULL_SET_DOCX);
    setWordStatus(
      "提出セットWord版（旧candidate）のダウンロードを開始しました: " + FULL_SET_DOCX +
      "。別紙のみは " + APPENDIX_SET_PATH + " です。",
      "ok"
    );
  }

  function handleOpenSubmissionFinalWord(){
    const opened = window.open(FINAL_SET_PATH, "_blank", "noopener");
    if(!opened){
      setWordStatus("審査向け final-candidate Wordを開けませんでした。ポップアップブロックを解除してください。", "error");
      return;
    }
    setWordStatus("審査向け final-candidate Wordを開きました: " + FINAL_SET_PATH, "ok");
  }

  function handleDownloadSubmissionFinalWord(){
    triggerDownload(FINAL_SET_PATH, FINAL_SET_DOCX);
    setWordStatus(
      "審査向け final-candidate Wordのダウンロードを開始しました: " + FINAL_SET_DOCX,
      "ok"
    );
  }

  function initPreFixedFareSubmissionWord(){
    const openBtn = document.getElementById("preFixedFareSubmissionWordOpenBtn");
    const downloadBtn = document.getElementById("preFixedFareSubmissionWordDownloadBtn");
    const finalOpenBtn = document.getElementById("preFixedFareSubmissionFinalWordOpenBtn");
    const finalDownloadBtn = document.getElementById("preFixedFareSubmissionFinalWordDownloadBtn");
    if(openBtn){
      openBtn.addEventListener("click", handleOpenSubmissionWord);
    }
    if(downloadBtn){
      downloadBtn.addEventListener("click", handleDownloadSubmissionWord);
    }
    if(finalOpenBtn){
      finalOpenBtn.addEventListener("click", handleOpenSubmissionFinalWord);
    }
    if(finalDownloadBtn){
      finalDownloadBtn.addEventListener("click", handleDownloadSubmissionFinalWord);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initPreFixedFareSubmissionWord);
  }else{
    initPreFixedFareSubmissionWord();
  }

  global.PreFixedFareSubmissionWordAdmin = {
    FULL_SET_PATH: FULL_SET_PATH,
    FINAL_SET_PATH: FINAL_SET_PATH,
    APPENDIX_SET_PATH: APPENDIX_SET_PATH,
    FULL_SET_DOCX: FULL_SET_DOCX,
    FINAL_SET_DOCX: FINAL_SET_DOCX,
    APPENDIX_SET_DOCX: APPENDIX_SET_DOCX
  };
})(typeof window !== "undefined" ? window : globalThis);
