(function(global){
  function escapeHtml(text){
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildTable(headers, rows, colWidths){
    const colgroup = (colWidths || []).map(function(width){
      return "<col style='width:" + escapeHtml(width) + ";'>";
    }).join("");
    const th = headers.map(function(item){
      return "<th>" + escapeHtml(item) + "</th>";
    }).join("");
    const body = (rows || []).map(function(row){
      return "<tr>" + row.map(function(cell){
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return (
      "<div class='table-wrap table-section no-split-table'>" +
      "<table>" + (colgroup ? "<colgroup>" + colgroup + "</colgroup>" : "") +
      "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table></div>"
    );
  }

  function buildReportHtml(data){
    const rows = (data.checkpoints || []).map(function(item){
      return [
        String(item.no),
        item.point,
        item.content,
        item.document,
        item.status
      ];
    });
    return (
      "<div class='pre-fixed-fare-review-checklist report-page'>" +
      "<h1 class='doc-title'>" + escapeHtml(data.title || "") + "</h1>" +
      "<p class='doc-intro'>" + escapeHtml(data.intro || "") + "</p>" +
      buildTable(
        ["No", "審査確認ポイント", "確認内容", "掲載資料", "状態"],
        rows,
        ["5%", "14%", "34%", "32%", "15%"]
      ) +
      "</div>"
    );
  }

  function getCss(){
    if(!global.PreFixedFarePrintLayoutCss){
      throw new Error("印刷用レイアウトCSSモジュールが読み込まれていません。");
    }
    const scope = ".pre-fixed-fare-review-checklist";
    return (
      global.PreFixedFarePrintLayoutCss.getCorePrintCss(scope) +
      scope + " .doc-title{font-size:18pt;font-weight:700;text-align:center;margin:0 0 5mm;}" +
      scope + " .doc-intro{font-size:10.5pt;margin:0 0 5mm;}" +
      scope + " th{text-align:center;}" +
      scope + " td:nth-child(1), " + scope + " td:nth-child(5){text-align:center;}"
    );
  }

  function buildPrintDocument(data){
    return (
      "<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'>" +
      "<style>" + getCss() + "</style></head><body>" +
      buildReportHtml(data) +
      "</body></html>"
    );
  }

  global.PreFixedFareReviewChecklistPdf = {
    buildReportHtml: buildReportHtml,
    buildPrintDocument: buildPrintDocument,
    getCss: getCss
  };
})(typeof window !== "undefined" ? window : globalThis);
