(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-integrated-summary.pdf";

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
    return "<table" + (className ? " class='" + escapeHtml(className) + " table-avoid-break'" : " class='table-avoid-break'") + ">" + colgroup + "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function buildSplitTables(headers, rows, options){
    const list = Array.isArray(rows) ? rows : [];
    const maxRows = Number(options?.maxRowsPerTable) || 0;
    if(!maxRows || list.length <= maxRows){
      return buildTable(headers, list, options);
    }
    const chunks = [];
    for(let index = 0; index < list.length; index += maxRows){
      chunks.push(buildTable(headers, list.slice(index, index + maxRows), options));
    }
    return "<div class='table-group'>" + chunks.join("") + "</div>";
  }

  function subsection(title, bodyHtml){
    return (
      "<div class='subsection-block'>" +
      "<h3>" + escapeHtml(title) + "</h3>" +
      "<div class='subsection-content'>" + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function numberLabel(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  function buildCover(meta, title){
    return (
      "<div class='cover-page'>" +
      "<h1 class='cover-title'>" + escapeHtml(title || "") + "</h1>" +
      "<p class='cover-subtitle'>" + escapeHtml(meta.subtitle || "") + "</p>" +
      buildTable(
        ["項目", "内容"],
        [
          ["事業者名", meta.businessName || ""],
          ["対象", meta.target || ""],
          ["作成日", meta.createdAt || ""],
          ["作成元", meta.createdBy || ""],
          ["資料区分", meta.documentType || ""]
        ],
        { className: "table-cover-meta", colWidths: ["28%", "72%"] }
      ) +
      "</div>"
    );
  }

  function buildToc(toc){
    const rows = (toc || []).map(function(item){
      return ["第" + item.chapter + "章", item.title];
    });
    return (
      "<div class='toc-page'>" +
      "<h2 class='toc-heading'>目次</h2>" +
      buildTable(
        ["章", "タイトル"],
        rows,
        { className: "table-toc", colWidths: ["18%", "82%"] }
      ) +
      "</div>"
    );
  }

  function chapterHeader(chapterNum, title, positioning){
    return (
      "<div class='chapter-start'>" +
      "<h2 class='chapter-title'>第" + escapeHtml(chapterNum) + "章　" + escapeHtml(title) + "</h2>" +
      (positioning ? "<p class='chapter-positioning'>" + escapeHtml(positioning) + "</p>" : "") +
      "</div>"
    );
  }

  function chapterBlock(chapterNum, title, positioning, bodyHtml, options){
    options = options || {};
    const classes = ["chapter-block"];
    if(options.first) classes.push("chapter-block-first");
    if(options.last) classes.push("chapter-block-last");
    return (
      "<div class='" + classes.join(" ") + "'>" +
      chapterHeader(chapterNum, title, positioning) +
      "<div class='chapter-body'>" + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function buildChapter1(regulatory){
    const coefficientRows = (regulatory.coefficientRows || []).map(function(row){
      return [row.area, numberLabel(row.coefficient), row.basis, row.appliedAt];
    });
    const fareFeeRows = (regulatory.fareAndFeeRows || []).map(function(row){
      return [row.category, row.include, row.handling];
    });
    const requirementRows = (regulatory.requirementRows || []).map(function(row){
      return [row.requirement, row.policy, row.current, row.evidence];
    });
    const multiRouteRows = (regulatory.multiRouteRows || []).map(function(row){
      return [row.item, row.status, row.basis];
    });

    return (
      subsection("算定式と運賃算定根拠",
        (regulatory.notices?.fareBasisNote ? "<p>" + escapeHtml(regulatory.notices.fareBasisNote) + "</p>" : "") +
        buildList(regulatory.notices?.formulas) +
        "<p><strong>" + escapeHtml(regulatory.notices?.formulaText || "") + "</strong></p>"
      ) +
      subsection("平準化係数",
        "<p>" + escapeHtml(regulatory.coefficientPolicy || "") + "</p>" +
        buildTable(
          ["営業区域", "係数", "根拠", "適用日"],
          coefficientRows,
          { className: "table-coefficients", colWidths: ["20%", "12%", "38%", "30%"] }
        )
      ) +
      subsection("運賃と各種料金の区分",
        "<p>迎車料金・予約料金・介助料等は事前確定運賃とは区分し、見積明細上も別行で表示する。</p>" +
        buildTable(
          ["区分", "事前確定運賃に含めるか", "扱い"],
          fareFeeRows,
          { className: "table-fare-fees", colWidths: ["34%", "20%", "46%"] }
        )
      ) +
      subsection("電子地図ルート算定", buildList(regulatory.mapAndRouteDesign)) +
      subsection("2以上のルート選択",
        buildSplitTables(
          ["項目", "状況", "根拠"],
          multiRouteRows,
          { className: "table-multi-route", colWidths: ["24%", "16%", "60%"], maxRowsPerTable: 4 }
        )
      ) +
      subsection("利用者への提示と同意",
        buildList(regulatory.userNoticeItems) +
        "<h4>同意前注意事項</h4>" + buildList(regulatory.cautionBeforeConsent)
      ) +
      subsection("quoteSnapshot・証跡保存",
        "<h4>確認できる項目</h4>" + buildList(regulatory.snapshotConfirmed) +
        "<h4>追加確認が必要な項目</h4>" + buildList(regulatory.snapshotUnconfirmed)
      ) +
      subsection("公示要件対応表",
        buildSplitTables(
          ["公示要件", "システム対応方針", "現状", "根拠"],
          requirementRows,
          { className: "table-requirements", colWidths: ["24%", "30%", "14%", "32%"], maxRowsPerTable: 4 }
        )
      )
    );
  }

  function buildChapter2(approval){
    const judgmentRows = (approval.judgmentRows || []).map(function(row){
      return [row.condition, row.system, row.reservationUrl, row.button, row.handling];
    });
    const snapshotRows = (approval.snapshotFields || []).map(function(row){
      return [row.field, row.description];
    });
    const phase3Rows = (approval.phase3EvidenceRows || []).map(function(row){
      return [row.caseName, row.content, row.pdf, row.quoteSnapshot, row.handoff];
    });
    const phase2Rows = (approval.phase2EvidenceRows || []).map(function(row){
      return [row.caseName, row.content, row.files];
    });
    const routeTypes = (approval.routeCandidateTypes || []).map(function(row){
      return "<p><strong>" + escapeHtml(row.name) + "</strong>：" + escapeHtml(row.description) + "</p>";
    }).join("");

    return (
      subsection("条件入力とシステムフロー", buildList(approval.systemFlow)) +
      subsection("Google Routes API によるルート候補生成", routeTypes + "<p>" + escapeHtml(approval.dedupeNote || "") + "</p>") +
      subsection("判定ロジック（preFixedFareConfirmable）",
        buildTable(
          ["条件", "システム", "予約URL", "ボタン", "扱い"],
          judgmentRows,
          { className: "table-judgment", colWidths: ["22%", "18%", "18%", "18%", "24%"] }
        ) +
        buildList(approval.judgmentNotes)
      ) +
      subsection("候補1件のみの場合の確認対応",
        buildList(approval.singleCandidate?.intro) +
        buildList(approval.singleCandidate?.ui) +
        "<p>" + escapeHtml(approval.singleCandidate?.evidence || "") + "</p>"
      ) +
      subsection("帰り立ち寄りありの全体ルート合成",
        buildList(approval.returnWithStop?.intro) +
        buildList(approval.returnWithStop?.structure) +
        buildList(approval.returnWithStop?.display)
      ) +
      subsection("quoteSnapshot / handoff の保存",
        buildList(approval.snapshotIntro) +
        buildSplitTables(
          ["フィールド", "説明"],
          snapshotRows,
          { className: "table-snapshot", colWidths: ["28%", "72%"], maxRowsPerTable: 6 }
        ) +
        buildList(approval.snapshotFlow)
      ) +
      subsection("Phase 2 / Phase 3-B 証跡ファイル一覧",
        "<h4>Phase 3-B</h4>" +
        buildTable(
          ["ケース", "内容", "PDF", "quoteSnapshot", "handoff"],
          phase3Rows,
          { className: "table-phase3-evidence", colWidths: ["12%", "22%", "18%", "24%", "24%"] }
        ) +
        "<h4>Phase 2</h4>" +
        buildTable(
          ["ケース", "内容", "ファイル"],
          phase2Rows,
          { className: "table-phase2-evidence", colWidths: ["15%", "35%", "50%"] }
        )
      )
    );
  }

  function buildChapter3(operations){
    const arch = operations.productionArchitecture || {};
    const archRows = (arch.components || []).map(function(row){
      return [row.component, row.role, row.path];
    });
    const integrityRows = (operations.integrityChecks?.checks || []).map(function(row){
      return [row.name, row.description];
    });
    const caseRecordRows = (operations.caseRecordsFields || []).map(function(row){
      return [row.field, row.description];
    });
    const startRows = (operations.meterFixedFareRuns?.startRecord || []).map(function(row){
      return [row.field, row.description];
    });
    const completeRows = (operations.meterFixedFareRuns?.completeRecord || []).map(function(row){
      return [row.field, row.description];
    });
    const e2e = operations.e2eEvidence || {};
    const e2eCaseTables = (e2e.cases || []).map(function(caseItem){
      return buildTable(
        ["項目", "内容"],
        [
          ["区分", caseItem.label],
          ["予約ID", caseItem.reservationId],
          ["日時", caseItem.datetime],
          ["利用者", caseItem.userName],
          ["見積番号", caseItem.estimateNo],
          ["確定運賃", caseItem.confirmedFare],
          ["表示", caseItem.displayLabel]
        ],
        { className: "table-e2e-meta", colWidths: ["28%", "72%"] }
      );
    }).join("");

    return (
      subsection("LP見積から完了までの流れ", buildList(operations.endToEndFlow)) +
      subsection("本番構成（GitHub Pages → driver-proxy → reservation-v4）",
        buildList(arch.intro) +
        buildTable(
          ["コンポーネント", "役割", "パス"],
          archRows,
          { className: "table-architecture", colWidths: ["30%", "42%", "28%"] }
        ) +
        buildList(arch.flowDiagram)
      ) +
      subsection("METER_DRIVER_TOKEN をフロントや GitHub dist に含めない設計",
        buildList(operations.tokenSecurity?.intro) +
        buildList(operations.tokenSecurity?.designPoints) +
        buildList(operations.tokenSecurity?.caveats)
      ) +
      subsection("整合性確認（snapshotHashVerified / confirmedFareMatchesSnapshot）",
        buildList(operations.integrityChecks?.intro) +
        buildTable(
          ["検証項目", "説明"],
          integrityRows,
          { className: "table-integrity", colWidths: ["32%", "68%"] }
        ) +
        buildList(operations.integrityChecks?.verificationFlow)
      ) +
      subsection("caseRecords 保存項目",
        buildSplitTables(
          ["フィールド", "説明"],
          caseRecordRows,
          { className: "table-case-records", colWidths: ["28%", "72%"], maxRowsPerTable: 6 }
        )
      ) +
      subsection("meter_fixed_fare_runs の start / complete 記録",
        buildList(operations.meterFixedFareRuns?.intro) +
        "<h4>start-fixed-fare</h4>" +
        buildTable(["フィールド", "説明"], startRows, { className: "table-meter-start", colWidths: ["30%", "70%"] }) +
        "<h4>complete-fixed-fare</h4>" +
        buildTable(["フィールド", "説明"], completeRows, { className: "table-meter-complete", colWidths: ["30%", "70%"] }) +
        buildList(operations.meterFixedFareRuns?.notes)
      ) +
      subsection("領収書に「事前確定運賃」と表示すること",
        buildList(operations.receiptDisplay?.intro) +
        buildList(operations.receiptDisplay?.rules) +
        "<p><strong>" + escapeHtml(operations.receiptDisplay?.example || "") + "</strong></p>"
      ) +
      subsection("本番E2E確認結果",
        "<div class='table-group'>" + e2eCaseTables + "</div>" +
        buildSplitTables(
          ["確認項目", "結果"],
          (e2e.checks || []).map(function(row){ return [row.item, row.result]; }),
          { className: "table-e2e-checks", colWidths: ["74%", "26%"], maxRowsPerTable: 5 }
        )
      )
    );
  }

  function buildChapter4(pct, data){
    if(!pct) return "<p>—</p>";
    const basicOp = pct.basicOperation || {};
    const audit = pct.auditTrail || {};
    const comparison = pct.completionComparison || {};
    const meterAppFlow = Array.isArray(data?.integratedMeterAppFlow) ? data.integratedMeterAppFlow : [];
    const caseRecordAuditRows = (audit.caseRecords || []).map(function(row){
      return [row.field, row.value];
    });
    const reservationAuditRows = (audit.reservationV4 || []).map(function(row){
      return [row.field, row.value];
    });
    const normalAuditRows = (audit.normalCompletion || []).map(function(row){
      return [row.field, row.value];
    });
    const normalCompRows = (comparison.normal?.rows || []).map(function(row){
      return [row.field, row.value];
    });
    const passengerCompRows = (comparison.passengerChange?.rows || []).map(function(row){
      return [row.field, row.value];
    });

    return (
      subsection("1. 基本運用",
        buildList(basicOp.intro) +
        "<h4>途中終了のトリガー</h4>" + buildList(basicOp.triggers)
      ) +
      subsection("2. 金額の扱い", buildList(pct.fareHandling)) +
      subsection("3. メーターアプリの操作導線",
        buildList(meterAppFlow) +
        (data?.passengerChangeMeterNote
          ? "<p class='meter-mode-note'>" + escapeHtml(data.passengerChangeMeterNote) + "</p>"
          : "")
      ) +
      subsection("4. 保存される監査証跡",
        "<h4>caseRecords 側</h4>" +
        buildTable(["フィールド", "値"], caseRecordAuditRows, { className: "table-audit-case", colWidths: ["38%", "62%"] }) +
        "<h4>reservation-v4 / D1 側</h4>" +
        buildTable(["フィールド", "値"], reservationAuditRows, { className: "table-audit-reservation", colWidths: ["38%", "62%"] }) +
        "<h4>通常完了の場合</h4>" +
        buildTable(["フィールド", "値"], normalAuditRows, { className: "table-audit-normal", colWidths: ["38%", "62%"] })
      ) +
      subsection("5. 通常完了との判別",
        "<h4>" + escapeHtml(comparison.normal?.label || "通常完了") + "</h4>" +
        buildTable(["フィールド", "値"], normalCompRows, { className: "table-comparison-normal", colWidths: ["38%", "62%"] }) +
        "<h4>" + escapeHtml(comparison.passengerChange?.label || "旅客都合途中終了") + "</h4>" +
        buildTable(["フィールド", "値"], passengerCompRows, { className: "table-comparison-passenger", colWidths: ["38%", "62%"] })
      ) +
      subsection("6. 予約詳細・管理画面の表示",
        "<h4>旅客都合途中終了時</h4>" + buildList(pct.adminDisplay?.passengerChangeItems) +
        "<h4>通常完了時</h4><p>" + escapeHtml(pct.adminDisplay?.normalNote || "") + "</p>"
      )
    );
  }

  function buildChapter5(data){
    const operations = data.operations || {};
    const e2e = operations.e2eEvidence || {};
    const verifiedChecks = (e2e.checks || []).filter(function(row){
      return row.result === "OK";
    });
    const preLaunchTitle = data.preLaunchChecksSectionTitle || "運用開始前確認項目";
    const preLaunchChecks = Array.isArray(data.integratedPreLaunchChecks) ? data.integratedPreLaunchChecks : [];

    return (
      subsection("確認済み予約ID",
        buildTable(
          ["区分", "予約ID", "表示"],
          (e2e.cases || []).map(function(caseItem){
            return [caseItem.label, caseItem.reservationId, caseItem.displayLabel];
          }),
          { className: "table-verified-ids", colWidths: ["28%", "24%", "48%"] }
        ) +
        (data.e2eReservationNote
          ? "<p class='e2e-reservation-note'>" + escapeHtml(data.e2eReservationNote) + "</p>"
          : "")
      ) +
      subsection("確認済み内容",
        buildSplitTables(
          ["確認項目", "結果"],
          verifiedChecks.map(function(row){ return [row.item, row.result]; }),
          { className: "table-verified-checks", colWidths: ["74%", "26%"], maxRowsPerTable: 5 }
        )
      ) +
      subsection(preLaunchTitle,
        "<p>以下は運用開始前の目視確認項目（確認予定）です。提出直前に確認完了後は、見出しを「運用開始前確認結果」に変更できます。</p>" +
        buildList(preLaunchChecks)
      ) +
      subsection("根拠資料・確認資料一覧", buildList(data.referenceMaterials))
    );
  }

  function buildReportHtml(data){
    const meta = data.meta || {};
    const positioning = data.chapterPositioning || {};
    const regulatory = data.regulatory || {};
    const approval = data.approval || {};
    const operations = data.operations || {};
    const pct = operations.passengerChangeTermination || {};

    return (
      "<div class='pre-fixed-fare-integrated-summary'>" +
      buildCover(meta, data.title) +
      buildToc(data.toc) +
      chapterBlock(1, "システム基本方針と公示要件対応", positioning[1], buildChapter1(regulatory), { first: true }) +
      chapterBlock(2, "利用者向け見積シミュレーターの動作と判定ロジック", positioning[2], buildChapter2(approval)) +
      chapterBlock(3, "運行・精算における運用フローと監査証跡", positioning[3], buildChapter3(operations)) +
      chapterBlock(4, "旅客都合変更時の途中終了運用", positioning[4], buildChapter4(pct, data)) +
      chapterBlock(5, "確認済み証跡と運用開始前確認項目", positioning[5], buildChapter5(data), { last: true }) +
      "<p class='footer-note'>" + escapeHtml(data.footerNote || "") + "</p>" +
      "</div>"
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

  function createRenderContainer(reportHtml){
    const container = document.createElement("div");
    container.className = "pre-fixed-fare-integrated-summary-render-shell";
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
      ".pre-fixed-fare-integrated-summary,.pre-fixed-fare-integrated-summary *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary{display:block;visibility:visible;opacity:1;position:relative;top:0;left:0;width:720px;background:#ffffff;color:#111111;line-height:1.45;font-size:10.5px;padding:4px 0 0;margin:0;}" +
      ".pre-fixed-fare-integrated-summary h1{font-size:19px;margin:0 0 4px;color:#111111;line-height:1.3;}" +
      ".pre-fixed-fare-integrated-summary .cover-title{font-size:22px;margin:24px 0 8px;text-align:center;}" +
      ".pre-fixed-fare-integrated-summary .cover-subtitle{font-size:13px;margin:0 0 20px;text-align:center;color:#444;}" +
      ".pre-fixed-fare-integrated-summary .cover-page{margin:0 0 12px;padding:12px 0 10px;border-bottom:2px solid #ccc;}" +
      ".pre-fixed-fare-integrated-summary .toc-page{margin:0 0 10px;}" +
      ".pre-fixed-fare-integrated-summary .toc-heading{font-size:16px;margin:0 0 8px;}" +
      ".pre-fixed-fare-integrated-summary .chapter-block{margin:0 0 10px;}" +
      ".pre-fixed-fare-integrated-summary .chapter-block-first{margin-top:0;}" +
      ".pre-fixed-fare-integrated-summary .chapter-start{margin:0 0 8px;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .chapter-title{font-size:15px;margin:0 0 6px;border-bottom:2px solid #333;padding-bottom:4px;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary .chapter-positioning{font-size:10.5px;color:#444;margin:0 0 8px;}" +
      ".pre-fixed-fare-integrated-summary .subsection-block{margin:0 0 10px;}" +
      ".pre-fixed-fare-integrated-summary .subsection-content{margin:0 0 4px;}" +
      ".pre-fixed-fare-integrated-summary .table-group{margin:0 0 6px;}" +
      ".pre-fixed-fare-integrated-summary h2{font-size:13.5px;margin:12px 0 6px;padding-bottom:2px;border-bottom:1px solid #ccc;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary h3{font-size:11.5px;margin:8px 0 5px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary h4{font-size:10.5px;margin:6px 0 4px;color:#333;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary p{margin:0 0 6px;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary ul,.pre-fixed-fare-integrated-summary ol{margin:0 0 6px 16px;padding:0;}" +
      ".pre-fixed-fare-integrated-summary li{margin:0 0 3px;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary table{width:100%;border-collapse:collapse;table-layout:fixed;margin:4px 0 6px;background:#ffffff;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary thead{display:table-header-group;}" +
      ".pre-fixed-fare-integrated-summary th,.pre-fixed-fare-integrated-summary td{border:1px solid #d9d9d9;padding:4px 5px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;color:#111111;background:#ffffff;box-sizing:border-box;font-size:9.5px;line-height:1.35;}" +
      ".pre-fixed-fare-integrated-summary th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-integrated-summary tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .table-cover-meta tr,.pre-fixed-fare-integrated-summary .table-toc tr,.pre-fixed-fare-integrated-summary .table-e2e-meta tr{break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .table-requirements td,.pre-fixed-fare-integrated-summary .table-requirements th,.pre-fixed-fare-integrated-summary .table-phase3-evidence td,.pre-fixed-fare-integrated-summary .table-phase3-evidence th{font-size:8.5px;}" +
      ".pre-fixed-fare-integrated-summary .footer-note{margin-top:12px;font-size:9.5px;color:#444;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .e2e-reservation-note,.pre-fixed-fare-integrated-summary .meter-mode-note{margin:6px 0 0;font-size:9.5px;color:#444;}" +
      "</style>" +
      reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("統合説明資料PDFの生成対象要素が作成できませんでした。");
    }
    const htmlLength = String(reportElement.innerHTML || "").trim().length;
    const textLength = String(reportElement.innerText || "").trim().length;
    if(htmlLength <= 0 || textLength <= 0){
      throw new Error("統合説明資料PDFの生成対象HTMLが空です。");
    }
  }

  async function waitForRenderReady(){
    try{
      if(document.fonts && typeof document.fonts.ready?.then === "function"){
        await document.fonts.ready;
      }
    }catch(error){
      console.warn("[PreFixedFareIntegratedSummaryPdf] font readiness check failed", error);
    }
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
    await new Promise(function(resolve){ requestAnimationFrame(resolve); });
  }

  function getHtml2PdfOptions(filename){
    return {
      margin: [6, 6, 6, 6],
      filename: filename || PDF_FILENAME,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        after: [".cover-page", ".toc-page"],
        before: [".chapter-block:not(.chapter-block-first)"],
        avoid: [".table-avoid-break", "tr", "h3", "h4"]
      }
    };
  }

  async function renderToElement(reportData){
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-integrated-summary");
    ensureRenderableContent(reportElement);
    await waitForRenderReady();
    return {
      wrapper: wrapper,
      reportElement: reportElement,
      htmlText: String(reportElement?.innerText || "")
    };
  }

  async function renderPdfBlob(reportData){
    await ensureHtml2Pdf();
    const rendered = await renderToElement(reportData);
    try{
      const blob = await html2pdf()
        .set(getHtml2PdfOptions())
        .from(rendered.reportElement)
        .outputPdf("blob");
      return { blob: blob, htmlText: rendered.htmlText };
    }finally{
      rendered.wrapper.remove();
    }
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const rendered = await renderToElement(reportData);
    try{
      await html2pdf()
        .set(getHtml2PdfOptions())
        .from(rendered.reportElement)
        .save();
    }finally{
      rendered.wrapper.remove();
    }
  }

  async function generatePreFixedFareIntegratedSummaryPdf(options){
    if(!global.PreFixedFareIntegratedSummaryData){
      throw new Error("統合説明資料データモジュールの読み込みに失敗しました。");
    }
    const reportData = global.PreFixedFareIntegratedSummaryData.buildReportData(options || {});
    if(!reportData || !String(reportData.title || "").trim()){
      throw new Error("統合説明資料データの組み立てに失敗しました。");
    }
    await savePdf(reportData);
    return reportData;
  }

  global.PreFixedFareIntegratedSummaryPdf = {
    PDF_FILENAME: PDF_FILENAME,
    buildReportHtml: buildReportHtml,
    renderPdfBlob: renderPdfBlob,
    savePdf: savePdf,
    generatePreFixedFareIntegratedSummaryPdf: generatePreFixedFareIntegratedSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
