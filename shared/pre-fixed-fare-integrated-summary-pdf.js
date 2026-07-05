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
    return "<div class='table-wrap'><table" + (className ? " class='" + escapeHtml(className) + "'" : "") + ">" + colgroup + "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function subsection(title, bodyHtml, options){
    options = options || {};
    const extraClass = options.extraClass ? " " + options.extraClass : "";
    return (
      "<section class='subsection-block" + extraClass + "'>" +
      "<h3 class='section-title'>" + escapeHtml(title) + "</h3>" +
      "<div class='subsection-content'>" + bodyHtml + "</div>" +
      "</section>"
    );
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
        ),
        { extraClass: "page-break-before table-section no-split-table" }
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

  function buildChapter6ScreenReference(appendix){
    const screenshots = appendix?.screenshotCaptures || {};
    return subsection(
      screenshots.title || "画面キャプチャ貼付資料",
      "<p>利用者のルート選択、旅客同意確認、乗務員用確定ルート確認、領収書・レシート明細画面については、別添「画面証跡資料」P2〜P5を参照。</p>" +
      (screenshots.verificationNote
        ? "<p class='verification-note'>" + escapeHtml(screenshots.verificationNote) + "</p>"
        : "")
    );
  }

  function buildReviewScreenReference(){
    return subsection("実画面証跡資料との対応",
      "<p>別添「実画面証跡資料」に、以下の画面証跡を掲載している。</p>" +
      buildTable(
        ["画面", "確認内容", "掲載"],
        [
          ["ルート選択画面", "2以上の走行予定ルート提示と旅客選択", "画面証跡 P2"],
          ["旅客同意確認画面", "事前確定運賃額・選択ルート・注意事項の同意取得", "画面証跡 P3"],
          ["ドライバー確認画面", "旅客同意済み確定ルート・事前確定運賃額の確認", "画面証跡 P4"],
          ["領収書・レシート明細画面", "事前確定運賃としての明細表示", "画面証跡 P5"],
          ["予約詳細（メーター）", "確定運賃内訳・各種料金の区分表示", "画面証跡 P6"],
          ["各種料金確認画面", "迎車料・特殊車両料金等の別枠加算", "画面証跡 P7（補足資料）"]
        ],
        { className: "table-screen-ref", colWidths: ["24%", "46%", "30%"] }
      )
    );
  }

  function buildChapterReview1Overview(data){
    const regulatory = data.regulatory || {};
    const meta = data.meta || {};
    return (
      subsection("申請目的", buildList(regulatory.purpose)) +
      subsection("使用する配車アプリ名称",
        "<p>ちばケアタクシー LP見積シミュレーター / 予約システム（reservation-v4） / メーターアプリ（care-taxi-meter）</p>" +
        "<p>対象：" + escapeHtml(meta.target || "") + "</p>"
      ) +
      subsection("対象営業区域", "<p>千葉交通圏（申請書・別紙1参照）</p>") +
      subsection("適用する運賃・料金の種類",
        buildList([
          "事前確定運賃本体（距離制運賃 × 平準化係数）",
          "各種料金（迎車料、介助料、待機料、付き添い料、有料道路代、駐車場代等）— 別紙2参照",
          "障害者割引、福祉タクシー券等 — 精算時に記録"
        ])
      )
    );
  }

  function buildChapterReview2Requirements(regulatory, data){
    const multiRouteRows = mapRows(regulatory.multiRouteRows, function(row){
      return [row.item, row.status, row.basis];
    });
    const requirementRows = mapRows(regulatory.requirementRows, function(row){
      return [row.requirement, row.policy, row.current, row.evidence];
    });
    const tollRows = mapRows(regulatory.tollRows, function(row){
      return [row.item, row.status, row.basis];
    });

    return (
      subsection("電子地図による推計走行距離", buildList(regulatory.mapAndRouteDesign)) +
      subsection("距離制運賃×平準化係数",
        "<p><strong>" + escapeHtml(regulatory.notices?.formulaText || "") + "</strong></p>" +
        buildList(regulatory.notices?.formulas)
      ) +
      subsection("時間距離併用制運賃の除外",
        "<p>事前確定運賃の算定では、時間距離併用制運賃を用いず、距離制運賃を基準とする。別紙2の「予定時間加算」はLP上の概算見積補助項目であり、正式な事前確定運賃本体には含めない。</p>"
      ) +
      subsection("2以上のルート提示",
        buildTable(["項目", "状況", "根拠"], multiRouteRows, { className: "table-multi-route", colWidths: ["24%", "16%", "60%"] })
      ) +
      subsection("有料道路利用有無の選択",
        buildTable(["項目", "状況", "根拠"], tollRows, { className: "table-toll", colWidths: ["24%", "16%", "60%"] })
      ) +
      subsection("旅客同意",
        buildList(regulatory.userNoticeItems) +
        "<h4>同意前注意事項</h4>" + buildList(regulatory.cautionBeforeConsent)
      ) +
      subsection("運転者への同一ルート提示",
        (data?.driverRouteDisplay?.status ? "<p><strong>現状：</strong>" + escapeHtml(data.driverRouteDisplay.status) + "</p>" : "") +
        buildList(data?.driverRouteDisplay?.points || []) +
        "<p class='note'>地図描画の最終目視確認は第10章に整理する。</p>"
      ) +
      subsection("公示要件対応表",
        buildTable(
          ["公示要件", "システム対応方針", "現状", "根拠"],
          requirementRows,
          { className: "table-requirements", colWidths: ["24%", "30%", "14%", "32%"] }
        )
      )
    );
  }

  function buildChapterReview4FareBasis(regulatory, data){
    const coefficientRows = mapRows(regulatory.coefficientRows, function(row){
      return [row.area, numberLabel(row.coefficient), row.basis, row.appliedAt];
    });
    return (
      subsection("距離制運賃表",
        (data?.fareTableAppendixNote ? "<p>" + escapeHtml(data.fareTableAppendixNote) + "</p>" : "") +
        "<p>詳細は別紙1「距離制運賃表」を参照。</p>"
      ) +
      subsection("平準化係数",
        "<p>" + escapeHtml(regulatory.coefficientPolicy || "") + "</p>" +
        buildTable(
          ["営業区域", "係数", "根拠", "適用日"],
          coefficientRows,
          { className: "table-coefficients", colWidths: ["20%", "12%", "38%", "30%"] }
        ),
        { extraClass: "page-break-before table-section no-split-table" }
      ) +
      subsection("算定式",
        (regulatory.notices?.fareBasisNote ? "<p>" + escapeHtml(regulatory.notices.fareBasisNote) + "</p>" : "") +
        buildList(regulatory.notices?.formulas) +
        "<p><strong>" + escapeHtml(regulatory.notices?.formulaText || "") + "</strong></p>"
      ) +
      subsection("四捨五入", "<p>事前確定運賃算定時は1円未満の端数を四捨五入する（別紙1参照）。</p>")
    );
  }

  function buildChapterReview5FeeSeparation(regulatory, data){
    const fareFeeRows = mapRows(regulatory.fareAndFeeRows, function(row){
      return [row.category, row.include, row.handling];
    });
    return (
      subsection("事前確定運賃本体と各種料金の区分",
        (data?.fareFeeDisplayNote ? "<p>" + escapeHtml(data.fareFeeDisplayNote) + "</p>" : "") +
        buildTable(
          ["区分", "事前確定運賃に含めるか", "扱い"],
          fareFeeRows,
          { className: "table-fare-fees", colWidths: ["34%", "20%", "46%"] }
        ) +
        "<p>詳細は別紙2「各種料金表」を参照。迎車料800円、特殊車両使用料1,000円等は事前確定運賃本体とは区分して表示・精算する。</p>"
      )
    );
  }

  function buildChapterReview6Exceptions(approval, pct, data){
    const judgmentRows = mapRows(approval.judgmentRows, function(row){
      return [row.condition, row.system, row.reservationUrl, row.button, row.handling];
    });
    return (
      buildChapter4Page11(pct, data) +
      buildChapter4Page12(pct) +
      subsection("判定ロジック（候補1件時・帰り立ち寄り等）",
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
      subsection("事故・通行止め等の迂回", "<p>外的要因による迂回は旅客都合変更と区別し、記録を残して運用する。詳細は別添Q&A資料および運用・監査説明資料を参照。</p>")
    );
  }

  function buildChapterReview7Tamper(appendix, regulatory){
    const tamper = appendix?.tamperProtection || {};
    return subsection(tamper.title || "改ざん防止及びスナップショットハッシュの取扱い",
      buildList(regulatory.tamperProtectionSummary) +
      (tamper.paragraphs || []).map(function(paragraph){
        return "<p>" + escapeHtml(paragraph) + "</p>";
      }).join("") +
      (tamper.terminologyNote
        ? "<p class='terminology-note'><strong>用語の位置づけ：</strong>" + escapeHtml(tamper.terminologyNote) + "</p>"
        : "")
    );
  }

  function buildChapterReview7Audit(operations, data, regulatory, appendix){
    return (
      buildChapter3Page8(operations, data) +
      buildChapter3Page9(operations) +
      subsection("quoteSnapshot・証跡保存",
        "<h4>確認できる項目</h4>" + buildList(regulatory.snapshotConfirmed) +
        "<h4>" + escapeHtml(regulatory.snapshotUnconfirmedTitle || "今後の強化候補") + "</h4>" +
        buildList(regulatory.snapshotUnconfirmed)
      ) +
      buildChapter6Page14(appendix) +
      buildChapter6Page15(appendix) +
      buildChapterReview7Tamper(appendix, regulatory)
    );
  }

  function buildChapterReview8E2e(data, operations, appendix){
    const e2e = operations.e2eEvidence || {};
    const verifiedChecks = (e2e.checks || []).filter(function(row){
      return row.result === "OK";
    });
    return (
      buildChapter3Page10(operations) +
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
      subsection(appendix?.e2eTestCases?.title || "本番相当環境E2Eテストケース表",
        (appendix?.e2eTestCases?.note ? "<p class='e2e-reservation-note'>" + escapeHtml(appendix.e2eTestCases.note) + "</p>" : "") +
        buildTable(
          appendix?.e2eTestCases?.headers || ["ID", "テストシナリオ", "期待される挙動", "結果", "エビデンス"],
          appendix?.e2eTestCases?.rows || [],
          { className: "table-e2e-cases", colWidths: ["10%", "22%", "30%", "10%", "28%"] }
        )
      )
    );
  }

  function buildChapterReview9Qa(data){
    const topics = [
      "算定式と距離制運賃・平準化係数",
      "2以上のルート提示と旅客選択",
      "旅客同意と注意事項",
      "運転者への同一ルート提示",
      "各種料金との区分",
      "旅客都合ルート変更時の途中終了",
      "事故・通行止め等の迂回",
      "候補1件時の扱い",
      "監査証跡・保存期間",
      "snapshotHashによる整合性確認"
    ];
    return (
      "<p>" + escapeHtml(data.qaChapterNote || "") + "</p>" +
      subsection("主要論点一覧", buildList(topics)) +
      "<p>全文は別添「Q&A資料」を参照。</p>"
    );
  }

  function buildChapterReview10Supplement(data, operations){
    const preLaunchTitle = data.preLaunchChecksSectionTitle || "運用開始前確認項目";
    const preLaunchChecks = Array.isArray(data.integratedPreLaunchChecks) ? data.integratedPreLaunchChecks : [];
    const tokenCaveats = operations.tokenSecurity?.caveats || [];
    const driverNote = data?.driverRouteDisplay?.visualCheckNote || "";
    const futureItems = (data.regulatory?.snapshotUnconfirmed || []).concat([
      "運転者向けルート地図描画（polyline表示）の最終目視確認",
      "Firebase ID Token検証の今後対応",
      "利用明細書PDF fixed専用表示対応",
      "本番相当E2E証跡の定期更新"
    ]);

    return (
      subsection(preLaunchTitle,
        "<p>" + escapeHtml(data.preLaunchCheckIntro || "") + "</p>" +
        buildList(preLaunchChecks) +
        (data.preLaunchCheckSwapNote ? "<p class='prelaunch-swap-note'>" + escapeHtml(data.preLaunchCheckSwapNote) + "</p>" : "")
      ) +
      (driverNote ? subsection("運転者向けルート表示の最終確認", "<p>" + escapeHtml(driverNote) + "</p>") : "") +
      subsection("将来強化候補", buildList(futureItems)) +
      (tokenCaveats.length ? subsection("認証・セキュリティの今後対応", buildList(tokenCaveats)) : "") +
      subsection("根拠資料・確認資料一覧", buildList(data.referenceMaterials)) +
      subsection("申請担当者による最終確認項目",
        buildList([
          "申請書代表者印の押印",
          "別紙1・別紙2の最終数値確認",
          "画面証跡の実画面一致確認",
          "一式PDFのページ対応表と実ページの照合",
          "運用開始前目視確認項目の実施記録"
        ])
      ) +
      "<p class='footer-note'>" + escapeHtml(data.footerNote || "") + "</p>"
    );
  }

  function buildFullSetToc(fullSetToc){
    const rows = [];
    (fullSetToc || []).forEach(function(item){
      rows.push([item.no, item.title, ""]);
      (item.children || []).forEach(function(child){
        rows.push(["", child, ""]);
      });
    });
    return (
      "<h2 class='toc-heading'>一式提出候補 目次（審査論点順）</h2>" +
      buildTable(["No", "項目", ""], rows, { className: "table-fullset-toc", colWidths: ["12%", "68%", "20%"] })
    );
  }

  function buildReviewOrientedReportHtml(data){
    const positioning = data.reviewChapterPositioning || data.chapterPositioning || {};
    const regulatory = data.regulatory || {};
    const approval = data.approval || {};
    const operations = data.operations || {};
    const pct = operations.passengerChangeTermination || {};
    const appendix = data.appendix || {};
    const reviewToc = data.reviewToc || data.toc || [];

    return (
      "<div class='pre-fixed-fare-integrated-summary report-page'>" +
      "<section class='doc-cover'>" + buildCover(data.meta || {}, data.title) + "</section>" +
      "<section class='doc-toc'>" + buildFullSetToc(data.fullSetToc) + buildToc(reviewToc) + "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(1, reviewToc[0]?.title || "事前確定運賃の申請概要", positioning[1]) +
        buildChapterReview1Overview(data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(2, reviewToc[1]?.title || "認可審査要件への対応", positioning[2]) +
        buildChapterReview2Requirements(regulatory, data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(3, reviewToc[2]?.title || "実画面証跡", positioning[3]) +
        buildReviewScreenReference() +
        buildChapter6ScreenReference(appendix) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(4, reviewToc[3]?.title || "運賃算定根拠", positioning[4]) +
        buildChapterReview4FareBasis(regulatory, data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(5, reviewToc[4]?.title || "各種料金との区分", positioning[5]) +
        buildChapterReview5FeeSeparation(regulatory, data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(6, reviewToc[5]?.title || "例外運用", positioning[6]) +
        buildChapterReview6Exceptions(approval, pct, data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(7, reviewToc[6]?.title || "監査証跡・保存・照合", positioning[7]) +
        buildChapterReview7Audit(operations, data, regulatory, appendix) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(8, reviewToc[7]?.title || "本番相当環境E2E確認", positioning[8]) +
        buildChapterReview8E2e(data, operations, appendix) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(9, reviewToc[8]?.title || "Q&A", positioning[9]) +
        buildChapterReview9Qa(data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(10, reviewToc[9]?.title || "補足・運用開始前確認項目", positioning[10]) +
        buildChapterReview10Supplement(data, operations) +
      "</section>" +
      "</div>"
    );
  }

  function buildReportHtml(data, options){
    if(options && options.reviewOriented){
      return buildReviewOrientedReportHtml(data);
    }
    const positioning = data.chapterPositioning || {};
    const regulatory = data.regulatory || {};
    const approval = data.approval || {};
    const operations = data.operations || {};
    const pct = operations.passengerChangeTermination || {};
    const appendix = data.appendix || {};

    return (
      "<div class='pre-fixed-fare-integrated-summary report-page'>" +
      "<section class='doc-cover'>" + buildCover(data.meta || {}, data.title) + "</section>" +
      "<section class='doc-toc'>" + buildToc(data.toc) + "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(1, "システム基本方針と公示要件対応", positioning[1]) +
        buildChapter1Page3(regulatory, data) +
        buildChapter1Page4(regulatory) +
        buildChapter1Page5(regulatory) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(2, "利用者向け見積シミュレーターの動作と判定ロジック", positioning[2]) +
        buildChapter2Page6(approval) +
        buildChapter2Page7(approval) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(3, "運行・精算における運用フローと監査証跡", positioning[3]) +
        buildChapter3Page8(operations, data) +
        buildChapter3Page9(operations) +
        buildChapter3Page10(operations) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(4, "旅客都合変更時の途中終了運用", positioning[4]) +
        buildChapter4Page11(pct, data) +
        buildChapter4Page12(pct) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(5, "確認済み証跡と運用開始前確認項目", positioning[5]) +
        buildChapter5Page13(data) +
      "</section>" +
      "<section class='chapter-start'>" +
        chapterHeader(6, "追加資料（データ保存・画面キャプチャ・E2E・改ざん防止）", positioning[6]) +
        buildChapter6Page14(appendix) +
        buildChapter6Page15(appendix) +
        buildChapter6ScreenReference(appendix) +
        buildChapter6Page18(appendix) +
      "</section>" +
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

  function getIntegratedPageCss(){
    if(!global.PreFixedFarePrintLayoutCss){
      throw new Error("印刷用レイアウトCSSモジュールが読み込まれていません。");
    }
    const scope = ".pre-fixed-fare-integrated-summary";
    return (
      global.PreFixedFarePrintLayoutCss.getCorePrintCss(scope) +
      scope + " .cover-title{font-size:18pt;margin:0 0 5mm;text-align:center;}" +
      scope + " .cover-subtitle{font-size:16pt;margin:0 0 6mm;text-align:center;color:#334155;}" +
      scope + " .toc-heading{font-size:16pt;margin:0 0 4mm;}" +
      scope + " .chapter-title{font-size:16pt;margin:0 0 4mm;border-bottom:2px solid #333;padding-bottom:2mm;}" +
      scope + " .chapter-positioning{font-size:9pt;color:#64748b;margin:0 0 4mm;}" +
      scope + " .verification-note{margin:0 0 4mm;padding:4mm;background:#eef5fb;border-left:4px solid #2f6fad;}" +
      scope + " .e2e-reservation-note," + scope + " .meter-mode-note," + scope + " .prelaunch-swap-note," + scope + " .terminology-note{font-size:9pt;color:#64748b;}"
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
    container.style.width = "auto";
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
    const margin = global.PreFixedFarePrintLayoutCss
      ? global.PreFixedFarePrintLayoutCss.HTML2PDF_MARGIN_MM
      : [16, 14, 20, 14];
    return {
      margin: margin,
      filename: filename || PDF_FILENAME,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        before: [".chapter-start"],
        after: []
      }
    };
  }

  function addPageNumbers(pdf){
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    for(let pageNum = 1; pageNum <= totalPages; pageNum++){
      pdf.setPage(pageNum);
      pdf.text(String(pageNum) + " / " + String(totalPages), pageWidth / 2, pageHeight - 10, { align: "center" });
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

  async function inlineLocalImages(reportElement){
    const images = Array.from(reportElement.querySelectorAll("img"));
    await Promise.all(images.map(async function(img){
      const src = String(img.currentSrc || img.src || "").trim();
      if(!src || src.startsWith("data:")){
        return;
      }
      try{
        const response = await fetch(src);
        if(!response.ok){
          console.warn("[PreFixedFareIntegratedSummaryPdf] image fetch failed:", src, response.status);
          return;
        }
        const blob = await response.blob();
        const dataUrl = await new Promise(function(resolve, reject){
          const reader = new FileReader();
          reader.onload = function(){ resolve(String(reader.result || "")); };
          reader.onerror = function(){ reject(reader.error || new Error("画像の読み込みに失敗しました。")); };
          reader.readAsDataURL(blob);
        });
        if(dataUrl){
          img.src = dataUrl;
        }
      }catch(error){
        console.warn("[PreFixedFareIntegratedSummaryPdf] image inline failed:", src, error);
      }
    }));
    await waitForImages(reportElement);
  }

  async function renderToElement(reportData){
    const reportHtml = buildReportHtml(reportData);
    const wrapper = createRenderContainer(reportHtml);
    document.body.appendChild(wrapper);
    const reportElement = wrapper.querySelector(".pre-fixed-fare-integrated-summary");
    ensureRenderableContent(reportElement);
    await waitForRenderReady();
    await waitForImages(reportElement);
    await inlineLocalImages(reportElement);
    return {
      wrapper: wrapper,
      reportElement: reportElement,
      htmlText: String(reportElement?.innerText || ""),
      pageCount: reportElement.querySelectorAll(".chapter-start").length
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

  function buildPrintDocument(reportData, options){
    options = options || {};
    const reviewOriented = Boolean(options.reviewOriented || reportData.reviewOriented);
    const reportHtml = buildReportHtml(reportData, { reviewOriented: reviewOriented });
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + escapeHtml(reportData.title || PDF_FILENAME) + "</title>" +
      "<style>" + getIntegratedPageCss() + "</style>" +
      "</head><body>" + reportHtml + "</body></html>"
    );
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
    buildReportHtml: buildReportHtml,
    buildReviewOrientedReportHtml: buildReviewOrientedReportHtml,
    buildPrintDocument: buildPrintDocument,
    renderPdfBlob: renderPdfBlob,
    savePdf: savePdf,
    generatePreFixedFareIntegratedSummaryPdf: generatePreFixedFareIntegratedSummaryPdf
  };
})(typeof window !== "undefined" ? window : globalThis);
