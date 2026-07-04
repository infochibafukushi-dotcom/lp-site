(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-qa.pdf";

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
        "<div class='qa-item'>" +
          "<div class='qa-q'><span class='qa-label'>Q" + number + ".</span> " + escapeHtml(item.q || "") + "</div>" +
          "<div class='qa-a'><span class='qa-label'>A" + number + ".</span> " + escapeHtml(item.a || "") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function buildMutualityBlock(mutuality){
    const items = (mutuality?.items || []).map(function(item){
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("");
    return (
      "<div class='mutuality-box'>" +
        "<h2>" + escapeHtml(mutuality?.title || "") + "</h2>" +
        "<p>" + escapeHtml(mutuality?.intro || "") + "</p>" +
        "<ul class='check-list'>" + items + "</ul>" +
      "</div>"
    );
  }

  function buildReportHtml(data){
    return (
      "<div class='pre-fixed-fare-qa'>" +
        "<h1>" + escapeHtml(data.title || "") + "</h1>" +
        "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
        "<p class='meta'>作成日：" + escapeHtml(data.meta?.createdAt || "") +
          "　作成元：" + escapeHtml(data.meta?.createdBy || "") + "</p>" +
        "<div class='intro-note'>" + escapeHtml(data.introNote || "") + "</div>" +
        buildMutualityBlock(data.mutuality) +
        "<h2 class='section-title'>想定質問と回答</h2>" +
        buildQaBlocks(data.qaItems) +
        "<div class='footer-note'>" +
          "<strong>注意事項：</strong>" + escapeHtml(data.footerNote || "") +
        "</div>" +
      "</div>"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-qa-render-shell";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "2147483000";
    container.style.pointerEvents = "none";
    container.style.display = "block";
    container.style.visibility = "visible";
    container.style.opacity = "1";
    container.style.width = "720px";
    container.style.background = "#ffffff";
    container.style.color = "#111111";
    container.style.padding = "0";
    container.style.margin = "0";

    container.innerHTML =
      "<style>" +
      ".pre-fixed-fare-qa,.pre-fixed-fare-qa *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;}" +
      ".pre-fixed-fare-qa{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:720px;background:#ffffff;color:#1f2937;line-height:1.55;font-size:11px;padding:4px 0 0;margin:0;}" +
      ".pre-fixed-fare-qa h1{font-size:18px;margin:0 0 4px;color:#1b3a6b;line-height:1.3;font-weight:700;}" +
      ".pre-fixed-fare-qa .subtitle{font-size:11.5px;margin:0 0 4px;color:#334155;font-weight:600;}" +
      ".pre-fixed-fare-qa .meta{font-size:10px;margin:0 0 10px;color:#64748b;}" +
      ".pre-fixed-fare-qa .intro-note{margin:0 0 12px;padding:10px 12px;background:#fff8f0;border:1px solid #e0a86a;border-left:5px solid #c56a1a;color:#7c3a0a;font-size:10.5px;line-height:1.5;}" +
      ".pre-fixed-fare-qa .mutuality-box{margin:0 0 14px;padding:10px 12px;background:#f3faf6;border:1px solid #86c9a8;border-left:5px solid #2f8f6b;}" +
      ".pre-fixed-fare-qa .mutuality-box h2{font-size:13px;margin:0 0 6px;padding:0;border:none;color:#1b3a6b;}" +
      ".pre-fixed-fare-qa .mutuality-box p{margin:0 0 6px;color:#1f2937;}" +
      ".pre-fixed-fare-qa .check-list{margin:0;padding:0 0 0 18px;}" +
      ".pre-fixed-fare-qa .check-list li{margin:0 0 4px;color:#14532d;}" +
      ".pre-fixed-fare-qa .check-list li::marker{content:'☑ ';}" +
      ".pre-fixed-fare-qa .section-title{font-size:13.5px;margin:0 0 8px;padding-bottom:3px;border-bottom:2px solid #1b3a6b;color:#1b3a6b;}" +
      ".pre-fixed-fare-qa .qa-item{margin:0 0 10px;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-qa .qa-q{padding:8px 10px;background:#eef5fb;border:1px solid #b7d0e8;border-bottom:none;color:#16324f;font-weight:700;}" +
      ".pre-fixed-fare-qa .qa-a{padding:8px 10px;background:#f8fafc;border:1px solid #d8dee8;color:#1f2937;font-weight:400;}" +
      ".pre-fixed-fare-qa .qa-label{color:#1b3a6b;font-weight:700;}" +
      ".pre-fixed-fare-qa .footer-note{margin-top:14px;padding:10px 12px;background:#fff8f0;border:1px solid #e0a86a;border-left:5px solid #c56a1a;color:#7c3a0a;font-size:10.5px;line-height:1.5;}" +
      ".pre-fixed-fare-qa .footer-note strong{color:#9a4d0f;}" +
      "</style>" +
      reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("事前確定運賃 認可説明Q&A PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("事前確定運賃 認可説明Q&A PDFの生成対象HTMLが空です。");
    }
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

  async function savePdf(reportData){
    assertNoForbiddenTerms(reportData);
    if(!Array.isArray(reportData.qaItems) || reportData.qaItems.length !== 14){
      throw new Error("認可説明Q&Aは14問である必要があります。");
    }

    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-qa");

    ensureRenderableContent(reportElement);
    await waitForRenderReady();

    try{
      await html2pdf().set({
        margin: [12, 12, 12, 12],
        filename: PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(reportElement).save();
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
