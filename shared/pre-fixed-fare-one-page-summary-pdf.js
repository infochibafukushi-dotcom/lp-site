(function(global){
  const DOCUMENT_TITLE = "事前確定運賃システム 運用フロー説明資料";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function toneClass(tone){
    return tone === "caution" ? "card warning" : "card";
  }

  function buildFlowHtml(flowSteps){
    const steps = Array.isArray(flowSteps) ? flowSteps : [];
    return (
      "<div class='flow-wrap'>" +
        "<h2>運用フロー</h2>" +
        "<div class='flow'>" +
          steps.map(function(step){
            return "<div class='flow-item'>" + escapeHtml(step) + "</div>";
          }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function buildCardsHtml(sections){
    const list = Array.isArray(sections) ? sections : [];
    return (
      "<div class='cards'>" +
        list.map(function(section){
          const items = (section.items || []).map(function(item){
            return "<li>" + escapeHtml(item) + "</li>";
          }).join("");
          return (
            "<div class='" + toneClass(section.tone) + "'>" +
              "<div class='card-title'>" +
                "<span class='card-num'>" + escapeHtml(section.number || "") + "</span>" +
                "<span>" + escapeHtml(section.title || "") + "</span>" +
              "</div>" +
              "<ul>" + items + "</ul>" +
            "</div>"
          );
        }).join("") +
      "</div>"
    );
  }

  function buildTableHtml(changeTable){
    const table = changeTable || {};
    const headers = table.headers || [];
    const rows = table.rows || [];
    const th = headers.map(function(cell){
      return "<th>" + escapeHtml(cell) + "</th>";
    }).join("");
    const body = rows.map(function(row, rowIndex){
      const cells = (row || []).map(function(cell, colIndex){
        const cls = colIndex === 0 ? ("row-label row-" + rowIndex) : "";
        return "<td class='" + cls + "'>" + escapeHtml(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return (
      "<div class='table-wrap'>" +
        "<h2>" + escapeHtml(table.title || "") + "</h2>" +
        "<table>" +
          "<thead><tr>" + th + "</tr></thead>" +
          "<tbody>" + body + "</tbody>" +
        "</table>" +
      "</div>"
    );
  }

  function buildPrintStyles(){
    return (
      "@page{size:A4 landscape;margin:10mm;}" +
      "html,body{margin:0;padding:0;background:#ffffff;color:#1f2937;font-family:'Yu Gothic','Meiryo',sans-serif;font-size:9.5pt;line-height:1.45;}" +
      "*{box-sizing:border-box;overflow-wrap:break-word;}" +
      ".print-page{width:100%;box-sizing:border-box;}" +
      ".page{width:100%;}" +
      ".page-2{break-before:page;page-break-before:always;}" +
      "h1{font-size:15pt;margin:0 0 1.5mm;color:#1b3a6b;line-height:1.3;}" +
      ".subtitle{font-size:10pt;margin:0 0 1mm;color:#334155;font-weight:700;}" +
      ".meta{font-size:9pt;margin:0 0 3mm;color:#64748b;}" +
      "h2{font-size:11pt;margin:0 0 2mm;color:#1b3a6b;}" +
      ".header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1.5pt solid #1b3a6b;}" +
      ".overview{margin:0 0 3mm;padding:3mm;background:#eef5fb;border-left:4px solid #2f6fad;}" +
      ".flow-wrap{margin:0 0 3mm;}" +
      ".flow{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:4mm 0;}" +
      ".flow-item{border:1px solid #16885a;border-radius:4px;padding:2.5mm;text-align:center;font-weight:700;white-space:normal;background:#f3faf6;color:#14532d;}" +
      ".cards{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;}" +
      ".card{border:1px solid #bfdbfe;border-radius:6px;padding:3mm;break-inside:avoid;page-break-inside:avoid;background:#ffffff;}" +
      ".card.warning{border-color:#f59e0b;background:#fff7ed;}" +
      ".card-title{display:flex;align-items:center;gap:2mm;font-weight:700;color:#1b3a6b;margin-bottom:1.5mm;}" +
      ".card.warning .card-title{color:#9a4d0f;}" +
      ".card-num{display:inline-flex;align-items:center;justify-content:center;min-width:5mm;height:5mm;border-radius:50%;background:#1b3a6b;color:#ffffff;font-size:8pt;}" +
      ".card.warning .card-num{background:#c56a1a;}" +
      ".card ul{margin:0;padding-left:4.5mm;}" +
      ".card li{margin:0 0 1mm;}" +
      ".table-wrap{margin:0 0 4mm;}" +
      "table{width:100%;border-collapse:collapse;margin-top:4mm;font-size:9pt;}" +
      "th,td{border:1px solid #cbd5e1;padding:2mm;vertical-align:top;}" +
      "th{background:#dbeafe;color:#16365c;}" +
      "td.row-label{font-weight:700;}" +
      "td.row-0{background:#fff7ed;color:#9a4d0f;}" +
      "td.row-1{background:#eef5fb;color:#1b4f86;}" +
      "td.row-2{background:#eefaf3;color:#166534;}" +
      ".note-box,.record-box{margin:0 0 4mm;padding:3mm;border-radius:4px;}" +
      ".note-box{background:#fff7ed;border-left:4px solid #c46a00;}" +
      ".record-box{background:#eef5fb;border-left:4px solid #2f6fad;}" +
      ".note-box ul,.record-box ul{margin:0;padding-left:5mm;}" +
      ".note-box li,.record-box li{margin:0 0 1.5mm;}" +
      "@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      ".page-2{break-before:page;page-break-before:always;}}"
    );
  }

  function buildReportHtml(data){
    return (
      "<div class='print-page'>" +
        "<div class='page page-1'>" +
          "<div class='header-row'>" +
            "<div>" +
              "<h1>" + escapeHtml(data.title || "") + "</h1>" +
              "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
            "</div>" +
            "<p class='meta'>作成日：" + escapeHtml(data.meta?.createdAt || "") + "</p>" +
          "</div>" +
          "<div class='overview'>" + escapeHtml(data.overview || "") + "</div>" +
          buildFlowHtml(data.flowSteps) +
          buildCardsHtml(data.sections) +
        "</div>" +
        "<div class='page page-2'>" +
          buildTableHtml(data.changeTable) +
          "<div class='record-box'>" +
            "<h2>保存記録の説明</h2>" +
            "<ul>" +
              "<li>予約時は、選択された走行予定ルート、主要経由地点、運賃額、同意日時、スナップショットハッシュを保存します。</li>" +
              "<li>運行時は、運行開始時刻、ルート変更ログ、追加介助料、実費、精算額、領収書・レシート情報を保存します。</li>" +
              "<li>予約ID・見積番号・運行記録を紐づけ、同意内容と実際の運行・精算内容を後から照合できる設計です。</li>" +
            "</ul>" +
          "</div>" +
          "<div class='note-box'>" +
            "<h2>注意事項</h2>" +
            "<ul>" +
              "<li>本資料は運輸局説明用の運用フロー要約です。正式な申請様式、運賃表、算定根拠資料、システム概要書、統合説明資料とあわせて使用します。</li>" +
              "<li>事前確定運賃として提示する場合は、2以上の走行予定ルートから旅客が選択することを前提とします。</li>" +
              "<li>有料道路料金、迎車料金、介助料、待機料、実費は、事前確定運賃とは区分して表示・精算します。</li>" +
            "</ul>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function buildPrintDocument(data){
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<title>" + escapeHtml(data.title || DOCUMENT_TITLE) + "</title>" +
      "<style>" + buildPrintStyles() + "</style>" +
      "</head><body>" +
      buildReportHtml(data) +
      "<script>" +
      "window.addEventListener('load',function(){" +
      "setTimeout(function(){try{window.focus();window.print();}catch(e){}},200);" +
      "});" +
      "<\/script>" +
      "</body></html>"
    );
  }

  function assertReportData(reportData){
    if(JSON.stringify(reportData).includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }
    if(!(reportData.flowSteps || []).includes("見積入力")){
      throw new Error("運用フロー先頭「見積入力」がデータにありません。");
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

  function generatePreFixedFareOnePageSummaryPdf(options){
    if(!global.PreFixedFareOnePageSummaryData){
      throw new Error("事前確定運賃 運用フロー説明資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareOnePageSummaryData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃 運用フロー説明資料データの組み立てに失敗しました。");
    }
    return openPrintPage(reportData);
  }

  global.PreFixedFareOnePageSummaryPdf = {
    buildReportHtml: buildReportHtml,
    buildPrintDocument: buildPrintDocument,
    openPrintPage: openPrintPage,
    savePdf: openPrintPage,
    generatePreFixedFareOnePageSummaryPdf: generatePreFixedFareOnePageSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
