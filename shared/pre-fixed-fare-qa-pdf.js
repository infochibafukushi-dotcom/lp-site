(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-qa.pdf";
  const SHEET_WIDTH_PX = 760;

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureHtml2Pdf(){
    if(typeof html2pdf !== "undefined"){
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject){
      const existing = document.querySelector("script[data-pre-fixed-fare-qa-pdf='1']");
      if(existing){
        existing.addEventListener("load", function(){ resolve(); }, { once: true });
        existing.addEventListener("error", function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = HTML2PDF_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-qa-pdf", "1");
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  }

  function buildQaBlocks(qaItems){
    return (qaItems || []).map(function(item, index){
      const number = index + 1;
      return (
        "<div class='qa-block'>" +
          "<div class='qa-question'><span class='qa-label'>Q" + number + ".</span> " + escapeHtml(item.q || "") + "</div>" +
          "<div class='qa-answer'><span class='qa-label'>A" + number + ".</span> " + escapeHtml(item.a || "") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function buildMutualityBlock(mutuality){
    const items = (mutuality?.items || []).map(function(item){
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("");
    return (
      "<div class='qa-compatibility'>" +
        "<h2>" + escapeHtml(mutuality?.title || "") + "</h2>" +
        "<p>" + escapeHtml(mutuality?.intro || "") + "</p>" +
        "<ul class='check-list'>" + items + "</ul>" +
      "</div>"
    );
  }

  function buildReportHtml(data){
    return (
      "<div class='qa-pdf-sheet'>" +
        "<h1>" + escapeHtml(data.title || "") + "</h1>" +
        "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
        "<p class='meta'>作成日：" + escapeHtml(data.meta?.createdAt || "") +
          "　作成元：" + escapeHtml(data.meta?.createdBy || "") + "</p>" +
        "<div class='qa-note intro-note'>" + escapeHtml(data.introNote || "") + "</div>" +
        buildMutualityBlock(data.mutuality) +
        "<h2 class='section-title'>想定質問と回答</h2>" +
        buildQaBlocks(data.qaItems) +
        "<div class='qa-note footer-note'>" +
          "<strong>注意事項：</strong>" + escapeHtml(data.footerNote || "") +
        "</div>" +
      "</div>"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "qa-pdf-root";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "2147483000";
    container.style.pointerEvents = "none";
    container.style.display = "block";
    container.style.visibility = "visible";
    container.style.opacity = "1";
    container.style.width = SHEET_WIDTH_PX + "px";
    container.style.maxWidth = SHEET_WIDTH_PX + "px";
    container.style.background = "#ffffff";
    container.style.color = "#1f2937";
    container.style.padding = "0";
    container.style.margin = "0";
    container.style.overflow = "visible";

    container.innerHTML =
      "<style>" +
      ".qa-pdf-root,.qa-pdf-root *{box-sizing:border-box;}" +
      ".qa-pdf-sheet{width:" + SHEET_WIDTH_PX + "px;max-width:" + SHEET_WIDTH_PX + "px;margin:0;padding:0;background:#ffffff;font-family:'Yu Gothic','Meiryo',sans-serif;color:#1f2937;line-height:1.55;font-size:11px;overflow:visible;}" +
      ".qa-pdf-sheet h1{font-size:17px;margin:0 0 4px;color:#1b3a6b;line-height:1.3;font-weight:700;max-width:100%;overflow-wrap:anywhere;word-break:break-word;}" +
      ".qa-pdf-sheet .subtitle{font-size:11px;margin:0 0 4px;color:#334155;font-weight:600;max-width:100%;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
      ".qa-pdf-sheet .meta{font-size:10px;margin:0 0 10px;color:#64748b;max-width:100%;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
      ".qa-block,.qa-answer,.qa-question,.qa-note,.qa-compatibility{width:100%;max-width:100%;overflow-wrap:anywhere;word-break:break-word;}" +
      ".qa-answer,.qa-question,.qa-note,.qa-compatibility p,.qa-compatibility li{white-space:normal;overflow:visible;}" +
      ".qa-note{margin:0 0 12px;padding:10px 12px;background:#fff8f0;border:1px solid #e0a86a;border-left:5px solid #c56a1a;color:#7c3a0a;font-size:10.5px;line-height:1.5;}" +
      ".qa-compatibility{margin:0 0 14px;padding:10px 12px;background:#f3faf6;border:1px solid #86c9a8;border-left:5px solid #2f8f6b;}" +
      ".qa-compatibility h2{font-size:13px;margin:0 0 6px;padding:0;border:none;color:#1b3a6b;}" +
      ".qa-compatibility p{margin:0 0 6px;color:#1f2937;}" +
      ".qa-compatibility .check-list{margin:0;padding:0 0 0 18px;max-width:100%;}" +
      ".qa-compatibility .check-list li{margin:0 0 4px;color:#14532d;overflow-wrap:anywhere;word-break:break-word;}" +
      ".qa-pdf-sheet .section-title{font-size:13px;margin:0 0 8px;padding-bottom:3px;border-bottom:2px solid #1b3a6b;color:#1b3a6b;}" +
      ".qa-block{margin:0 0 10px;break-inside:avoid;page-break-inside:avoid;}" +
      ".qa-question{padding:8px 10px;background:#eef5fb;border:1px solid #b7d0e8;border-bottom:none;color:#16324f;font-weight:700;}" +
      ".qa-answer{padding:8px 10px;background:#f8fafc;border:1px solid #d8dee8;color:#1f2937;font-weight:400;}" +
      ".qa-label{color:#1b3a6b;font-weight:700;}" +
      ".qa-note.footer-note{margin-top:14px;}" +
      ".qa-note strong{color:#9a4d0f;}" +
      "</style>" +
      reportHtml;
    return container;
  }

  async function waitForRenderReady(){
    try{
      if(document.fonts && typeof document.fonts.ready?.then === "function"){
        await document.fonts.ready;
      }
    }catch(error){
      console.warn("[PreFixedFareQaPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  function assertNoForbiddenTerms(reportData){
    if(JSON.stringify(reportData).includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }
  }

  function assertLayoutSafe(sheet){
    if(!sheet){
      throw new Error("事前確定運賃 認可説明Q&A PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(sheet.innerHTML || "").trim().length;
    const textLength = String(sheet.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("事前確定運賃 認可説明Q&A PDFの生成対象HTMLが空です。");
    }
    if(sheet.scrollWidth > sheet.clientWidth + 2){
      throw new Error("Q&A PDFの横幅が用紙幅を超えています（右端欠け防止）。");
    }
    const textNodes = sheet.querySelectorAll(".qa-question, .qa-answer, .qa-note, .qa-compatibility, .qa-compatibility li, h1, .subtitle, .meta");
    for(let i = 0; i < textNodes.length; i += 1){
      const el = textNodes[i];
      if(el.scrollWidth > el.clientWidth + 2){
        throw new Error("Q&A PDF本文に横スクロールが発生しています（右端欠け防止）。");
      }
    }
    const qaCount = sheet.querySelectorAll(".qa-block").length;
    if(qaCount !== 14){
      throw new Error("認可説明Q&Aは14問である必要があります。");
    }
    if(String(sheet.innerText || "").includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }
  }

  async function savePdf(reportData){
    assertNoForbiddenTerms(reportData);
    if(!Array.isArray(reportData.qaItems) || reportData.qaItems.length !== 14){
      throw new Error("認可説明Q&Aは14問である必要があります。");
    }

    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const sheet = wrapper.querySelector(".qa-pdf-sheet");

    try{
      await waitForRenderReady();
      assertLayoutSafe(sheet);

      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: 800
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: [".qa-block", ".qa-note", ".qa-compatibility"]
        }
      }).from(sheet).save();
    }finally{
      wrapper.remove();
    }
  }

  async function generatePreFixedFareQaPdf(options){
    if(!global.PreFixedFareQaData){
      throw new Error("事前確定運賃 認可説明Q&Aデータモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareQaData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃 認可説明Q&Aデータの組み立てに失敗しました。");
    }
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareQaPdf = {
    PDF_FILENAME: PDF_FILENAME,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareQaPdf: generatePreFixedFareQaPdf,
    exportPdf: generatePreFixedFareQaPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
