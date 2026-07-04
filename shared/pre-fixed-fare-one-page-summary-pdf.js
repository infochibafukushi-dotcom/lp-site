(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-one-page-summary.pdf";
  const RENDER_WIDTH_PX = 1120;

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
      const existing = document.querySelector("script[data-pre-fixed-fare-one-page-summary-pdf='1']");
      if(existing){
        existing.addEventListener("load", function(){ resolve(); }, { once: true });
        existing.addEventListener("error", function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); }, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = HTML2PDF_CDN;
      script.async = true;
      script.setAttribute("data-pre-fixed-fare-one-page-summary-pdf", "1");
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("PDFライブラリの読み込みに失敗しました。")); };
      document.head.appendChild(script);
    });
  }

  function buildSectionCard(section){
    const toneClass = section.tone === "caution"
      ? "tone-caution"
      : (section.tone === "important" ? "tone-important" : "tone-default");
    const items = (section.items || []).map(function(item){
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("");
    return (
      "<article class='section-card " + toneClass + "'>" +
      "<h2><span class='section-num'>" + escapeHtml(section.number) + "</span>" + escapeHtml(section.title) + "</h2>" +
      "<ul>" + items + "</ul>" +
      "</article>"
    );
  }

  function buildFlowHtml(steps){
    const list = Array.isArray(steps) ? steps : [];
    return (
      "<div class='flow-row'>" +
      list.map(function(step, index){
        const arrow = index < list.length - 1 ? "<span class='flow-arrow' aria-hidden='true'>→</span>" : "";
        return (
          "<div class='flow-item-wrap'>" +
          "<div class='flow-step'>" + escapeHtml(step) + "</div>" +
          arrow +
          "</div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function buildChangeTable(table){
    if(!table) return "";
    const headers = (table.headers || []).map(function(header){
      return "<th>" + escapeHtml(header) + "</th>";
    }).join("");
    const rows = (table.rows || []).map(function(row){
      return "<tr>" + row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return (
      "<section class='change-table-block'>" +
      "<h3>" + escapeHtml(table.title || "") + "</h3>" +
      "<table>" +
      "<thead><tr>" + headers + "</tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "</table>" +
      "</section>"
    );
  }

  function buildReportHtml(data){
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const topSections = sections.slice(0, 4).map(buildSectionCard).join("");
    const bottomSections = sections.slice(4).map(buildSectionCard).join("");
    return (
      "<div class='pre-fixed-fare-one-page-summary'>" +
      "<header class='report-header'>" +
      "<div class='header-text'>" +
      "<h1>" + escapeHtml(data.title || "") + "</h1>" +
      "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
      "</div>" +
      "<div class='header-meta'>" +
      "<div>作成日：" + escapeHtml(data.meta?.createdAt || "") + "</div>" +
      "<div>作成元：" + escapeHtml(data.meta?.createdBy || "") + "</div>" +
      "</div>" +
      "</header>" +
      "<div class='overview-box'>" + escapeHtml(data.overview || "") + "</div>" +
      "<section class='flow-block'>" +
      "<h2 class='flow-title'>運用フロー</h2>" +
      buildFlowHtml(data.flowSteps) +
      "</section>" +
      "<div class='section-grid section-grid-top'>" + topSections + "</div>" +
      "<div class='section-grid section-grid-bottom'>" + bottomSections + "</div>" +
      buildChangeTable(data.changeTable) +
      "</div>"
    );
  }

  function getReportCss(){
    return (
      ".pre-fixed-fare-one-page-summary,.pre-fixed-fare-one-page-summary *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;}" +
      ".pre-fixed-fare-one-page-summary{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:" + RENDER_WIDTH_PX + "px;background:#ffffff;color:#1a1a1a;line-height:1.35;font-size:9px;padding:8px 10px 6px;margin:0;}" +
      ".pre-fixed-fare-one-page-summary .report-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin:0 0 6px;padding-bottom:5px;border-bottom:2px solid #1b3a6b;}" +
      ".pre-fixed-fare-one-page-summary h1{font-size:18px;margin:0 0 2px;color:#1b3a6b;line-height:1.25;font-weight:700;}" +
      ".pre-fixed-fare-one-page-summary .subtitle{font-size:10.5px;margin:0;color:#334155;font-weight:600;}" +
      ".pre-fixed-fare-one-page-summary .header-meta{font-size:8.5px;color:#475569;text-align:right;line-height:1.4;white-space:nowrap;}" +
      ".pre-fixed-fare-one-page-summary .overview-box{margin:0 0 6px;padding:7px 10px;border:1px solid #2f6fad;border-left:5px solid #2f6fad;background:#f3f8fc;color:#16324f;font-size:9.2px;line-height:1.45;border-radius:3px;}" +
      ".pre-fixed-fare-one-page-summary .flow-block{margin:0 0 6px;padding:6px 8px 5px;border:1px solid #2f8f6b;background:#f3faf6;border-radius:3px;}" +
      ".pre-fixed-fare-one-page-summary .flow-title{margin:0 0 4px;font-size:10.5px;color:#1b3a6b;font-weight:700;}" +
      ".pre-fixed-fare-one-page-summary .flow-row{display:flex;align-items:center;justify-content:space-between;gap:2px;}" +
      ".pre-fixed-fare-one-page-summary .flow-item-wrap{display:flex;align-items:center;gap:2px;flex:1 1 auto;min-width:0;}" +
      ".pre-fixed-fare-one-page-summary .flow-step{flex:1 1 auto;min-width:0;text-align:center;padding:5px 3px;border:1px solid #2f8f6b;background:#ffffff;color:#14532d;font-size:8.5px;font-weight:700;border-radius:3px;line-height:1.25;}" +
      ".pre-fixed-fare-one-page-summary .flow-arrow{flex:0 0 auto;color:#2f8f6b;font-size:11px;font-weight:700;padding:0 1px;}" +
      ".pre-fixed-fare-one-page-summary .section-grid{display:grid;gap:5px;margin:0 0 5px;}" +
      ".pre-fixed-fare-one-page-summary .section-grid-top{grid-template-columns:repeat(4,minmax(0,1fr));}" +
      ".pre-fixed-fare-one-page-summary .section-grid-bottom{grid-template-columns:repeat(3,minmax(0,1fr));}" +
      ".pre-fixed-fare-one-page-summary .section-card{margin:0;padding:5px 6px 4px;border:1px solid #cbd5e1;border-radius:3px;background:#ffffff;min-height:0;}" +
      ".pre-fixed-fare-one-page-summary .section-card h2{display:flex;align-items:center;gap:5px;margin:0 0 3px;padding:0 0 2px;border-bottom:1px solid #dbe3ef;font-size:10px;color:#1b3a6b;line-height:1.25;font-weight:700;}" +
      ".pre-fixed-fare-one-page-summary .section-num{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#1b3a6b;color:#ffffff;font-size:8px;flex:0 0 auto;}" +
      ".pre-fixed-fare-one-page-summary .section-card ul{margin:0;padding:0 0 0 12px;}" +
      ".pre-fixed-fare-one-page-summary .section-card li{margin:0 0 2px;padding:0;font-size:8.2px;line-height:1.35;color:#1f2937;}" +
      ".pre-fixed-fare-one-page-summary .tone-important{border-color:#7eb3d9;background:#f7fbfe;}" +
      ".pre-fixed-fare-one-page-summary .tone-important h2{border-bottom-color:#b7d4ea;}" +
      ".pre-fixed-fare-one-page-summary .tone-caution{border-color:#e0a86a;background:#fff8f0;}" +
      ".pre-fixed-fare-one-page-summary .tone-caution h2{color:#9a4d0f;border-bottom-color:#f0d0a8;}" +
      ".pre-fixed-fare-one-page-summary .tone-caution .section-num{background:#c56a1a;}" +
      ".pre-fixed-fare-one-page-summary .change-table-block{margin:0;}" +
      ".pre-fixed-fare-one-page-summary .change-table-block h3{margin:0 0 3px;font-size:10.5px;color:#1b3a6b;font-weight:700;}" +
      ".pre-fixed-fare-one-page-summary table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0;background:#ffffff;}" +
      ".pre-fixed-fare-one-page-summary th,.pre-fixed-fare-one-page-summary td{border:1px solid #c9d4e3;padding:4px 5px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;font-size:8.3px;line-height:1.35;color:#1f2937;}" +
      ".pre-fixed-fare-one-page-summary th{background:#e8eef7;color:#1b3a6b;font-weight:700;}" +
      ".pre-fixed-fare-one-page-summary tbody tr:nth-child(1) td:first-child{background:#fff8f0;font-weight:700;color:#9a4d0f;}" +
      ".pre-fixed-fare-one-page-summary tbody tr:nth-child(2) td:first-child{background:#f3f8fc;font-weight:700;color:#1b4f86;}" +
      ".pre-fixed-fare-one-page-summary tbody tr:nth-child(3) td:first-child{background:#f3faf6;font-weight:700;color:#166534;}"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-one-page-summary-render-shell";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "2147483000";
    container.style.pointerEvents = "none";
    container.style.display = "block";
    container.style.visibility = "visible";
    container.style.opacity = "1";
    container.style.width = RENDER_WIDTH_PX + "px";
    container.style.background = "#ffffff";
    container.style.color = "#111111";
    container.style.padding = "0";
    container.style.margin = "0";
    container.innerHTML = "<style>" + getReportCss() + "</style>" + reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("事前確定運賃 認可説明1枚資料PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("事前確定運賃 認可説明1枚資料PDFの生成対象HTMLが空です。");
    }
  }

  async function waitForRenderReady(){
    try{
      if(document.fonts && typeof document.fonts.ready?.then === "function"){
        await document.fonts.ready;
      }
    }catch(error){
      console.warn("[PreFixedFareOnePageSummaryPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-one-page-summary");

    ensureRenderableContent(reportElement);
    await waitForRenderReady();

    const forbidden = String(reportElement?.innerText || "").includes("認可ルート");
    if(forbidden){
      wrapper.remove();
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }

    try{
      await html2pdf().set({
        margin: [5, 5, 5, 5],
        filename: PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          width: RENDER_WIDTH_PX,
          windowWidth: RENDER_WIDTH_PX
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all"] }
      }).from(reportElement).save();
    }finally{
      wrapper.remove();
    }
  }

  async function generatePreFixedFareOnePageSummaryPdf(options){
    if(!global.PreFixedFareOnePageSummaryData){
      throw new Error("事前確定運賃 認可説明1枚資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareOnePageSummaryData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃 認可説明1枚資料データの組み立てに失敗しました。");
    }
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareOnePageSummaryPdf = {
    PDF_FILENAME: PDF_FILENAME,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareOnePageSummaryPdf: generatePreFixedFareOnePageSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
