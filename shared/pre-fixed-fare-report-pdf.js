(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildList(items){
    const list = Array.isArray(items) ? items : [];
    if(!list.length) return "<p>未確認</p>";
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

  function buildMetaTable(meta){
    return buildTable(
      ["項目", "内容"],
      [
        ["資料名", meta.title || ""],
        ["事業者名", meta.businessName || "未設定"],
        ["屋号", meta.tradeName || "未設定"],
        ["営業区域", meta.operatingArea || "未設定"],
        ["対象システム名", meta.systemName || ""],
        ["作成日", meta.createdAt || ""],
        ["システムバージョン", meta.systemVersion || ""],
        ["料金設定バージョン", meta.estimateConfigVersion || "未設定"],
        ["作成元", meta.createdBy || "LP管理画面"]
      ],
      { className: "table-meta", colWidths: ["34%", "66%"] }
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

  function section(title, bodyHtml){
    return (
      "<section>" +
      "<div class='report-section-title-block'><h2>" + escapeHtml(title) + "</h2></div>" +
      "<div class='report-section-body'>" + bodyHtml + "</div>" +
      "</section>"
    );
  }

  function buildReportHtml(data){
    const mapRows = (data.mapAndRouteRows || []).map(function(row){
      return [row.item, row.status, row.basis];
    });
    const multiRouteRows = (data.multiRouteRows || []).map(function(row){
      return [row.item, row.status, row.basis];
    });
    const tollRows = (data.tollRows || []).map(function(row){
      return [row.item, row.status, row.basis];
    });
    const requirementRows = (data.requirementRows || []).map(function(row){
      return [row.requirement, row.policy, row.current, row.evidence];
    });
    const coefficientRows = (data.coefficientRows || []).map(function(row){
      return [row.area, numberLabel(row.coefficient), row.basis, row.appliedAt];
    });
    const fareFeeRows = (data.fareAndFeeRows || []).map(function(row){
      return [row.category, row.include, row.handling];
    });

    return (
      "<div class='pre-fixed-fare-report'>" +
      "<h1>" + escapeHtml(data.title || "") + "</h1>" +
      section("1. 表紙", buildMetaTable({
        title: data.title,
        businessName: data.meta?.businessName,
        tradeName: data.meta?.tradeName,
        operatingArea: data.meta?.operatingArea,
        systemName: data.meta?.systemName,
        createdAt: data.meta?.createdAt,
        systemVersion: data.meta?.systemVersion,
        estimateConfigVersion: data.meta?.estimateConfigVersion,
        createdBy: data.meta?.createdBy
      })) +
      section("2. 本資料の目的", buildList(data.purpose)) +
      section("3. 公示根拠", buildList(data.notices?.basis)) +
      section("4. 事前確定運賃の算定式",
        buildList(data.notices?.formulas) +
        "<p><strong>" + escapeHtml(data.notices?.formulaText || "") + "</strong></p>"
      ) +
      section("5. 千葉県の平準化係数",
        buildTable(
          ["営業区域", "係数", "根拠", "適用日"],
          coefficientRows,
          { className: "table-coefficients", colWidths: ["20%", "12%", "38%", "30%"] }
        ) +
        "<p>" + escapeHtml(data.coefficientPolicy || "") + "</p>"
      ) +
      section("6. 運賃と各種料金の区分",
        buildTable(
          ["区分", "事前確定運賃に含めるか", "扱い"],
          fareFeeRows,
          { className: "table-fare-fees", colWidths: ["34%", "20%", "46%"] }
        )
      ) +
      section("7. 電子地図・ルート算定",
        buildList(data.mapAndRouteDesign) +
        buildTable(
          ["項目", "状況", "根拠"],
          mapRows,
          { className: "table-map-route", colWidths: ["25%", "15%", "60%"] }
        )
      ) +
      section("8. 複数ルート選択",
        "<p>旅客が2以上の走行予定ルートから1つを選択できる必要がある。選択ルートの距離で事前確定運賃を算定し、利用者・運転者・管理者に同一内容を表示する必要がある。</p>" +
        buildTable(
          ["項目", "状況", "根拠"],
          multiRouteRows,
          { className: "table-multi-route", colWidths: ["25%", "15%", "60%"] }
        )
      ) +
      section("9. 有料道路利用有無の選択",
        "<p>旅客が予約時または配車依頼時に有料道路利用有無を選択し、選択結果に基づいて算定する。通行料は運賃とは区分して扱う。</p>" +
        buildTable(
          ["項目", "状況", "根拠"],
          tollRows,
          { className: "table-toll", colWidths: ["25%", "15%", "60%"] }
        )
      ) +
      section("10. 利用者への提示と同意",
        "<h3>提示・同意要件</h3>" + buildList(data.userNoticeItems) +
        "<h3>同意前注意事項</h3>" + buildList(data.cautionBeforeConsent)
      ) +
      section("11. quoteSnapshot・証跡保存",
        "<h3>現在確認できる項目</h3>" + buildList(data.snapshotConfirmed) +
        "<h3 class='warn'>未確認・追加確認が必要な項目</h3>" + buildList(data.snapshotUnconfirmed)
      ) +
      section("12. 見積番号・予約番号・状態管理",
        "<h3>必要状態</h3>" + buildList(data.stateManagement?.requiredStates) +
        "<h3>必要項目</h3>" + buildList(data.stateManagement?.requiredItems) +
        "<p class='warn'>" + escapeHtml(data.stateManagement?.note || "") + "</p>"
      ) +
      section("13. 予約後の固定表示", buildList(data.fixedAfterReservation)) +
      section("14. 公示要件対応表",
        buildTable(
          ["公示要件", "システム対応方針", "現状", "根拠ファイル / 保存項目"],
          requirementRows,
          { className: "table-requirements", colWidths: ["25%", "30%", "15%", "30%"] }
        )
      ) +
      section("15. 未実装・未確認事項",
        "<p class='warn'>以下は未実装または未確認として明示する。</p>" + buildList(data.unimplementedOrUnconfirmed)
      ) +
      section("16. 今後の実装優先順位",
        "<ol>" + (data.priorities || []).map(function(item){
          return "<li>" + escapeHtml(item) + "</li>";
        }).join("") + "</ol>"
      ) +
      "</div>"
    );
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("認可説明資料PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("認可説明資料PDFの生成対象HTMLが空です。");
    }
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-report-render-shell";
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
      ".pre-fixed-fare-report,.pre-fixed-fare-report *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111111;}" +
      ".pre-fixed-fare-report{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:720px;background:#ffffff;color:#111111;line-height:1.45;font-size:10.5px;padding:4px 0 0;margin:0;}" +
      ".pre-fixed-fare-report h1{font-size:19px;margin:0 0 8px;color:#111111;line-height:1.3;}" +
      ".pre-fixed-fare-report h2{font-size:13.5px;margin:14px 0 6px;padding-bottom:2px;border-bottom:1px solid #ccc;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-report h3{font-size:11.5px;margin:8px 0 5px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-report p{margin:0 0 6px;color:#111111;}" +
      ".pre-fixed-fare-report ul,.pre-fixed-fare-report ol{margin:0 0 6px 16px;padding:0;}" +
      ".pre-fixed-fare-report li{margin:0 0 3px;color:#111111;}" +
      ".pre-fixed-fare-report table{width:100%;border-collapse:collapse;table-layout:fixed;margin:5px 0 8px;background:#ffffff;}" +
      ".pre-fixed-fare-report th,.pre-fixed-fare-report td{border:1px solid #d9d9d9;padding:5px 6px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;color:#111111;background:#ffffff;box-sizing:border-box;font-size:9.5px;line-height:1.4;}" +
      ".pre-fixed-fare-report th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-report section{break-inside:auto;page-break-inside:auto;margin:0 0 10px;}" +
      ".pre-fixed-fare-report .report-section-title-block{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-report .report-section-body{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-report tr{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-report .table-meta tr,.pre-fixed-fare-report .table-coefficients tr,.pre-fixed-fare-report .table-fare-fees tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-report .table-requirements td,.pre-fixed-fare-report .table-requirements th{font-size:9px;}" +
      ".pre-fixed-fare-report .warn{color:#8a1f1f;font-weight:700;}" +
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
      console.warn("[PreFixedFareReportPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  function numberLabel(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-report");

    ensureRenderableContent(reportElement);
    await waitForRenderReady();

    console.log("[PreFixedFareReportPdf] report element exists:", Boolean(reportElement));
    const sectionTitles = Array.from(reportElement?.querySelectorAll("h2") || []).map(function(el){
      return String(el.textContent || "").trim();
    });
    console.log("[PreFixedFareReportPdf] section count:", sectionTitles.length);
    console.log("[PreFixedFareReportPdf] section titles:", sectionTitles);
    console.log("[PreFixedFareReportPdf] innerText length:", String(reportElement?.innerText || "").trim().length);
    console.log("[PreFixedFareReportPdf] has section 15:", String(reportElement?.innerText || "").includes("15. 未実装・未確認事項"));
    console.log("[PreFixedFareReportPdf] has section 16:", String(reportElement?.innerText || "").includes("16. 今後の実装優先順位"));
    console.log("[PreFixedFareReportPdf] offsetWidth:", Number(reportElement?.offsetWidth) || 0);
    console.log("[PreFixedFareReportPdf] offsetHeight:", Number(reportElement?.offsetHeight) || 0);
    console.log("[PreFixedFareReportPdf] html2pdf loaded:", typeof html2pdf !== "undefined");

    try{
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: "pre-fixed-fare-regulatory-report.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(reportElement).save();
    }finally{
      wrapper.remove();
    }
  }

  global.PreFixedFareReportPdf = {
    savePdf: savePdf
  };
})(typeof window !== "undefined" ? window : globalThis);
