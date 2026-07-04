(function(global){
  const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  const PDF_FILENAME = "pre-fixed-fare-integrated-summary.pdf";
  const EXPECTED_PAGE_COUNT = 20;

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

  function subsection(title, bodyHtml){
    return (
      "<div class='subsection-block'>" +
      "<h3 class='section-title'>" + escapeHtml(title) + "</h3>" +
      "<div class='subsection-content'>" + bodyHtml + "</div>" +
      "</div>"
    );
  }

  function pageBottomSpacer(large){
    return "<div class='pdf-page-fill" + (large ? " pdf-page-fill--large" : "") + "' aria-hidden='true'></div>";
  }

  function pageClipGuard(){
    return "<div class='pdf-page-clip-guard' aria-hidden='true'></div>";
  }

  function pdfPage(pageId, bodyHtml, options){
    options = options || {};
    const breakClass = options.isLast ? "" : " pdf-page-break";
    const inner = "<div class='pdf-page-inner'>" + bodyHtml +
      (options.padBottom ? pageBottomSpacer(true) + pageClipGuard() : "") +
      "</div>";
    return "<div class='pdf-page" + breakClass + "' data-page-id='" + escapeHtml(pageId) + "'>" + inner + "</div>";
  }

  function numberLabel(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  function buildCover(meta, title){
    return (
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
      )
    );
  }

  function buildToc(toc){
    const rows = (toc || []).map(function(item){
      return ["第" + item.chapter + "章", item.title];
    });
    return (
      "<h2 class='toc-heading'>目次</h2>" +
      buildTable(
        ["章", "タイトル"],
        rows,
        { className: "table-toc", colWidths: ["18%", "82%"] }
      )
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

  function chapterSupplement(chapterNum, title, supplementTitle){
    return (
      "<div class='chapter-start chapter-start--continued'>" +
      "<h2 class='chapter-title chapter-title--continued'>第" + escapeHtml(chapterNum) + "章　" + escapeHtml(title) + "</h2>" +
      "<h3 class='chapter-supplement'>" + escapeHtml(supplementTitle) + "</h3>" +
      "</div>"
    );
  }

  function mapRows(items, mapper){
    return (items || []).map(mapper);
  }

  function buildChapter1Page3(regulatory, data){
    const coefficientRows = mapRows(regulatory.coefficientRows, function(row){
      return [row.area, numberLabel(row.coefficient), row.basis, row.appliedAt];
    });
    const fareFeeRows = mapRows(regulatory.fareAndFeeRows, function(row){
      return [row.category, row.include, row.handling];
    });
    const multiRouteRows = mapRows(regulatory.multiRouteRows, function(row){
      return [row.item, row.status, row.basis];
    });

    return (
      subsection("算定式と運賃算定根拠",
        (regulatory.notices?.fareBasisNote ? "<p>" + escapeHtml(regulatory.notices.fareBasisNote) + "</p>" : "") +
        (data?.fareTableAppendixNote ? "<p>" + escapeHtml(data.fareTableAppendixNote) + "</p>" : "") +
        (data?.fareFeeDisplayNote ? "<p>" + escapeHtml(data.fareFeeDisplayNote) + "</p>" : "") +
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
        buildTable(
          ["区分", "事前確定運賃に含めるか", "扱い"],
          fareFeeRows,
          { className: "table-fare-fees", colWidths: ["34%", "20%", "46%"] }
        )
      ) +
      subsection("電子地図ルート算定", buildList(regulatory.mapAndRouteDesign)) +
      subsection("2以上のルート選択",
        buildTable(
          ["項目", "状況", "根拠"],
          multiRouteRows.slice(0, 5),
          { className: "table-multi-route", colWidths: ["24%", "16%", "60%"] }
        )
      )
    );
  }

  function buildChapter1Page4(regulatory){
    const multiRouteRows = mapRows(regulatory.multiRouteRows, function(row){
      return [row.item, row.status, row.basis];
    });
    const requirementRows = mapRows(regulatory.requirementRows, function(row){
      return [row.requirement, row.policy, row.current, row.evidence];
    });

    return (
      subsection("2以上のルート選択（続き）",
        buildTable(
          ["項目", "状況", "根拠"],
          multiRouteRows.slice(5),
          { className: "table-multi-route", colWidths: ["24%", "16%", "60%"] }
        )
      ) +
      subsection("利用者への提示と同意",
        buildList(regulatory.userNoticeItems) +
        "<h4>同意前注意事項</h4>" + buildList(regulatory.cautionBeforeConsent)
      ) +
      subsection("quoteSnapshot・証跡保存",
        "<h4>確認できる項目</h4>" + buildList(regulatory.snapshotConfirmed) +
        "<h4>" + escapeHtml(regulatory.snapshotUnconfirmedTitle || "今後の強化候補") + "</h4>" +
        buildList(regulatory.snapshotUnconfirmed) +
        (regulatory.tamperProtectionSummary
          ? "<h4>改ざん防止及びスナップショットハッシュの取扱い</h4>" + buildList(regulatory.tamperProtectionSummary)
          : "")
      ) +
      subsection("公示要件対応表",
        buildTable(
          ["公示要件", "システム対応方針", "現状", "根拠"],
          requirementRows.slice(0, 4),
          { className: "table-requirements", colWidths: ["24%", "30%", "14%", "32%"] }
        )
      )
    );
  }

  function buildChapter1Page5(regulatory){
    const requirementRows = mapRows(regulatory.requirementRows, function(row){
      return [row.requirement, row.policy, row.current, row.evidence];
    });

    return subsection("公示要件対応表（続き）",
      buildTable(
        ["公示要件", "システム対応方針", "現状", "根拠"],
        requirementRows.slice(4),
        { className: "table-requirements", colWidths: ["24%", "30%", "14%", "32%"] }
      )
    );
  }

  function buildChapter2Page6(approval){
    const judgmentRows = mapRows(approval.judgmentRows, function(row){
      return [row.condition, row.system, row.reservationUrl, row.button, row.handling];
    });
    const routeTypes = mapRows(approval.routeCandidateTypes, function(row){
      return "<p><strong>" + escapeHtml(row.name) + "</strong>：" + escapeHtml(row.description) + "</p>";
    }).join("");

    return (
      subsection("条件入力とシステムフロー", buildList(approval.systemFlow)) +
      subsection("Google Routes API によるルート候補生成", routeTypes + "<p>" + escapeHtml(approval.dedupeNote || "") + "</p>") +
      subsection("判定ロジック（preFixedFareConfirmable）",
        buildTable(
          ["条件", "システム", "予約URL", "ボタン", "扱い"],
          judgmentRows.slice(0, 3),
          { className: "table-judgment", colWidths: ["22%", "18%", "18%", "18%", "24%"] }
        )
      ) +
      subsection("判定ロジック（preFixedFareConfirmable）（続き）",
        buildTable(
          ["条件", "システム", "予約URL", "ボタン", "扱い"],
          judgmentRows.slice(3),
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
      )
    );
  }

  function buildChapter2Page7(approval){
    const snapshotRows = mapRows(approval.snapshotFields, function(row){
      return [row.field, row.description];
    });
    const phase3Rows = mapRows(approval.phase3EvidenceRows, function(row){
      return [row.caseName, row.content, row.pdf, row.quoteSnapshot, row.handoff];
    });
    const phase2Rows = mapRows(approval.phase2EvidenceRows, function(row){
      return [row.caseName, row.content, row.files];
    });

    return (
      subsection("quoteSnapshot / handoff の保存",
        buildList(approval.snapshotIntro) +
        buildTable(
          ["フィールド", "説明"],
          snapshotRows.slice(0, 6),
          { className: "table-snapshot", colWidths: ["28%", "72%"] }
        )
      ) +
      subsection("quoteSnapshot / handoff の保存（続き）",
        buildTable(
          ["フィールド", "説明"],
          snapshotRows.slice(6),
          { className: "table-snapshot", colWidths: ["28%", "72%"] }
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

  function buildChapter3Page8(operations, data){
    const arch = operations.productionArchitecture || {};
    const driverRoute = data?.driverRouteDisplay || {};
    const archRows = mapRows(arch.components, function(row){
      return [row.component, row.role, row.path];
    });
    const integrityRows = mapRows(operations.integrityChecks?.checks, function(row){
      return [row.name, row.description];
    });

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
      subsection("運転者への同一ルート表示",
        (driverRoute.status ? "<p><strong>現状：</strong>" + escapeHtml(driverRoute.status) + "</p>" : "") +
        buildList(driverRoute.points) +
        (driverRoute.visualCheckNote ? "<p>" + escapeHtml(driverRoute.visualCheckNote) + "</p>" : "")
      )
    );
  }

  function buildChapter3Page9(operations){
    const caseRecordRows = mapRows(operations.caseRecordsFields, function(row){
      return [row.field, row.description];
    });
    const startRows = mapRows(operations.meterFixedFareRuns?.startRecord, function(row){
      return [row.field, row.description];
    });
    const completeRows = mapRows(operations.meterFixedFareRuns?.completeRecord, function(row){
      return [row.field, row.description];
    });

    return (
      subsection("caseRecords 保存項目",
        buildTable(
          ["フィールド", "説明"],
          caseRecordRows.slice(0, 6),
          { className: "table-case-records", colWidths: ["28%", "72%"] }
        )
      ) +
      subsection("caseRecords 保存項目（続き）",
        buildTable(
          ["フィールド", "説明"],
          caseRecordRows.slice(6),
          { className: "table-case-records", colWidths: ["28%", "72%"] }
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
      )
    );
  }

  function buildChapter3Page10(operations){
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
      "<div class='subsection-block'>" +
      "<div class='subsection-content'>" +
      e2eCaseTables +
      buildTable(
        ["確認項目", "結果"],
        (e2e.checks || []).map(function(row){ return [row.item, row.result]; }),
        { className: "table-e2e-checks", colWidths: ["74%", "26%"] }
      ) +
      "</div></div>"
    );
  }

  function buildChapter4Page11(pct, data){
    const basicOp = pct.basicOperation || {};
    const audit = pct.auditTrail || {};
    const meterAppFlow = Array.isArray(data?.integratedMeterAppFlow) ? data.integratedMeterAppFlow : [];
    const caseRecordAuditRows = mapRows(audit.caseRecords, function(row){
      return [row.field, row.value];
    });
    const reservationAuditRows = mapRows(audit.reservationV4, function(row){
      return [row.field, row.value];
    });
    const normalAuditRows = mapRows(audit.normalCompletion, function(row){
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
      )
    );
  }

  function buildChapter4Page12(pct){
    const comparison = pct.completionComparison || {};
    const normalCompRows = mapRows(comparison.normal?.rows, function(row){
      return [row.field, row.value];
    });
    const passengerCompRows = mapRows(comparison.passengerChange?.rows, function(row){
      return [row.field, row.value];
    });

    return (
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

  function buildChapter5Page13(data){
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
        buildTable(
          ["確認項目", "結果"],
          verifiedChecks.map(function(row){ return [row.item, row.result]; }),
          { className: "table-verified-checks", colWidths: ["74%", "26%"] }
        )
      ) +
      subsection(preLaunchTitle,
        "<p>" + escapeHtml(data.preLaunchCheckIntro || "") + "</p>" +
        buildList(preLaunchChecks) +
        (data.preLaunchCheckSwapNote ? "<p class='prelaunch-swap-note'>" + escapeHtml(data.preLaunchCheckSwapNote) + "</p>" : "")
      ) +
      subsection("根拠資料・確認資料一覧", buildList(data.referenceMaterials)) +
      "<p class='footer-note'>" + escapeHtml(data.footerNote || "") + "</p>"
    );
  }

  function capturePlaceholder(label){
    return (
      "<div class='capture-placeholder'>" +
      "<p class='capture-placeholder-label'>" + escapeHtml(label || "画面キャプチャ貼付欄") + "</p>" +
      "<p class='capture-placeholder-note'>（実画像を本枠内に貼付）</p>" +
      "</div>"
    );
  }

  function captureImage(imageFile, alt){
    return (
      "<div class='capture-image-wrap'>" +
      "<img class='capture-image' src='" + escapeHtml("./assets/evidence/pre-fixed-fare-20260705/" + imageFile) + "' alt='" + escapeHtml(alt || "") + "' loading='eager'>" +
      "</div>"
    );
  }

  function buildScreenshotSection(screen){
    const imageHtml = screen.imageFile
      ? captureImage(screen.imageFile, screen.title)
      : capturePlaceholder("画面キャプチャ貼付欄（" + screen.title + "）");
    return (
      "<div class='screenshot-block'>" +
      "<h4>" + escapeHtml(screen.number + ". " + screen.title) + "</h4>" +
      imageHtml +
      "<p><strong>キャプチャ内容：</strong>" + escapeHtml(screen.captureContent || "") + "</p>" +
      "<p><strong>証明文：</strong>" + escapeHtml(screen.proofText || "") + "</p>" +
      "</div>"
    );
  }

  function buildChapter6Page14(appendix){
    const regulation = appendix?.dataRetentionRegulation || {};
    const sections = regulation.sections || [];
    const section1 = sections[0];
    const section2 = sections[1];

    function renderSection(section){
      if(!section) return "";
      return (
        "<h4>" + escapeHtml(section.number + ". " + section.title) + "</h4>" +
        (section.paragraphs || []).map(function(paragraph){
          return "<p>" + escapeHtml(paragraph) + "</p>";
        }).join("")
      );
    }

    return (
      subsection(regulation.title || "データ管理及び監査証跡保存規程",
        renderSection(section1) + renderSection(section2)
      )
    );
  }

  function buildChapter6Page15(appendix){
    const regulation = appendix?.dataRetentionRegulation || {};
    const section3 = (regulation.sections || [])[2];
    if(!section3) return "<p>—</p>";

    return (
      subsection("データ管理及び監査証跡保存規程（続き）",
        "<h4>" + escapeHtml(section3.number + ". " + section3.title) + "</h4>" +
        (section3.paragraphs || []).map(function(paragraph){
          return "<p>" + escapeHtml(paragraph) + "</p>";
        }).join("") +
        buildList(section3.outputItems || []) +
        (section3.closing ? "<p>" + escapeHtml(section3.closing) + "</p>" : "")
      )
    );
  }

  function buildChapter6ScreenshotPage(appendix, screenIndex, titleSuffix){
    const screenshots = appendix?.screenshotCaptures || {};
    const screen = (screenshots.screens || [])[screenIndex];
    if(!screen){
      return "<p>—</p>";
    }
    return (
      subsection((screenshots.title || "画面キャプチャ貼付資料") + titleSuffix,
        (screenIndex === 0 && screenshots.intro ? "<p>" + escapeHtml(screenshots.intro) + "</p>" : "") +
        (screenshots.verificationNote ? "<p class='verification-note'>" + escapeHtml(screenshots.verificationNote) + "</p>" : "") +
        buildScreenshotSection(screen)
      )
    );
  }

  function buildChapter6Page18(appendix){
    const e2e = appendix?.e2eTestCases || {};
    const tamper = appendix?.tamperProtection || {};
    return (
      subsection(e2e.title || "本番相当環境E2Eテストケース表",
        (e2e.note ? "<p class='e2e-reservation-note'>" + escapeHtml(e2e.note) + "</p>" : "") +
        buildTable(
          e2e.headers || ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
          e2e.rows || [],
          { className: "table-e2e-cases", colWidths: ["10%", "22%", "30%", "10%", "28%"] }
        )
      ) +
      subsection(tamper.title || "改ざん防止及びスナップショットハッシュの取扱い",
        (tamper.paragraphs || []).map(function(paragraph){
          return "<p>" + escapeHtml(paragraph) + "</p>";
        }).join("") +
        (tamper.terminologyNote
          ? "<p class='terminology-note'><strong>用語の位置づけ：</strong>" + escapeHtml(tamper.terminologyNote) + "</p>"
          : "")
      )
    );
  }

  function buildPagePlan(data){
    const positioning = data.chapterPositioning || {};
    const regulatory = data.regulatory || {};
    const approval = data.approval || {};
    const operations = data.operations || {};
    const pct = operations.passengerChangeTermination || {};
    const appendix = data.appendix || {};

    return [
      { id: "p01-cover", html: buildCover(data.meta || {}, data.title) },
      { id: "p02-toc", html: buildToc(data.toc) },
      {
        id: "p03-ch1-part1",
        html: chapterHeader(1, "システム基本方針と公示要件対応", positioning[1]) + buildChapter1Page3(regulatory, data)
      },
      {
        id: "p04-ch1-part2",
        html: chapterSupplement(1, "システム基本方針と公示要件対応", "ルート選択・同意・証跡") + buildChapter1Page4(regulatory)
      },
      {
        id: "p05-ch1-requirements",
        html: chapterSupplement(1, "システム基本方針と公示要件対応", "公示要件対応表（続き）") + buildChapter1Page5(regulatory)
      },
      {
        id: "p06-ch2-part1",
        html: chapterHeader(2, "利用者向け見積シミュレーターの動作と判定ロジック", positioning[2]) + buildChapter2Page6(approval)
      },
      {
        id: "p07-ch2-snapshot",
        html: chapterSupplement(2, "利用者向け見積シミュレーターの動作と判定ロジック", "quoteSnapshot / handoff の保存（続き）") + buildChapter2Page7(approval)
      },
      {
        id: "p08-ch3-part1",
        html: chapterHeader(3, "運行・精算における運用フローと監査証跡", positioning[3]) + buildChapter3Page8(operations, data)
      },
      {
        id: "p09-ch3-records",
        html: chapterSupplement(3, "運行・精算における運用フローと監査証跡", "caseRecords・meter_fixed_fare_runs 保存項目") + buildChapter3Page9(operations)
      },
      {
        id: "p10-ch3-e2e",
        html: chapterSupplement(3, "運行・精算における運用フローと監査証跡", "本番相当環境E2E確認結果") + buildChapter3Page10(operations)
      },
      {
        id: "p11-ch4-part1",
        html: chapterHeader(4, "旅客都合変更時の途中終了運用", positioning[4]) + buildChapter4Page11(pct, data)
      },
      {
        id: "p12-ch4-part2",
        padBottom: true,
        html: chapterSupplement(4, "旅客都合変更時の途中終了運用", "通常完了との判別・予約詳細表示") + buildChapter4Page12(pct)
      },
      {
        id: "p13-ch5",
        html: chapterHeader(5, "確認済み証跡と運用開始前確認項目", positioning[5]) + buildChapter5Page13(data)
      },
      {
        id: "p14-ch6-retention",
        html: chapterHeader(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", positioning[6]) + buildChapter6Page14(appendix)
      },
      {
        id: "p15-ch6-output",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "監査時の出力方法") + buildChapter6Page15(appendix)
      },
      {
        id: "p16-ch6-screenshot1",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "画面キャプチャ貼付資料（1/4）") + buildChapter6ScreenshotPage(appendix, 0, "（1/4）")
      },
      {
        id: "p17-ch6-screenshot2",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "画面キャプチャ貼付資料（2/4）") + buildChapter6ScreenshotPage(appendix, 1, "（2/4）")
      },
      {
        id: "p18-ch6-screenshot3",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "画面キャプチャ貼付資料（3/4）") + buildChapter6ScreenshotPage(appendix, 2, "（3/4）")
      },
      {
        id: "p19-ch6-screenshot4",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "画面キャプチャ貼付資料（4/4）") + buildChapter6ScreenshotPage(appendix, 3, "（4/4）")
      },
      {
        id: "p20-ch6-e2e-tamper",
        html: chapterSupplement(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", "E2Eテスト・改ざん防止") + buildChapter6Page18(appendix)
      }
    ];
  }

  function buildReportHtml(data){
    const pages = buildPagePlan(data);
    return (
      "<div class='pre-fixed-fare-integrated-summary'>" +
      pages.map(function(page, index){
        return pdfPage(page.id, page.html, {
          padBottom: !!page.padBottom,
          isLast: index === pages.length - 1
        });
      }).join("") +
      "</div>"
    );
  }

  function getIntegratedPageCss(){
    return (
      ".pre-fixed-fare-integrated-summary,.pre-fixed-fare-integrated-summary *{box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Yu Gothic','Meiryo',sans-serif;background:transparent;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary{display:block;width:720px;background:#ffffff;color:#111111;line-height:1.45;font-size:11px;margin:0;padding:0;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page{width:720px;height:1000px;max-height:1000px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;page-break-after:always;break-after:page;margin:0;padding:0;position:relative;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page-break{page-break-after:always !important;break-after:page !important;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page-inner{height:960px;max-height:960px;display:flex;flex-direction:column;overflow:hidden;padding:2px 0 0;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page-fill{flex:1 1 auto;min-height:24px;background:#ffffff;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page-fill--large{min-height:120px;}" +
      ".pre-fixed-fare-integrated-summary .pdf-page-clip-guard{flex:0 0 72px;height:72px;background:#ffffff;}" +
      ".pre-fixed-fare-integrated-summary h1{font-size:20px;margin:0 0 4px;color:#111111;line-height:1.3;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary .cover-title{font-size:22px;margin:20px 0 8px;text-align:center;}" +
      ".pre-fixed-fare-integrated-summary .cover-subtitle{font-size:14px;margin:0 0 16px;text-align:center;color:#444;}" +
      ".pre-fixed-fare-integrated-summary .toc-heading{font-size:16px;margin:8px 0 10px;}" +
      ".pre-fixed-fare-integrated-summary .chapter-start{margin:0 0 6px;}" +
      ".pre-fixed-fare-integrated-summary .chapter-title{font-size:16px;margin:0 0 5px;border-bottom:2px solid #333;padding-bottom:3px;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary .chapter-title--continued{font-size:15px;}" +
      ".pre-fixed-fare-integrated-summary .chapter-supplement{font-size:13px;margin:0 0 8px;color:#333;border-bottom:1px solid #ddd;padding-bottom:3px;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary .chapter-positioning{font-size:10.5px;color:#444;margin:0 0 8px;}" +
      ".pre-fixed-fare-integrated-summary .subsection-block{margin:0 0 8px;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .subsection-content{margin:0;}" +
      ".pre-fixed-fare-integrated-summary h2{font-size:14px;margin:0 0 6px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary .section-title{font-size:12px;margin:0 0 4px;color:#111111;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary h4{font-size:11px;margin:5px 0 3px;color:#333;break-after:avoid;page-break-after:avoid;}" +
      ".pre-fixed-fare-integrated-summary p{margin:0 0 5px;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary ul,.pre-fixed-fare-integrated-summary ol{margin:0 0 5px 16px;padding:0;}" +
      ".pre-fixed-fare-integrated-summary li{margin:0 0 2px;color:#111111;}" +
      ".pre-fixed-fare-integrated-summary table{width:100%;border-collapse:collapse;table-layout:fixed;margin:3px 0 5px;background:#ffffff;page-break-inside:auto;}" +
      ".pre-fixed-fare-integrated-summary thead{display:table-header-group;}" +
      ".pre-fixed-fare-integrated-summary th,.pre-fixed-fare-integrated-summary td{border:1px solid #d9d9d9;padding:4px 5px;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere;color:#111111;background:#ffffff;font-size:9.5px;line-height:1.38;}" +
      ".pre-fixed-fare-integrated-summary th{background:#f6f6f6;font-weight:700;}" +
      ".pre-fixed-fare-integrated-summary tr{page-break-inside:avoid;break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .table-requirements td,.pre-fixed-fare-integrated-summary .table-requirements th,.pre-fixed-fare-integrated-summary .table-phase3-evidence td,.pre-fixed-fare-integrated-summary .table-phase3-evidence th{font-size:8.5px;}" +
      ".pre-fixed-fare-integrated-summary .footer-note{margin-top:8px;font-size:9px;color:#444;}" +
      ".pre-fixed-fare-integrated-summary .verification-note{margin:4px 0 6px;padding:6px;background:#eef5fb;border-left:4px solid #2f6fad;font-size:9px;line-height:1.45;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .e2e-reservation-note,.pre-fixed-fare-integrated-summary .meter-mode-note,.pre-fixed-fare-integrated-summary .prelaunch-swap-note,.pre-fixed-fare-integrated-summary .terminology-note{margin:4px 0 0;font-size:9px;color:#444;}" +
      ".pre-fixed-fare-integrated-summary .capture-placeholder{border:2px dashed #94a3b8;background:#f8fafc;min-height:56px;padding:8px;margin:4px 0 6px;text-align:center;}" +
      ".pre-fixed-fare-integrated-summary .capture-placeholder-label{font-weight:700;color:#475569;margin:0 0 2px;font-size:9px;}" +
      ".pre-fixed-fare-integrated-summary .capture-placeholder-note{font-size:8.5px;color:#64748b;margin:0;}" +
      ".pre-fixed-fare-integrated-summary .capture-image-wrap{display:flex;justify-content:center;margin:4px 0 6px;break-inside:avoid;page-break-inside:avoid;}" +
      ".pre-fixed-fare-integrated-summary .capture-image{display:block;max-width:92%;max-height:360px;object-fit:contain;object-position:top center;}" +
      ".pre-fixed-fare-integrated-summary .screenshot-block{margin:0 0 8px;break-inside:avoid;page-break-inside:avoid;}"
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
    container.innerHTML = "<style>" + getIntegratedPageCss() + "</style>" + reportHtml;
    return container;
  }

  function ensureRenderableContent(reportElement){
    if(!reportElement){
      throw new Error("統合説明資料PDFの生成対象要素が作成できませんでした。");
    }
    const pageCount = reportElement.querySelectorAll(".pdf-page").length;
    if(pageCount !== EXPECTED_PAGE_COUNT){
      throw new Error("統合説明資料PDFのページ数が不正です: " + pageCount + " (expected " + EXPECTED_PAGE_COUNT + ")");
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
      margin: [6, 14, 18, 14],
      filename: filename || PDF_FILENAME,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        before: [],
        after: [".pdf-page-break"]
      }
    };
  }

  function addPageNumbers(pdf){
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    for(let pageNum = 1; pageNum <= totalPages; pageNum++){
      pdf.setPage(pageNum);
      pdf.text(String(pageNum) + " / " + String(totalPages), pageWidth / 2, pageHeight - 4.5, { align: "center" });
    }
    return pdf;
  }

  async function writePdfFromElement(reportElement, mode){
    const options = getHtml2PdfOptions();
    const worker = html2pdf().set(options).from(reportElement);
    const pdf = await worker.toPdf().get("pdf");
    addPageNumbers(pdf);
    if(mode === "blob"){
      return pdf.output("blob");
    }
    pdf.save(options.filename);
  }

  async function waitForImages(reportElement){
    const images = Array.from(reportElement.querySelectorAll("img"));
    await Promise.all(images.map(function(img){
      if(img.complete && img.naturalWidth > 0){
        return Promise.resolve();
      }
      return new Promise(function(resolve){
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  async function renderToElement(reportData){
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-integrated-summary");
    ensureRenderableContent(reportElement);
    await waitForRenderReady();
    await waitForImages(reportElement);
    return {
      wrapper: wrapper,
      reportElement: reportElement,
      htmlText: String(reportElement?.innerText || ""),
      pageCount: reportElement.querySelectorAll(".pdf-page").length
    };
  }

  async function renderPdfBlob(reportData){
    await ensureHtml2Pdf();
    const rendered = await renderToElement(reportData);
    try{
      const blob = await writePdfFromElement(rendered.reportElement, "blob");
      return { blob: blob, htmlText: rendered.htmlText, pageCount: rendered.pageCount };
    }finally{
      rendered.wrapper.remove();
    }
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const rendered = await renderToElement(reportData);
    try{
      await writePdfFromElement(rendered.reportElement, "save");
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
    EXPECTED_PAGE_COUNT: EXPECTED_PAGE_COUNT,
    buildPagePlan: buildPagePlan,
    buildReportHtml: buildReportHtml,
    renderPdfBlob: renderPdfBlob,
    savePdf: savePdf,
    generatePreFixedFareIntegratedSummaryPdf: generatePreFixedFareIntegratedSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
