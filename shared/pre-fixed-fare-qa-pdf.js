(function(global){
  const DOCUMENT_TITLE = "事前確定運賃システム 認可説明Q&A";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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
      "<section class='compatibility'>" +
        "<h2>" + escapeHtml(mutuality?.title || "") + "</h2>" +
        "<p>" + escapeHtml(mutuality?.intro || "") + "</p>" +
        "<ul>" + items + "</ul>" +
      "</section>"
    );
  }

  function buildPrintStyles(){
    return (
      "@page{size:A4 portrait;margin:16mm 14mm 18mm 14mm;}" +
      "html,body{width:100%;margin:0;padding:0;background:#ffffff;}" +
      "body{font-family:'Yu Gothic','Meiryo',sans-serif;font-size:11pt;line-height:1.6;color:#1f2937;}" +
      "main.print-page{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box;display:block;}" +
      "main.print-page,main.print-page *{box-sizing:border-box;}" +
      "main.print-page *{max-width:100%;overflow-wrap:break-word;word-break:normal;}" +
      "h1{font-size:16pt;margin:0 0 2mm;color:#1b3a6b;line-height:1.3;width:100%;break-after:avoid;page-break-after:avoid;}" +
      ".subtitle{font-size:11.5pt;margin:0 0 2mm;color:#334155;font-weight:700;width:100%;}" +
      ".meta{font-size:9.5pt;margin:0 0 4mm;color:#64748b;width:100%;}" +
      "h2{font-size:13pt;margin:0 0 2mm;color:#1b3a6b;width:100%;break-after:avoid;page-break-after:avoid;}" +
      ".section-title{margin:4mm 0 3mm;padding-bottom:1mm;border-bottom:1.5pt solid #1b3a6b;break-after:avoid;page-break-after:avoid;}" +
      ".note{width:100%;margin:4mm 0;padding:4mm;background:#fff7ed;border-left:4px solid #c46a00;break-inside:avoid;page-break-inside:avoid;}" +
      ".compatibility{width:100%;margin:4mm 0;padding:4mm;background:#eefaf3;border-left:4px solid #16885a;break-inside:avoid;page-break-inside:avoid;}" +
      ".compatibility ul{margin:2mm 0 0;padding-left:5mm;}" +
      ".compatibility li{margin:0 0 1.5mm;}" +
      ".qa-block{width:100%;margin:0 0 7mm;border:1px solid #cbd5e1;page-break-inside:avoid;break-inside:avoid;}" +
      ".qa-question{width:100%;background:#eaf3fb;color:#16365c;font-weight:700;padding:3mm;font-size:10.5pt;}" +
      ".qa-answer{width:100%;background:#ffffff;padding:3mm;font-size:10.5pt;}" +
      ".qa-label{font-weight:700;color:#1b3a6b;}" +
      "@media print{" +
      "html,body,main.print-page{width:100% !important;max-width:none !important;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important;}" +
      "body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      "}" +
      "@media screen{" +
      "html,body,main.print-page{width:100%;max-width:none;margin:0;padding:0;}" +
      "}"
    );
  }

  function buildReportHtml(data){
    return (
      "<main class='print-page'>" +
        "<h1>" + escapeHtml(data.title || "") + "</h1>" +
        "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
        "<p class='meta'>作成日：" + escapeHtml(data.meta?.createdAt || "") +
          "　作成元：" + escapeHtml(data.meta?.createdBy || "") + "</p>" +
        "<section class='note'>" + escapeHtml(data.introNote || "") + "</section>" +
        buildMutualityBlock(data.mutuality) +
        "<h2 class='section-title'>想定質問と回答</h2>" +
        buildQaBlocks(data.qaItems) +
        "<section class='note'><strong>注意事項：</strong>" + escapeHtml(data.footerNote || "") + "</section>" +
      "</main>"
    );
  }

  function buildPrintDocument(data){
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + escapeHtml(data.title || DOCUMENT_TITLE) + "</title>" +
      "<style>" + buildPrintStyles() + "</style>" +
      "</head><body>" +
      buildReportHtml(data) +
      "<script>" +
      "window.addEventListener('load',function(){" +
      "try{if(window.opener){window.moveTo(0,0);window.resizeTo(screen.availWidth,screen.availHeight);}}catch(e){}" +
      "setTimeout(function(){try{window.focus();window.print();}catch(e){}},300);" +
      "});" +
      "<\/script>" +
      "</body></html>"
    );
  }

  function assertReportData(reportData){
    if(JSON.stringify(reportData).includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }
    if(!Array.isArray(reportData.qaItems) || reportData.qaItems.length !== 14){
      throw new Error("認可説明Q&Aは14問である必要があります。");
    }
  }

  function openPrintPage(reportData){
    assertReportData(reportData);
    const html = buildPrintDocument(reportData);
    const printWindow = global.open("", "_blank");
    if(!printWindow){
      throw new Error("印刷用ページを開けませんでした。ポップアップを許可してください。");
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return reportData;
  }

  function generatePreFixedFareQaPdf(options){
    if(!global.PreFixedFareQaData){
      throw new Error("事前確定運賃 認可説明Q&Aデータモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareQaData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃 認可説明Q&Aデータの組み立てに失敗しました。");
    }
    return openPrintPage(reportData);
  }

  global.PreFixedFareQaPdf = {
    buildReportHtml: buildReportHtml,
    buildPrintDocument: buildPrintDocument,
    openPrintPage: openPrintPage,
    savePdf: openPrintPage,
    generatePreFixedFareQaPdf: generatePreFixedFareQaPdf,
    exportPdf: generatePreFixedFareQaPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
