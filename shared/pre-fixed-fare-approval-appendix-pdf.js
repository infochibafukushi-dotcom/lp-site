(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-approval-appendix.pdf";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildList(items){
    const list = Array.isArray(items) ? items : [];
    if(!list.length) return "<p>—</p>";
    return "<ul>" + list.map(function(item){
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("") + "</ul>";
  }

  function buildTable(headers, rows, options){
    options = options || {};
    const className = String(options.className || "").trim();
    const colWidths = Array.isArray(options.colWidths) ? options.colWidths : [];
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const colgroup = colWidths.length
      ? "<colgroup>" + colWidths.map(function(width){
        return "<col style='width:" + escapeHtml(width) + ";'>";
      }).join("") + "</colgroup>"
      : "";
    const body = (rows || []).map(function(row){
      const cells = row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return "<table" + (className ? " class='" + escapeHtml(className) + "'" : "") + ">" + colgroup + "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function capturePlaceholder(label){
    return (
      "<div class='capture-placeholder'>" +
      "<p class='capture-placeholder-label'>" + escapeHtml(label || "画面キャプチャ貼付欄") + "</p>" +
      "<p class='capture-placeholder-note'>（実画像を本枠内に貼付）</p>" +
      "</div>"
    );
  }

  function buildDataRetentionHtml(regulation){
    const sections = (regulation.sections || []).map(function(section){
      let body = (section.paragraphs || []).map(function(paragraph){
        return "<p>" + escapeHtml(paragraph) + "</p>";
      }).join("");
      if(section.outputItems){
        body += buildList(section.outputItems);
      }
      if(section.closing){
        body += "<p>" + escapeHtml(section.closing) + "</p>";
      }
      return (
        "<section class='appendix-section'>" +
        "<h3>" + escapeHtml(section.number + ". " + section.title) + "</h3>" +
        body +
        "</section>"
      );
    }).join("");

    return (
      "<div class='appendix-page'>" +
      "<h2>" + escapeHtml(regulation.title || "") + "</h2>" +
      sections +
      "</div>"
    );
  }

  function buildScreenshotHtml(screenshots){
    const screens = (screenshots.screens || []).map(function(screen){
      return (
        "<section class='appendix-section screenshot-section'>" +
        "<h3>" + escapeHtml(screen.number + ". " + screen.title) + "</h3>" +
        capturePlaceholder("画面キャプチャ貼付欄（" + screen.title + "）") +
        "<h4>キャプチャ内容</h4><p>" + escapeHtml(screen.captureContent || "") + "</p>" +
        "<h4>証明文</h4><p>" + escapeHtml(screen.proofText || "") + "</p>" +
        "</section>"
      );
    }).join("");

    return (
      "<div class='appendix-page'>" +
      "<h2>" + escapeHtml(screenshots.title || "") + "</h2>" +
      (screenshots.intro ? "<p class='intro'>" + escapeHtml(screenshots.intro) + "</p>" : "") +
      screens +
      "</div>"
    );
  }

  function buildE2eHtml(e2e){
    return (
      "<div class='appendix-page'>" +
      "<h2>" + escapeHtml(e2e.title || "") + "</h2>" +
      (e2e.note ? "<p class='intro'>" + escapeHtml(e2e.note) + "</p>" : "") +
      buildTable(
        e2e.headers || ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
        e2e.rows || [],
        { className: "table-e2e-cases", colWidths: ["10%", "22%", "30%", "10%", "28%"] }
      ) +
      "</div>"
    );
  }

  function buildTamperProtectionHtml(tamper){
    return (
      "<div class='appendix-page'>" +
      "<h2>" + escapeHtml(tamper.title || "") + "</h2>" +
      (tamper.paragraphs || []).map(function(paragraph){
        return "<p>" + escapeHtml(paragraph) + "</p>";
      }).join("") +
      (tamper.terminologyNote
        ? "<p class='terminology-note'><strong>用語の位置づけ：</strong>" + escapeHtml(tamper.terminologyNote) + "</p>"
        : "") +
      "</div>"
    );
  }

  function buildReportHtml(data){
    return (
      "<div class='pre-fixed-fare-approval-appendix'>" +
      "<div class='appendix-cover'>" +
      "<h1>事前確定運賃システム 追加資料</h1>" +
      "<p class='subtitle'>データ保存・画面キャプチャ・E2E確認・改ざん防止説明</p>" +
      buildTable(
        ["項目", "内容"],
        [
          ["作成日", data.meta?.createdAt || ""],
          ["作成元", data.meta?.createdBy || "管理画面"],
          ["資料区分", data.meta?.documentType || ""]
        ],
        { className: "table-meta", colWidths: ["28%", "72%"] }
      ) +
      "</div>" +
      buildDataRetentionHtml(data.dataRetentionRegulation || {}) +
      buildScreenshotHtml(data.screenshotCaptures || {}) +
      buildE2eHtml(data.e2eTestCases || {}) +
      buildTamperProtectionHtml(data.tamperProtection || {}) +
      (data.footerNote ? "<p class='footer-note'>" + escapeHtml(data.footerNote) + "</p>" : "") +
      "</div>"
    );
  }

  function getAppendixCss(){
    return (
      ".pre-fixed-fare-approval-appendix,.pre-fixed-fare-approval-appendix *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;color:#111111;}" +
      ".pre-fixed-fare-approval-appendix{width:720px;background:#ffffff;line-height:1.45;font-size:10.5px;padding:0;margin:0;}" +
      ".pre-fixed-fare-approval-appendix h1{font-size:20px;margin:0 0 6px;color:#1b3a6b;}" +
      ".pre-fixed-fare-approval-appendix h2{font-size:15px;margin:0 0 8px;color:#1b3a6b;border-bottom:2px solid #1b3a6b;padding-bottom:4px;}" +
      ".pre-fixed-fare-approval-appendix h3{font-size:12px;margin:10px 0 4px;color:#16365c;}" +
      ".pre-fixed-fare-approval-appendix h4{font-size:10.5px;margin:6px 0 3px;color:#334155;}" +
      ".pre-fixed-fare-approval-appendix p{margin:0 0 6px;}" +
      ".pre-fixed-fare-approval-appendix ul{margin:0 0 6px 16px;padding:0;}" +
      ".pre-fixed-fare-approval-appendix li{margin:0 0 3px;}" +
      ".pre-fixed-fare-approval-appendix .appendix-cover{margin:0 0 16px;page-break-after:always;}" +
      ".pre-fixed-fare-approval-appendix .appendix-page{margin:0 0 16px;page-break-after:always;}" +
      ".pre-fixed-fare-approval-appendix .subtitle{font-size:12px;color:#334155;margin:0 0 10px;}" +
      ".pre-fixed-fare-approval-appendix .intro{font-size:10px;color:#475569;margin:0 0 8px;}" +
      ".pre-fixed-fare-approval-appendix table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 10px;}" +
      ".pre-fixed-fare-approval-appendix th,.pre-fixed-fare-approval-appendix td{border:1px solid #d9d9d9;padding:4px;vertical-align:top;font-size:9px;line-height:1.35;}" +
      ".pre-fixed-fare-approval-appendix th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-approval-appendix .capture-placeholder{border:2px dashed #94a3b8;background:#f8fafc;min-height:90px;padding:12px;margin:6px 0 8px;text-align:center;}" +
      ".pre-fixed-fare-approval-appendix .capture-placeholder-label{font-weight:700;color:#475569;margin:0 0 4px;}" +
      ".pre-fixed-fare-approval-appendix .capture-placeholder-note{font-size:9px;color:#64748b;margin:0;}" +
      ".pre-fixed-fare-approval-appendix .terminology-note{margin-top:8px;padding:6px;background:#eef5fb;border-left:4px solid #2f6fad;font-size:9.5px;}" +
      ".pre-fixed-fare-approval-appendix .footer-note{margin-top:10px;font-size:9px;color:#64748b;}"
    );
  }

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

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "720px";
    container.style.background = "#ffffff";
    container.innerHTML = "<style>" + getAppendixCss() + "</style>" + reportHtml;
    document.body.appendChild(container);
    const reportElement = container.querySelector(".pre-fixed-fare-approval-appendix");
    try{
      await html2pdf().set({
        margin: [8, 8, 12, 8],
        filename: PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: [".appendix-page"] }
      }).from(reportElement).save();
    }finally{
      container.remove();
    }
  }

  async function generatePreFixedFareApprovalAppendixPdf(options){
    if(!global.PreFixedFareApprovalAppendixData){
      throw new Error("追加資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareApprovalAppendixData.buildReportData(options || {});
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareApprovalAppendixPdf = {
    PDF_FILENAME: PDF_FILENAME,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareApprovalAppendixPdf: generatePreFixedFareApprovalAppendixPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
