(function(global){
  const SUBMISSION_DIR = "./docs/submission/20260705/";
  const FULL_SET_DOCX = "pre-fixed-fare-submission-full-set-v1-candidate.docx";
  const APPENDIX_SET_DOCX = "pre-fixed-fare-submission-appendix-set-v1-candidate.docx";
  const FULL_SET_PATH = SUBMISSION_DIR + FULL_SET_DOCX;
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
      setWordStatus("提出セットWord版を開けませんでした。ポップアップブロックを解除してください。", "error");
      return;
    }
    setWordStatus("提出セットWord版を開きました: " + FULL_SET_PATH, "ok");
  }

  function handleDownloadSubmissionWord(){
    const url = FULL_SET_PATH + "?" + Date.now();
    triggerDownload(url, FULL_SET_DOCX);
    setWordStatus(
      "提出セットWord版のダウンロードを開始しました: " + FULL_SET_DOCX +
      "。別紙のみは " + APPENDIX_SET_PATH + " です。",
      "ok"
    );
  }

  function initPreFixedFareSubmissionWord(){
    const openBtn = document.getElementById("preFixedFareSubmissionWordOpenBtn");
    const downloadBtn = document.getElementById("preFixedFareSubmissionWordDownloadBtn");
    if(openBtn){
      openBtn.addEventListener("click", handleOpenSubmissionWord);
    }
    if(downloadBtn){
      downloadBtn.addEventListener("click", handleDownloadSubmissionWord);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initPreFixedFareSubmissionWord);
  }else{
    initPreFixedFareSubmissionWord();
  }

  global.PreFixedFareSubmissionWordAdmin = {
    FULL_SET_PATH: FULL_SET_PATH,
    APPENDIX_SET_PATH: APPENDIX_SET_PATH,
    FULL_SET_DOCX: FULL_SET_DOCX,
    APPENDIX_SET_DOCX: APPENDIX_SET_DOCX
  };
})(typeof window !== "undefined" ? window : globalThis);
