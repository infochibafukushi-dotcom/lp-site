(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-operations-summary.pdf";

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
        ["LP URL", meta.targetUrl || ""],
        ["メーターアプリ URL", meta.meterAppUrl || ""],
        ["資料区分", meta.positioning || ""],
        ["作成日", meta.createdAt || ""],
        ["作成元", meta.createdBy || ""]
      ],
      { className: "table-meta", colWidths: ["28%", "72%"] }
    );
  }

  function buildReportHtml(data){
    const arch = data.productionArchitecture || {};
    const archRows = (arch.components || []).map(function(row){
      return [row.component, row.role, row.path];
    });
    const tokenSec = data.tokenSecurity || {};
    const integrity = data.integrityChecks || {};
    const integrityRows = (integrity.checks || []).map(function(row){
      return [row.name, row.description];
    });
    const caseRecordRows = (data.caseRecordsFields || []).map(function(row){
      return [row.field, row.description];
    });
    const meterRuns = data.meterFixedFareRuns || {};
    const startRows = (meterRuns.startRecord || []).map(function(row){
      return [row.field, row.description];
    });
    const completeRows = (meterRuns.completeRecord || []).map(function(row){
      return [row.field, row.description];
    });
    const receipt = data.receiptDisplay || {};
    const e2e = data.e2eEvidence || {};
    const e2eCases = e2e.cases || [];
    const e2eCheckRows = (e2e.checks || []).map(function(row){
      return [row.item, row.result];
    });
    const pct = data.passengerChangeTermination || {};
    const basicOp = pct.basicOperation || {};
    const audit = pct.auditTrail || {};
    const caseRecordAuditRows = (audit.caseRecords || []).map(function(row){
      return [row.field, row.value];
    });
    const reservationAuditRows = (audit.reservationV4 || []).map(function(row){
      return [row.field, row.value];
    });
    const normalAuditRows = (audit.normalCompletion || []).map(function(row){
      return [row.field, row.value];
    });
    const comparison = pct.completionComparison || {};
    const normalCompRows = (comparison.normal?.rows || []).map(function(row){
      return [row.field, row.value];
    });
    const passengerCompRows = (comparison.passengerChange?.rows || []).map(function(row){
      return [row.field, row.value];
    });
    const e2eCaseTables = e2eCases.map(function(caseItem){
      return (
        "<h3>" + escapeHtml(caseItem.label || "") + "（予約ID " + escapeHtml(caseItem.reservationId || "") + "）</h3>" +
        buildTable(
          ["項目", "値"],
          [
            ["予約ID", caseItem.reservationId || ""],
            ["日時", caseItem.datetime || ""],
            ["利用者", caseItem.userName || ""],
            ["見積番号", caseItem.estimateNo || ""],
            ["確定運賃", caseItem.confirmedFare || ""],
            ["表示ラベル", caseItem.displayLabel || ""]
          ],
          { className: "table-e2e-meta", colWidths: ["28%", "72%"] }
        )
      );
    }).join("");

    return (
      "<div class='pre-fixed-fare-operations-summary'>" +
      "<h1>" + escapeHtml(data.title || "") + "</h1>" +
      "<p class='subtitle'>" + escapeHtml(data.meta?.subtitle || "") + "</p>" +
      section("1. 事前確定運賃Mの概要",
        buildMetaTable({
          title: data.title,
          subtitle: data.meta?.subtitle,
          targetSystem: data.meta?.targetSystem,
          purpose: data.meta?.purpose,
          targetUrl: data.meta?.targetUrl,
          meterAppUrl: data.meta?.meterAppUrl,
          positioning: data.meta?.positioning,
          createdAt: data.meta?.createdAt,
          createdBy: data.meta?.createdBy
        }) +
        "<p>" + escapeHtml(data.overviewNote || "") + "</p>" +
        buildList(data.overviewPoints)
      ) +
      section("2. LP見積 → 同意 → reservation-v4保存 → メーターアプリ読取 → 運行 → 精算 → 領収書 → 完了の流れ",
        buildList(data.endToEndFlow)
      ) +
      section("3. GitHub Pages → driver-proxy → reservation-v4 → Firebase / caseRecords の本番構成",
        buildList(arch.intro) +
        "<h3>構成要素</h3>" +
        buildTable(
          ["コンポーネント", "役割", "配置"],
          archRows,
          { className: "table-architecture", colWidths: ["30%", "42%", "28%"] }
        ) +
        "<h3>データフロー</h3>" + buildList(arch.flowDiagram)
      ) +
      section("4. METER_DRIVER_TOKENをフロント・GitHub・distに含めない設計",
        buildList(tokenSec.intro) +
        "<h3>設計方針</h3>" + buildList(tokenSec.designPoints) +
        "<h3>注意事項</h3>" + buildList(tokenSec.caveats)
      ) +
      section("5. snapshotHashVerified / confirmedFareMatchesSnapshot / 同意スナップショットによる整合性確認",
        buildList(integrity.intro) +
        "<h3>検証項目</h3>" +
        buildTable(
          ["検証名", "説明"],
          integrityRows,
          { className: "table-integrity", colWidths: ["32%", "68%"] }
        ) +
        "<h3>検証フロー</h3>" + buildList(integrity.verificationFlow) +
        (integrity.tamperProtectionNote
          ? "<h3>改ざん防止の位置づけ</h3><p>" + escapeHtml(integrity.tamperProtectionNote) + "</p>"
          : "")
      ) +
      section("6. caseRecords保存項目",
        buildTable(
          ["フィールド", "説明"],
          caseRecordRows,
          { className: "table-case-records", colWidths: ["30%", "70%"] }
        )
      ) +
      section("7. meter_fixed_fare_runs による start / complete 記録",
        buildList(meterRuns.intro) +
        "<h3>start-fixed-fare 記録項目</h3>" +
        buildTable(
          ["フィールド", "説明"],
          startRows,
          { className: "table-meter-start", colWidths: ["30%", "70%"] }
        ) +
        "<h3>complete-fixed-fare 記録項目</h3>" +
        buildTable(
          ["フィールド", "説明"],
          completeRows,
          { className: "table-meter-complete", colWidths: ["30%", "70%"] }
        ) +
        "<h3>運用メモ</h3>" + buildList(meterRuns.notes)
      ) +
      section("8. 領収書に「事前確定運賃」と表示すること",
        buildList(receipt.intro) +
        "<h3>表示ルール</h3>" + buildList(receipt.rules) +
        "<h3>表示例</h3><p><strong>" + escapeHtml(receipt.example || "") + "</strong></p>"
      ) +
      section("9. 本番相当環境E2E確認結果",
        e2eCaseTables +
        "<h3>確認結果</h3>" +
        buildTable(
          ["確認項目", "結果"],
          e2eCheckRows,
          { className: "table-e2e-checks", colWidths: ["72%", "28%"] }
        )
      ) +
      (function(){
        const e2eCases = data.e2eTestCases || {};
        if(!e2eCases.rows || !e2eCases.rows.length) return "";
        return section("9-2. " + (e2eCases.title || "本番相当環境E2Eテストケース表"),
          (e2eCases.note ? "<p>" + escapeHtml(e2eCases.note) + "</p>" : "") +
          buildTable(
            e2eCases.headers || ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
            e2eCases.rows || [],
            { className: "table-e2e-cases", colWidths: ["10%", "22%", "30%", "10%", "28%"] }
          )
        );
      })() +
      (function(){
        const tamper = data.tamperProtection || {};
        if(!tamper.paragraphs || !tamper.paragraphs.length) return "";
        return section("9-3. " + (tamper.title || "改ざん防止及びスナップショットハッシュの取扱い"),
          tamper.paragraphs.map(function(paragraph){
            return "<p>" + escapeHtml(paragraph) + "</p>";
          }).join("") +
          (tamper.terminologyNote
            ? "<p><strong>用語の位置づけ：</strong>" + escapeHtml(tamper.terminologyNote) + "</p>"
            : "")
        );
      })() +
      section("10. 旅客都合変更時の基本運用",
        buildList(basicOp.intro) +
        "<h3>途中終了のトリガー</h3>" + buildList(basicOp.triggers)
      ) +
      section("11. 金額の扱い",
        buildList(pct.fareHandling)
      ) +
      section("12. メーターアプリ上の操作導線",
        buildList(pct.meterAppFlow)
      ) +
      section("13. 保存される監査証跡",
        "<h3>caseRecords 側</h3>" +
        buildTable(
          ["フィールド", "値"],
          caseRecordAuditRows,
          { className: "table-audit-case", colWidths: ["38%", "62%"] }
        ) +
        "<h3>reservation-v4 / D1 側（旅客都合途中終了）</h3>" +
        buildTable(
          ["フィールド", "値"],
          reservationAuditRows,
          { className: "table-audit-reservation", colWidths: ["38%", "62%"] }
        ) +
        "<h3>通常完了の場合</h3>" +
        buildTable(
          ["フィールド", "値"],
          normalAuditRows,
          { className: "table-audit-normal", colWidths: ["38%", "62%"] }
        )
      ) +
      section("14. 通常完了との判別方法",
        "<h3>" + escapeHtml(comparison.normal?.label || "通常完了") + "</h3>" +
        buildTable(
          ["フィールド", "値"],
          normalCompRows,
          { className: "table-comparison-normal", colWidths: ["38%", "62%"] }
        ) +
        "<h3>" + escapeHtml(comparison.passengerChange?.label || "旅客都合途中終了") + "</h3>" +
        buildTable(
          ["フィールド", "値"],
          passengerCompRows,
          { className: "table-comparison-passenger", colWidths: ["38%", "62%"] }
        )
      ) +
      section("15. 予約詳細・管理画面の表示",
        "<h3>旅客都合途中終了時の表示項目</h3>" +
        buildList(pct.adminDisplay?.passengerChangeItems) +
        "<h3>通常完了時</h3><p>" + escapeHtml(pct.adminDisplay?.normalNote || "") + "</p>"
      ) +
      section("16. 運用開始前の目視確認項目",
        "<p>" + escapeHtml(pct.verifiedNote || "") + "</p>" +
        buildList(pct.preLaunchChecks)
      ) +
      section("17. 今後対応予定", buildList(data.futurePlans)) +
      "<p class='footer-note'>" + escapeHtml(data.footerNote || "") + "</p>" +
      "</div>"
    );
  }

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-operations-summary-render-shell";
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
      ".pre-fixed-fare-operations-summary,.pre-fixed-fare-operations-summary *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111111;}" +
      ".pre-fixed-fare-operations-summary{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:720px;background:#ffffff;color:#111111;line-height:1.45;font-size:10.5px;padding:4px 0 0;margin:0;}" +
      ".pre-fixed-fare-operations-summary h1{font-size:19px;margin:0 0 4px;color:#111111;line-height:1.3;}" +
      ".pre-fixed-fare-operations-summary .subtitle{font-size:11px;margin:0 0 8px;color:#444;}" +
      ".pre-fixed-fare-operations-summary h2{font-size:13.5px;margin:14px 0 6px;padding-bottom:2px;border-bottom:1px solid #ccc;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-operations-summary h3{font-size:11.5px;margin:8px 0 5px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-operations-summary p{margin:0 0 6px;color:#111111;}" +
      ".pre-fixed-fare-operations-summary ul,.pre-fixed-fare-operations-summary ol{margin:0 0 6px 16px;padding:0;}" +
      ".pre-fixed-fare-operations-summary li{margin:0 0 3px;color:#111111;}" +
      ".pre-fixed-fare-operations-summary table{width:100%;border-collapse:collapse;table-layout:fixed;margin:5px 0 8px;background:#ffffff;}" +
      ".pre-fixed-fare-operations-summary th,.pre-fixed-fare-operations-summary td{border:1px solid #d9d9d9;padding:5px 6px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;color:#111111;background:#ffffff;box-sizing:border-box;font-size:9.5px;line-height:1.4;}" +
      ".pre-fixed-fare-operations-summary th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-operations-summary section{break-inside:auto;page-break-inside:auto;margin:0 0 10px;}" +
      ".pre-fixed-fare-operations-summary .report-section-title-block{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-operations-summary .report-section-body{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-operations-summary tr{break-inside:auto;page-break-inside:auto;}" +
      ".pre-fixed-fare-operations-summary .table-meta tr,.pre-fixed-fare-operations-summary .table-e2e-meta tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-operations-summary .footer-note{margin-top:12px;font-size:9.5px;color:#444;}" +
      "</style>" +
      reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("事前確定運賃M 運用・監査説明資料PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("事前確定運賃M 運用・監査説明資料PDFの生成対象HTMLが空です。");
    }
  }

  async function waitForRenderReady(){
    try{
      if(document.fonts && typeof document.fonts.ready?.then === "function"){
        await document.fonts.ready;
      }
    }catch(error){
      console.warn("[PreFixedFareOperationsSummaryPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-operations-summary");

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

  async function generatePreFixedFareOperationsSummaryPdf(){
    if(!global.PreFixedFareOperationsSummaryData){
      throw new Error("事前確定運賃M 運用・監査説明資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareOperationsSummaryData.buildReportData();
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("事前確定運賃M 運用・監査説明資料データの組み立てに失敗しました。");
    }
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareOperationsSummaryPdf = {
    PDF_FILENAME: PDF_FILENAME,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareOperationsSummaryPdf: generatePreFixedFareOperationsSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
