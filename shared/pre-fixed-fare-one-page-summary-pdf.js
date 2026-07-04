(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-one-page-summary.pdf";
  const SHEET_WIDTH_PX = 1120;

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

  function toneClass(tone){
    if(tone === "caution") return "tone-caution";
    if(tone === "important") return "tone-important";
    return "tone-default";
  }

  function buildFlowHtml(flowSteps){
    const steps = Array.isArray(flowSteps) ? flowSteps : [];
    return (
      "<div class='flow-box'>" +
        "<div class='flow-title'>運用フロー</div>" +
        "<div class='flow-steps'>" +
          steps.map(function(step, index){
            const arrow = index < steps.length - 1 ? "<span class='flow-arrow'>→</span>" : "";
            return "<span class='flow-step'>" + escapeHtml(step) + "</span>" + arrow;
          }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function buildSectionsHtml(sections){
    const list = Array.isArray(sections) ? sections : [];
    return (
      "<div class='section-grid'>" +
        list.map(function(section){
          const items = (section.items || []).map(function(item){
            return "<li>" + escapeHtml(item) + "</li>";
          }).join("");
          return (
            "<div class='section-card " + toneClass(section.tone) + "'>" +
              "<div class='section-head'>" +
                "<span class='section-num'>" + escapeHtml(section.number || "") + "</span>" +
                "<span class='section-title'>" + escapeHtml(section.title || "") + "</span>" +
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

  function buildReportHtml(data){
    return (
      "<div class='onepage-pdf-root'>" +
        "<div class='onepage-sheet page-1'>" +
          "<div class='header-row'>" +
            "<div>" +
              "<h1>" + escapeHtml(data.title || "") + "</h1>" +
              "<p class='subtitle'>" + escapeHtml(data.subtitle || "") + "</p>" +
            "</div>" +
            "<p class='meta'>作成日：" + escapeHtml(data.meta?.createdAt || "") + "</p>" +
          "</div>" +
          "<div class='overview'>" + escapeHtml(data.overview || "") + "</div>" +
          buildFlowHtml(data.flowSteps) +
          buildSectionsHtml(data.sections) +
        "</div>" +
        "<div class='onepage-sheet page-2'>" +
          buildTableHtml(data.changeTable) +
          "<div class='note-box'>" +
            "<h2>注意事項</h2>" +
            "<ul>" +
              "<li>本資料は運輸局説明用の運用フロー要約です。正式な申請様式、運賃表、算定根拠資料、システム概要書、統合説明資料とあわせて使用します。</li>" +
              "<li>事前確定運賃として提示する場合は、2以上の走行予定ルートから旅客が選択することを前提とします。</li>" +
              "<li>有料道路料金、迎車料金、介助料、待機料、実費は、事前確定運賃とは区分して表示・精算します。</li>" +
            "</ul>" +
          "</div>" +
          "<div class='record-box'>" +
            "<h2>保存記録の説明</h2>" +
            "<ul>" +
              "<li>予約時は、選択された走行予定ルート、主要経由地点、運賃額、同意日時、スナップショットハッシュを保存します。</li>" +
              "<li>運行時は、運行開始時刻、ルート変更ログ、追加介助料、実費、精算額、領収書・レシート情報を保存します。</li>" +
              "<li>予約ID・見積番号・運行記録を紐づけ、同意内容と実際の運行・精算内容を後から照合できる設計です。</li>" +
            "</ul>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "onepage-pdf-render-shell";
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
      ".onepage-pdf-root,.onepage-pdf-root *{box-sizing:border-box;}" +
      ".onepage-pdf-root{width:" + SHEET_WIDTH_PX + "px;max-width:" + SHEET_WIDTH_PX + "px;margin:0;padding:0;background:#ffffff;color:#1f2937;font-family:'Yu Gothic','Meiryo',sans-serif;}" +
      ".onepage-sheet{width:" + SHEET_WIDTH_PX + "px;max-width:" + SHEET_WIDTH_PX + "px;min-height:790px;padding:28px 36px;margin:0;background:#ffffff;overflow:visible;position:relative;left:0;top:0;}" +
      ".onepage-sheet.page-2{page-break-before:always;break-before:page;}" +
      ".onepage-sheet h1{font-size:20px;margin:0 0 4px;color:#1b3a6b;line-height:1.3;overflow-wrap:anywhere;word-break:break-word;}" +
      ".onepage-sheet .subtitle{font-size:12px;margin:0;color:#334155;font-weight:600;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
      ".onepage-sheet .meta{font-size:11px;margin:0;color:#64748b;white-space:normal;}" +
      ".header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #1b3a6b;}" +
      ".overview{margin:0 0 12px;padding:10px 12px;background:#f3f8fc;border:1px solid #2f6fad;border-left:5px solid #2f6fad;color:#16324f;font-size:11.5px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
      ".flow-box{margin:0 0 12px;padding:10px 12px;background:#f3faf6;border:1px solid #2f8f6b;}" +
      ".flow-title{font-size:12px;font-weight:700;color:#1b3a6b;margin:0 0 8px;}" +
      ".flow-steps{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}" +
      ".flow-step{display:inline-block;padding:6px 10px;background:#ffffff;border:1px solid #2f8f6b;border-radius:3px;color:#14532d;font-size:11px;font-weight:700;white-space:normal;overflow-wrap:anywhere;word-break:break-word;}" +
      ".flow-arrow{color:#2f8f6b;font-weight:700;}" +
      ".section-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;}" +
      ".section-card{grid-column:span 3;border:1px solid #cbd5e1;border-radius:3px;padding:8px;background:#ffffff;min-width:0;overflow:visible;}" +
      ".section-card:nth-child(n+5){grid-column:span 4;}" +
      ".section-card.tone-important{background:#f7fbfe;border-color:#7eb3d9;}" +
      ".section-card.tone-caution{background:#fff8f0;border-color:#e0a86a;}" +
      ".section-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #dbe3ef;}" +
      ".section-num{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#1b3a6b;color:#ffffff;font-size:10px;font-weight:700;flex:0 0 auto;}" +
      ".tone-caution .section-num{background:#c56a1a;}" +
      ".section-title{font-size:11.5px;font-weight:700;color:#1b3a6b;overflow-wrap:anywhere;word-break:break-word;}" +
      ".tone-caution .section-title{color:#9a4d0f;}" +
      ".section-card ul{margin:0;padding:0 0 0 14px;}" +
      ".section-card li{margin:0 0 4px;font-size:10.5px;line-height:1.4;color:#1f2937;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +

      ".table-wrap{margin:0 0 16px;}" +
      ".table-wrap h2,.note-box h2,.record-box h2{font-size:14px;margin:0 0 8px;color:#1b3a6b;}" +
      ".table-wrap table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;}" +
      ".table-wrap th,.table-wrap td{border:1px solid #c9d4e3;padding:8px;vertical-align:top;font-size:11px;line-height:1.4;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
      ".table-wrap th{background:#e8eef7;color:#1b3a6b;font-weight:700;}" +
      ".table-wrap td.row-label{font-weight:700;}" +
      ".table-wrap td.row-0{background:#fff8f0;color:#9a4d0f;}" +
      ".table-wrap td.row-1{background:#f3f8fc;color:#1b4f86;}" +
      ".table-wrap td.row-2{background:#f3faf6;color:#166534;}" +
      ".note-box,.record-box{margin:0 0 14px;padding:12px 14px;border-radius:3px;}" +
      ".note-box{background:#fff8f0;border:1px solid #e0a86a;border-left:5px solid #c56a1a;}" +
      ".record-box{background:#f3f8fc;border:1px solid #7eb3d9;border-left:5px solid #2f6fad;}" +
      ".note-box ul,.record-box ul{margin:0;padding:0 0 0 18px;}" +
      ".note-box li,.record-box li{margin:0 0 6px;font-size:11.5px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;white-space:normal;}" +
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
      console.warn("[PreFixedFareOnePageSummaryPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  function assertLayoutSafe(root){
    if(!root){
      throw new Error("事前確定運賃 認可説明1枚資料PDFの生成対象要素が作成できませんでした。");
    }
    const text = String(root.innerText || "");
    if(!text.includes("見積入力")){
      throw new Error("運用フロー先頭「見積入力」がDOM内にありません。");
    }
    if(text.includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }

    const sheets = root.querySelectorAll(".onepage-sheet");
    if(!sheets.length){
      throw new Error("1枚資料PDFのシート要素がありません。");
    }

    sheets.forEach(function(sheet){
      if(sheet.scrollWidth > sheet.clientWidth + 2){
        throw new Error("1枚資料PDFの横幅が用紙幅を超えています（左端・右端欠け防止）。");
      }
      const sheetLeft = sheet.getBoundingClientRect().left;
      const children = sheet.querySelectorAll("h1, .overview, .flow-box, .flow-step, .section-card, table, .note-box, .record-box");
      for(let i = 0; i < children.length; i += 1){
        const childLeft = children[i].getBoundingClientRect().left;
        if(childLeft < sheetLeft - 1){
          throw new Error("1枚資料PDFの左端要素がシート外にはみ出しています。");
        }
      }
    });
  }

  async function savePdf(reportData){
    if(JSON.stringify(reportData).includes("認可ルート")){
      throw new Error("資料内に禁止表現「認可ルート」が含まれています。");
    }
    if(!(reportData.flowSteps || []).includes("見積入力")){
      throw new Error("運用フロー先頭「見積入力」がデータにありません。");
    }

    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const root = wrapper.querySelector(".onepage-pdf-root");

    try{
      await waitForRenderReady();
      assertLayoutSafe(root);

      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: PDF_FILENAME,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: SHEET_WIDTH_PX
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(root).save();
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
    SHEET_WIDTH_PX: SHEET_WIDTH_PX,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareOnePageSummaryPdf: generatePreFixedFareOnePageSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
