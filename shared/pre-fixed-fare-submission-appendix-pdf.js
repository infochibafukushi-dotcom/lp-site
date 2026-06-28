(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  function ensureHtml2Pdf(){
    if(typeof html2pdf !== "undefined"){
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject){
      const existing = document.querySelector("script[data-pre-fixed-fare-report-pdf='1']");
      if(existing){
        existing.addEventListener("load", function(){ resolve(); }, { once: true });
        existing.addEventListener("error", function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = HTML2PDF_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-report-pdf", "1");
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  }

  function createRenderShell(bodyHtml, title){
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "720px";
    container.style.background = "#ffffff";
    container.style.color = "#111111";
    container.style.padding = "12px";
    container.innerHTML =
      "<style>" +
      "body,div,p,li,td,th{font-family:'Yu Gothic','Meiryo',sans-serif;font-size:10.5px;line-height:1.4;color:#111;}" +
      "h1{font-size:18px;text-align:center;margin:12px 0;} h2{font-size:14px;margin:10px 0 6px;} h3{font-size:12px;margin:8px 0 4px;}" +
      "table{width:100%;border-collapse:collapse;margin:6px 0;} th,td{border:1px solid #999;padding:4px;vertical-align:top;font-size:9.5px;}" +
      "th{background:#f2f2f2;} .paste-box{border:2px dashed #999;min-height:100px;margin:6px 0;}" +
      ".notice-box{border:1px solid #ccc;background:#fafafa;padding:8px;font-size:9px;margin-bottom:8px;}" +
      "</style>" +
      bodyHtml;
    document.body.appendChild(container);
    return container;
  }

  async function savePdf(documentId, options){
    await ensureHtml2Pdf();
    if(!global.PreFixedFareSubmissionAppendixWord){
      throw new Error("別紙資料Wordモジュールが読み込まれていません。");
    }
    const built = global.PreFixedFareSubmissionAppendixWord.buildWordDocumentHtml(documentId, options || {});
    const match = String(built.html || "").match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = match ? match[1] : built.html;
    const shell = createRenderShell(bodyHtml, built.payload.title);
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    try{
      await html2pdf().set({
        margin: [8, 8, 10, 8],
        filename: built.payload.pdfFilename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: [".word-page-break"] }
      }).from(shell).save();
    }finally{
      shell.remove();
    }
    return { filename: built.payload.pdfFilename, title: built.payload.title };
  }

  global.PreFixedFareSubmissionAppendixPdf = {
    savePdf: savePdf
  };
})(typeof window !== "undefined" ? window : globalThis);
