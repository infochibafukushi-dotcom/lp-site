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
    return "<div class='table-wrap'><table" + (className ? " class='" + escapeHtml(className) + "'" : "") + ">" + colgroup + "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function section(title, bodyHtml){
    return (
      "<section class='subsection-block section-title-with-body'>" +
      "<h2>" + escapeHtml(title) + "</h2>" +
      bodyHtml +
      "</section>"
    );
  }

  function smallSection(title, bodyHtml){
    return (
      "<section class='small-section'>" +
      "<h3>" + escapeHtml(title) + "</h3>" +
      bodyHtml +
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
      return smallSection(
        (caseItem.label || "") + "（予約ID " + (caseItem.reservationId || "") + "）",
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
        smallSection("構成要素",
          buildTable(
            ["コンポーネント", "役割", "配置"],
            archRows,
            { className: "table-architecture", colWidths: ["30%", "42%", "28%"] }
          )
        ) +
        smallSection("データフロー", buildList(arch.flowDiagram))
      ) +
      section("4. METER_DRIVER_TOKENをフロント・GitHub・distに含めない設計",
        buildList(tokenSec.intro) +
        smallSection("設計方針", buildList(tokenSec.designPoints)) +
        smallSection("注意事項", buildList(tokenSec.caveats))
      ) +
      section("5. snapshotHashVerified / confirmedFareMatchesSnapshot / 同意スナップショットによる整合性確認",
        buildList(integrity.intro) +
        smallSection("検証項目",
          buildTable(
            ["検証名", "説明"],
            integrityRows,
            { className: "table-integrity", colWidths: ["32%", "68%"] }
          )
        ) +
        smallSection("検証フロー", buildList(integrity.verificationFlow)) +
        (integrity.tamperProtectionNote
          ? smallSection("改ざん防止の位置づけ", "<p>" + escapeHtml(integrity.tamperProtectionNote) + "</p>")
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
        smallSection("start-fixed-fare 記録項目",
          buildTable(
            ["フィールド", "説明"],
            startRows,
            { className: "table-meter-start", colWidths: ["30%", "70%"] }
          )
        ) +
        smallSection("complete-fixed-fare 記録項目",
          buildTable(
            ["フィールド", "説明"],
            completeRows,
            { className: "table-meter-complete", colWidths: ["30%", "70%"] }
          )
        ) +
        smallSection("運用メモ", buildList(meterRuns.notes))
      ) +
      section("8. 領収書に「事前確定運賃」と表示すること",
        buildList(receipt.intro) +
        smallSection("表示ルール", buildList(receipt.rules)) +
        smallSection("表示例", "<p><strong>" + escapeHtml(receipt.example || "") + "</strong></p>")
      ) +
      section("9. 本番相当環境E2E確認結果",
        e2eCaseTables +
        smallSection("確認結果",
          buildTable(
            ["確認項目", "結果"],
            e2eCheckRows,
            { className: "table-e2e-checks", colWidths: ["72%", "28%"] }
          )
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
        smallSection("途中終了のトリガー", buildList(basicOp.triggers))
      ) +
      section("11. 金額の扱い",
        buildList(pct.fareHandling)
      ) +
      section("12. メーターアプリ上の操作導線",
        buildList(pct.meterAppFlow)
      ) +
      section("13. 保存される監査証跡",
        smallSection("caseRecords 側",
          buildTable(
            ["フィールド", "値"],
            caseRecordAuditRows,
            { className: "table-audit-case", colWidths: ["38%", "62%"] }
          )
        ) +
        smallSection("reservation-v4 / D1 側（旅客都合途中終了）",
          buildTable(
            ["フィールド", "値"],
            reservationAuditRows,
            { className: "table-audit-reservation", colWidths: ["38%", "62%"] }
          )
        ) +
        smallSection("通常完了の場合",
          buildTable(
            ["フィールド", "値"],
            normalAuditRows,
            { className: "table-audit-normal", colWidths: ["38%", "62%"] }
          )
        )
      ) +
      section("14. 通常完了との判別方法",
        smallSection(comparison.normal?.label || "通常完了",
          buildTable(
            ["フィールド", "値"],
            normalCompRows,
            { className: "table-comparison-normal", colWidths: ["38%", "62%"] }
          )
        ) +
        smallSection(comparison.passengerChange?.label || "旅客都合途中終了",
          buildTable(
            ["フィールド", "値"],
            passengerCompRows,
            { className: "table-comparison-passenger", colWidths: ["38%", "62%"] }
          )
        )
      ) +
      section("15. 予約詳細・管理画面の表示",
        smallSection("旅客都合途中終了時の表示項目", buildList(pct.adminDisplay?.passengerChangeItems)) +
        smallSection("通常完了時", "<p>" + escapeHtml(pct.adminDisplay?.normalNote || "") + "</p>")
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

  function getReportCss(){
    if(!global.PreFixedFarePrintLayoutCss){
      throw new Error("印刷用レイアウトCSSモジュールが読み込まれていません。");
    }
    const scope = ".pre-fixed-fare-operations-summary";
    return (
      global.PreFixedFarePrintLayoutCss.getCorePrintCss(scope) +
      scope + "{visibility:visible;opacity:1;position:relative;top:0;left:0;padding:0;}" +
      scope + " h2{padding-bottom:2mm;border-bottom:1px solid #ccc;}" +
      scope + " .footer-note{margin-top:8mm;}"
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
      "<style>" + getReportCss() + "</style>" +
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
        margin: global.PreFixedFarePrintLayoutCss.HTML2PDF_MARGIN_MM,
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
    getReportCss: getReportCss,
    buildReportHtml: buildReportHtml,
    savePdf: savePdf,
    generatePreFixedFareOperationsSummaryPdf: generatePreFixedFareOperationsSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
