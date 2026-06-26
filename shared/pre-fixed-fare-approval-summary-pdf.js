(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-approval-summary.pdf";

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

  function section(title, bodyHtml){
    return (
      "<section>" +
      "<div class='report-section-title-block'><h2>" + escapeHtml(title) + "</h2></div>" +
      "<div class='report-section-body'>" + bodyHtml + "</div>" +
      "</section>"
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

  function buildMetaTable(meta){
    return buildTable(
      ["項目", "内容"],
      [
        ["資料名", meta.title || ""],
        ["位置づけ", meta.subtitle || ""],
        ["対象", meta.targetSystem || ""],
        ["目的", meta.purpose || ""],
        ["対象URL", meta.targetUrl || ""],
        ["対象コミット", meta.targetCommit || ""],
        ["資料区分", meta.positioning || ""],
        ["作成日", meta.createdAt || ""],
        ["作成元", meta.createdBy || ""]
      ],
      { className: "table-meta", colWidths: ["28%", "72%"] }
    );
  }

  function buildReportHtml(data){
    const judgmentRows = (data.judgmentRows || []).map(function(row){
      return [row.condition, row.system, row.reservationUrl, row.button, row.handling];
    });
    const routeTypeBlocks = (data.routeCandidateTypes || []).map(function(item){
      return "<h3>" + escapeHtml(item.name) + "</h3><p>" + escapeHtml(item.description) + "</p>";
    }).join("");
    const snapshotFieldRows = (data.snapshotFields || []).map(function(item){
      return [item.field, item.description];
    });
    const phase3Rows = (data.phase3EvidenceRows || []).map(function(row){
      return [row.caseName, row.content, row.pdf, row.quoteSnapshot, row.handoff, row.screenshot];
    });
    const phase2Rows = (data.phase2EvidenceRows || []).map(function(row){
      return [row.caseName, row.content, row.files];
    });
    const commitRows = (data.relatedCommits || []).map(function(row){
      return [row.commit, row.description];
    });
    const folderRows = (data.evidenceFolders || []).map(function(row){
      return [row.folder, row.description];
    });

    return (
      "<div class='pre-fixed-fare-approval-summary'>" +
      "<h1>" + escapeHtml(data.title || "") + "</h1>" +
      "<p class='subtitle'>" + escapeHtml(data.meta?.subtitle || "") + "</p>" +
      section("1. 表紙・概要",
        buildMetaTable({
          title: data.title,
          subtitle: data.meta?.subtitle,
          targetSystem: data.meta?.targetSystem,
          purpose: data.meta?.purpose,
          targetUrl: data.meta?.targetUrl,
          targetCommit: data.meta?.targetCommit,
          positioning: data.meta?.positioning,
          createdAt: data.meta?.createdAt,
          createdBy: data.meta?.createdBy
        }) +
        "<p>" + escapeHtml(data.overviewNote || "") + "</p>"
      ) +
      section("2. システム全体フロー", buildList(data.systemFlow)) +
      section("3. 判定ロジック",
        buildTable(
          ["条件", "システム判定", "予約URL", "ボタン文言", "扱い"],
          judgmentRows,
          { className: "table-judgment", colWidths: ["24%", "18%", "16%", "18%", "24%"] }
        ) +
        "<h3>補足</h3>" + buildList(data.judgmentNotes)
      ) +
      section("4. ルート候補の種類",
        routeTypeBlocks +
        "<h3>候補の重複整理（dedupe）</h3><p>" + escapeHtml(data.dedupeNote || "") + "</p>"
      ) +
      section("5. 候補1件時の確認対応",
        buildList(data.singleCandidate?.intro) +
        "<h3>画面・予約導線上の表現</h3>" + buildList(data.singleCandidate?.ui) +
        "<h3>Phase 2 証跡による確認例</h3><p>" + escapeHtml(data.singleCandidate?.evidence || "") + "</p>"
      ) +
      section("6. 帰り立ち寄りありの全体走行予定ルート",
        buildList(data.returnWithStop?.intro) +
        "<h3>内部構造の概要</h3>" + buildList(data.returnWithStop?.structure) +
        "<h3>結果画面の表現</h3>" + buildList(data.returnWithStop?.display)
      ) +
      section("7. quoteSnapshot / handoff の証跡",
        buildList(data.snapshotIntro) +
        "<h3>代表フィールド</h3>" +
        buildTable(
          ["フィールド", "説明"],
          snapshotFieldRows,
          { className: "table-snapshot-fields", colWidths: ["32%", "68%"] }
        ) +
        "<h3>保存先の関係</h3>" + buildList(data.snapshotFlow)
      ) +
      section("8. Phase 2 / Phase 3-B 証跡ファイル一覧",
        "<h3>証跡フォルダ</h3>" +
        buildTable(
          ["フォルダ", "内容"],
          folderRows,
          { className: "table-folders", colWidths: ["42%", "58%"] }
        ) +
        "<h3>Phase 3-B 証跡（主要）</h3>" +
        "<p>いずれも docs/evidence/pre-fixed-fare-phase3/ 配下に保存。</p>" +
        buildTable(
          ["ケース", "内容", "PDF", "quoteSnapshot", "handoff", "screenshot"],
          phase3Rows,
          { className: "table-phase3-evidence", colWidths: ["12%", "22%", "16%", "16%", "14%", "20%"] }
        ) +
        "<h3>Phase 2 証跡（補足）</h3>" +
        "<p>いずれも docs/evidence/pre-fixed-fare-phase2/ 配下に保存。</p>" +
        buildTable(
          ["ケース", "内容", "主なファイル"],
          phase2Rows,
          { className: "table-phase2-evidence", colWidths: ["16%", "34%", "50%"] }
        ) +
        "<h3>関連コミット</h3>" +
        buildTable(
          ["コミット", "内容"],
          commitRows,
          { className: "table-commits", colWidths: ["18%", "82%"] }
        )
      ) +
      section("9. 認可説明用の要約文", buildList(data.approvalSummary)) +
      "<p class='footer-note'>" + escapeHtml(data.footerNote || "") + "</p>" +
      "</div>"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-approval-summary-render-shell";
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
      ".pre-fixed-fare-approval-summary,.pre-fixed-fare-approval-summary *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111111;}" +
      ".pre-fixed-fare-approval-summary{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:720px;background:#ffffff;color:#111111;line-height:1.45;font-size:10.5px;padding:4px 0 0;margin:0;}" +
      ".pre-fixed-fare-approval-summary h1{font-size:19px;margin:0 0 4px;color:#111111;line-height:1.3;}" +
      ".pre-fixed-fare-approval-summary .subtitle{font-size:11px;margin:0 0 8px;color:#444;}" +
      ".pre-fixed-fare-approval-summary h2{font-size:13.5px;margin:14px 0 6px;padding-bottom:2px;border-bottom:1px solid #ccc;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-approval-summary h3{font-size:11.5px;margin:8px 0 5px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-approval-summary p{margin:0 0 6px;color:#111111;}" +
      ".pre-fixed-fare-approval-summary ul,.pre-fixed-fare-approval-summary ol{margin:0 0 6px 16px;padding:0;}" +
      ".pre-fixed-fare-approval-summary li{margin:0 0 3px;color:#111111;}" +
      ".pre-fixed-fare-approval-summary table{width:100%;border-collapse:collapse;table-layout:fixed;margin:5px 0 8px;background:#ffffff;}" +
      ".pre-fixed-fare-approval-summary th,.pre-fixed-fare-approval-summary td{border:1px solid #d9d9d9;padding:5px 6px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;color:#111111;background:#ffffff;box-sizing:border-box;font-size:9.5px;line-height:1.4;}" +
      ".pre-fixed-fare-approval-summary th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-approval-summary section{break-inside:auto;page-break-inside:auto;margin:0 0 10px;}" +
      ".pre-fixed-fare-approval-summary .report-section-title-block{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-approval-summary .report-section-body{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-approval-summary tr{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-approval-summary .table-meta tr,.pre-fixed-fare-approval-summary .table-judgment tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-approval-summary .table-phase3-evidence td,.pre-fixed-fare-approval-summary .table-phase3-evidence th{font-size:8.5px;}" +
      ".pre-fixed-fare-approval-summary .footer-note{margin-top:12px;font-size:9.5px;color:#444;}" +
      "</style>" +
      reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("事前確定運賃システム説明資料PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("事前確定運賃システム説明資料PDFの生成対象HTMLが空です。");
    }
  }

  async function waitForRenderReady(){
    try{
      if(document.fonts && typeof document.fonts.ready?.then === "function"){
        await document.fonts.ready;
      }
    }catch(error){
      console.warn("[PreFixedFareApprovalSummaryPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-approval-summary");

    ensureRenderableContent(reportElement);
    await waitForRenderReady();

    try{
      await html2pdf().set({
        margin: [8, 8, 8, 8],
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

  async function generatePreFixedFareApprovalSummaryPdf(){
    if(!global.PreFixedFareApprovalSummaryData){
      throw new Error("事前確定運賃システム説明資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareApprovalSummaryData.buildReportData();
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃システム説明資料データの組み立てに失敗しました。");
    }
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareApprovalSummaryPdf = {
    PDF_FILENAME: PDF_FILENAME,
    savePdf: savePdf,
    generatePreFixedFareApprovalSummaryPdf: generatePreFixedFareApprovalSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
