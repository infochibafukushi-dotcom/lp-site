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
    if(global.PreFixedFarePrintLayoutCss){
      return global.PreFixedFarePrintLayoutCss.getPrintPageStyles();
    }
    return (
      "@page{size:A4 portrait;margin:16mm 14mm 20mm 14mm;}" +
      "html,body{width:100%;margin:0;padding:0;background:#ffffff;}" +
      "body{font-family:'Yu Gothic','Meiryo',sans-serif;font-size:11pt;line-height:1.55;color:#111827;}"
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
