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

  function buildTable(headers, rows){
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const body = (rows || []).map(function(row){
      const cells = row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return "<table><thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>";
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
      ]
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
    return "<section><h2>" + escapeHtml(title) + "</h2>" + bodyHtml + "</section>";
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
      "<!doctype html><html><head><meta charset='utf-8'><style>" +
      "body{font-family:'Yu Gothic','Meiryo',sans-serif;color:#222;font-size:11px;line-height:1.5;padding:0 2mm;}" +
      "h1{font-size:20px;margin:0 0 10px;}h2{font-size:14px;margin:20px 0 8px;padding-bottom:3px;border-bottom:1px solid #ccc;}" +
      "h3{font-size:12px;margin:10px 0 6px;}p{margin:0 0 8px;}ul,ol{margin:0 0 8px 20px;padding:0;}li{margin:0 0 4px;}" +
      "table{width:100%;border-collapse:collapse;margin:6px 0 10px;table-layout:fixed;}th,td{border:1px solid #d9d9d9;padding:6px 7px;vertical-align:top;word-break:break-word;}" +
      "th{background:#f6f6f6;font-weight:700;}section{page-break-inside:avoid;} .muted{color:#666;} .warn{color:#a94442;font-weight:700;}" +
      "</style></head><body>" +
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
        buildTable(["営業区域", "係数", "根拠", "適用日"], coefficientRows) +
        "<p>" + escapeHtml(data.coefficientPolicy || "") + "</p>"
      ) +
      section("6. 運賃と各種料金の区分",
        buildTable(["区分", "事前確定運賃に含めるか", "扱い"], fareFeeRows)
      ) +
      section("7. 電子地図・ルート算定",
        buildList(data.mapAndRouteDesign) +
        buildTable(["項目", "状況", "根拠"], mapRows)
      ) +
      section("8. 複数ルート選択",
        "<p>旅客が2以上の走行予定ルートから1つを選択できる必要がある。選択ルートの距離で事前確定運賃を算定し、利用者・運転者・管理者に同一内容を表示する必要がある。</p>" +
        buildTable(["項目", "状況", "根拠"], multiRouteRows)
      ) +
      section("9. 有料道路利用有無の選択",
        "<p>旅客が予約時または配車依頼時に有料道路利用有無を選択し、選択結果に基づいて算定する。通行料は運賃とは区分して扱う。</p>" +
        buildTable(["項目", "状況", "根拠"], tollRows)
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
        buildTable(["公示要件", "システム対応方針", "現状", "根拠ファイル / 保存項目"], requirementRows)
      ) +
      section("15. 未実装・未確認事項",
        "<p class='warn'>以下は未実装または未確認として明示する。</p>" + buildList(data.unimplementedOrUnconfirmed)
      ) +
      section("16. 今後の実装優先順位",
        "<ol>" + (data.priorities || []).map(function(item){
          return "<li>" + escapeHtml(item) + "</li>";
        }).join("") + "</ol>"
      ) +
      "</body></html>"
    );
  }

  function numberLabel(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  async function savePdf(reportData){
    await ensureHtml2Pdf();
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "0";
    wrapper.style.width = "190mm";
    wrapper.innerHTML = buildReportHtml(reportData);
    document.body.appendChild(wrapper);
    try{
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: "pre-fixed-fare-regulatory-report.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(wrapper).save();
    }finally{
      wrapper.remove();
    }
  }

  global.PreFixedFareReportPdf = {
    savePdf: savePdf
  };
})(typeof window !== "undefined" ? window : globalThis);
